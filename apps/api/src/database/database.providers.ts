import { ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Cognito } from '../modules/auth/entities/cognito.entity';
import { Invitation } from '../modules/auth/entities/invitation.entity';
import { Tenant } from '../modules/auth/entities/tenant.entity';
import { Role } from '../modules/auth/entities/role.entity';
import { TenantUser } from '../modules/auth/entities/tenant-user.entity';
import { LoginAttempt } from '../modules/auth/entities/login-attempt.entity';
import { EventLog } from '../modules/event-log/entities/event-log.entity';
import { ConfigService, DatabaseConfig } from '../config/config.service';

export const AppDataSource = new DataSource({
  type: 'postgres',
  entities: [
    User,
    Cognito,
    Invitation,
    Tenant,
    Role,
    TenantUser,
    LoginAttempt,
    EventLog,
  ],
  synchronize: false,
  // Without this, pg's default TCP connect can hang far longer than expected
  // against an unreachable host -- fail fast instead so a lazy connect attempt
  // (see ensureInitialized below) doesn't block a request indefinitely.
  //
  // max is kept small because every Lambda container opens its own pool -- the
  // default of 10 would let a burst of concurrent invocations exhaust RDS.
  extra: { connectionTimeoutMillis: 3000, max: 3 },
});

// RDS's public CA bundle for us-east-1 (integrity pinned by certs/bundle.spec.ts)
// -- copied into dist/ by the nest-cli assets config so it ships in the Lambda
// zip. Passed as the connection's `ca` rather than NODE_EXTRA_CA_CERTS so it
// only widens trust for this one connection, not every TLS call in the process.
const RDS_CA_BUNDLE = join(__dirname, '..', 'certs', 'us-east-1-bundle.pem');

// Outside production (a plain URL) there's no TLS; in production (discrete
// fields from the secret) the server certificate is always verified.
export function toConnectionOptions(config: DatabaseConfig) {
  if ('url' in config) return { url: config.url };
  return {
    ...config,
    // Explicit so a url can never take precedence over the secret's fields.
    url: undefined,
    ssl: { ca: readFileSync(RDS_CA_BUNDLE, 'utf8'), rejectUnauthorized: true },
  };
}

let initPromise: Promise<DataSource> | null = null;

// Concurrent-safe lazy connect: memoizes the in-flight initialize() call so
// parallel requests share one connection attempt instead of racing (calling
// DataSource.initialize() while already initializing/initialized throws).
// Resets the memoized promise on failure so a later call retries once the
// database may be back, instead of being stuck replaying the same rejection.
export function ensureInitialized(dataSource: DataSource): Promise<DataSource> {
  if (dataSource.isInitialized) return Promise.resolve(dataSource);
  initPromise ??= resolveAndConnect(dataSource).catch((err) => {
    initPromise = null;
    throw new ServiceUnavailableException('Database unavailable', {
      cause: err,
    });
  });
  return initPromise;
}

// A fresh ConfigService per connection attempt (not a shared module-level
// instance) -- ConfigService.getDatabaseConfig() memoizes even on rejection
// (same as getJwtSecret()), so reusing one instance across attempts would
// let a failed resolution get cached forever and defeat the retry-on-failure
// behavior above.
async function resolveAndConnect(dataSource: DataSource): Promise<DataSource> {
  const config = await new ConfigService().getDatabaseConfig();
  dataSource.setOptions(toConnectionOptions(config));
  return dataSource.initialize();
}

const NODE_CONNECTIVITY_CODES = new Set([
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  'ENOTFOUND',
  'ECONNRESET',
  'EPIPE',
  'EAI_AGAIN',
]);

// isInitialized only means "initialize() once succeeded" -- it never resets itself
// if the connection later dies, so a query against a since-gone database doesn't
// go through ensureInitialized at all, it fails inside the query call itself. This
// classifies that failure so callers can give it the same clean 503 treatment,
// without misreporting genuine application-level errors (e.g. a unique-constraint
// violation) as "database unavailable". Duck-typed on `code`/`driverError.code`
// rather than instanceof-checking TypeORM's error classes, so it doesn't depend on
// exactly how a given failure got wrapped. Re-verify this against a real connection
// failure after upgrading typeorm/pg, in case a future version wraps or codes these
// differently.
export function isConnectivityError(err: unknown): boolean {
  const code =
    (err as { code?: unknown })?.code ??
    (err as { driverError?: { code?: unknown } })?.driverError?.code;
  if (typeof code !== 'string') return false;
  // Postgres SQLSTATE class 08 = Connection Exception (e.g. 08006 connection_failure)
  // -- covers a connection that was live and got dropped mid-lifetime, distinct from
  // the Node-level codes above which cover never establishing one in the first place.
  return NODE_CONNECTIVITY_CODES.has(code) || code.startsWith('08');
}
