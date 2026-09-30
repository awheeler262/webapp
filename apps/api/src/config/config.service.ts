import { Injectable } from '@nestjs/common';
import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';

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
