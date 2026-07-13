import { ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from "typeorm";
import { User } from "../modules/users/entities/user.entity";

export const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [User],
  synchronize: false,
  // Without this, pg's default TCP connect can hang far longer than expected
  // against an unreachable host -- fail fast instead so a lazy connect attempt
  // (see ensureInitialized below) doesn't block a request indefinitely.
  extra: { connectionTimeoutMillis: 3000 },
});

let initPromise: Promise<DataSource> | null = null;

// Concurrent-safe lazy connect: memoizes the in-flight initialize() call so
// parallel requests share one connection attempt instead of racing (calling
// DataSource.initialize() while already initializing/initialized throws).
// Resets the memoized promise on failure so a later call retries once the
// database may be back, instead of being stuck replaying the same rejection.
export function ensureInitialized(dataSource: DataSource): Promise<DataSource> {
  if (dataSource.isInitialized) return Promise.resolve(dataSource);
  initPromise ??= dataSource.initialize().catch((err) => {
    initPromise = null;
    throw new ServiceUnavailableException('Database unavailable', { cause: err });
  });
  return initPromise;
}

const NODE_CONNECTIVITY_CODES = new Set([
  'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ENOTFOUND', 'ECONNRESET', 'EPIPE', 'EAI_AGAIN',
]);

// isInitialized only means "initialize() once succeeded" -- it never resets itself
// if the connection later dies, so a query against a since-gone database doesn't
// go through ensureInitialized at all, it fails inside the query call itself. This
// classifies that failure so callers can give it the same clean 503 treatment,
// without misreporting genuine application-level errors (e.g. a unique-constraint
// violation) as "database unavailable". Duck-typed on `code`/`driverError.code`
// rather than instanceof-checking TypeORM's error classes, so it doesn't depend on
// exactly how a given failure got wrapped.
export function isConnectivityError(err: unknown): boolean {
  const code = (err as { code?: unknown })?.code
    ?? (err as { driverError?: { code?: unknown } })?.driverError?.code;
  if (typeof code !== 'string') return false;
  // Postgres SQLSTATE class 08 = Connection Exception (e.g. 08006 connection_failure)
  // -- covers a connection that was live and got dropped mid-lifetime, distinct from
  // the Node-level codes above which cover never establishing one in the first place.
  return NODE_CONNECTIVITY_CODES.has(code) || code.startsWith('08');
}
