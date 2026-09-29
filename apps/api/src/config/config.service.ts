import { Injectable } from '@nestjs/common';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

const REGISTRATION_ALLOWED_ENVS = new Set(['development', 'test', 'e2e']);

@Injectable()
export class ConfigService {
  private jwtSecret?: Promise<string>;
  private databaseUrl?: Promise<string>;

  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  isCognitoEnabled(): boolean {
    return process.env.USE_COGNITO === 'true';
  }

  // Allowlists known-safe environments rather than denylisting 'production' --
  // an unrecognized/misconfigured NODE_ENV now fails closed (registration blocked)
  // instead of failing open (registration silently allowed).
  isRegistrationAllowed(): boolean {
    return REGISTRATION_ALLOWED_ENVS.has(process.env.NODE_ENV ?? 'development');
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

  getDatabaseUrl(): Promise<string> {
    this.databaseUrl ??= this.resolveDatabaseUrl();
    return this.databaseUrl;
  }

  private async resolveDatabaseUrl(): Promise<string> {
    const value = process.env.DATABASE_URL;
    if (!value) throw new Error('DATABASE_URL environment variable is not set');
    if (!this.isProduction()) return value;

    // In production, DATABASE_URL holds the *name* of the Secrets Manager secret, not the value.
    const client = new SecretsManagerClient({});
    const response = await client.send(
      new GetSecretValueCommand({ SecretId: value }),
    );
    if (!response.SecretString) {
      throw new Error(`Secrets Manager secret "${value}" has no SecretString`);
    }
    return response.SecretString;
  }
}
