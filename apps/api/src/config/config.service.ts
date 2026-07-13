import { Injectable } from '@nestjs/common';
import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

@Injectable()
export class ConfigService {
  private jwtSecret?: Promise<string>;

  isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
  }

  isTest(): boolean {
    return process.env.NODE_ENV === 'test';
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
    const response = await client.send(new GetSecretValueCommand({ SecretId: value }));
    if (!response.SecretString) {
      throw new Error(`Secrets Manager secret "${value}" has no SecretString`);
    }
    return response.SecretString;
  }
}
