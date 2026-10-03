import { Injectable } from '@nestjs/common';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

// Outside production a single connection URL; in production the discrete fields
// from the Secrets Manager secret (which also switches TLS on -- see
// database.providers.ts).
export type DatabaseConfig =
  | { url: string }
  | {
      host: string;
      port: number;
      username: string;
      password: string;
      database: string;
    };

@Injectable()
export class ConfigService {
  private jwtSecret?: Promise<string>;
  private databaseConfig?: Promise<DatabaseConfig>;

  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  isCognitoEnabled(): boolean {
    return process.env.USE_COGNITO === 'true';
  }

  // Opt-in only -- boost-http.e2e-spec.ts already exercises a real local
  // Lambda via `sam local start-lambda`, and that workflow must keep working
  // untouched unless this is explicitly set.
  isBoostPlaceholderEnabled(): boolean {
    return process.env.BOOST_LOCAL_PLACEHOLDER === 'true';
  }

  getBoostFunctionName(): string {
    const value = process.env.BOOST_LAMBDA_FUNCTION_NAME;
    if (!value)
      throw new Error(
        'BOOST_LAMBDA_FUNCTION_NAME environment variable is not set',
      );
    return value;
  }

  getJwtSecret(): Promise<string> {
    this.jwtSecret ??= this.resolveJwtSecret();
    return this.jwtSecret;
  }

  private async resolveJwtSecret(): Promise<string> {
    const value = process.env.JWT_SECRET;
    if (!value) throw new Error('JWT_SECRET environment variable is not set');
    if (!this.isProduction()) return value;

    // In production, JWT_SECRET holds the *name* of the Secrets Manager secret, not the value.
    const client = new SecretsManagerClient({});
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: value }),
    );
    if (!response.SecretString) {
      throw new Error(`Secrets Manager secret "${value}" has no SecretString`);
    }
    return response.SecretString;
  }

  getDatabaseConfig(): Promise<DatabaseConfig> {
    this.databaseConfig ??= this.resolveDatabaseConfig();
    return this.databaseConfig;
  }

  private async resolveDatabaseConfig(): Promise<DatabaseConfig> {
    const value = process.env.DATABASE_URL;
    if (!value) throw new Error('DATABASE_URL environment variable is not set');
    if (!this.isProduction()) return { url: value };

    // In production, DATABASE_URL holds the *name* of the Secrets Manager secret, not the value.
    // The secret is JSON -- { username, password, host, port, dbname } -- rather than a URL,
    // so a password with URL-reserved characters needs no escaping. Error messages name the
    // secret but never include its contents.
    const client = new SecretsManagerClient({});
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: value }),
    );
    if (!response.SecretString) {
      throw new Error(`Secrets Manager secret "${value}" has no SecretString`);
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(response.SecretString);
    } catch {
      throw new Error(`Secrets Manager secret "${value}" is not valid JSON`);
    }
    const secret = (parsed ?? {}) as Record<string, unknown>;
    const text = (key: string): string => {
      const field = secret[key];
      if (typeof field !== 'string' || !field) {
        throw new Error(
          `Secrets Manager secret "${value}" is missing "${key}"`,
        );
      }
      return field;
    };
    // A hand-made secret may store the port as a number or a string.
    const port = Number(secret.port);
    if (!Number.isInteger(port) || port <= 0) {
      throw new Error(
        `Secrets Manager secret "${value}" has an invalid "port"`,
      );
    }
    return {
      host: text('host'),
      port,
      username: text('username'),
      password: text('password'),
      database: text('dbname'),
    };
  }
}
