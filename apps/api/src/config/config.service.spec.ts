import {
  SecretsManagerClient,
  GetSecretValueCommand,
} from '@aws-sdk/client-secrets-manager';
import { ConfigService } from './config.service';

jest.mock('@aws-sdk/client-secrets-manager');

describe('ConfigService', () => {
  let service: ConfigService;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalDatabaseUrl = process.env.DATABASE_URL;
  const originalDevLoginBypass = process.env.ALLOW_DEV_LOGIN_BYPASS;

  beforeEach(() => {
    service = new ConfigService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.ALLOW_DEV_LOGIN_BYPASS = originalDevLoginBypass;
  });

  describe('isProduction', () => {
    it('is true when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      expect(service.isProduction()).toBe(true);
    });

    it('is false otherwise', () => {
      process.env.NODE_ENV = 'test';
      expect(service.isProduction()).toBe(false);
    });
  });

  describe('isDevLoginBypassEnabled', () => {
    it('is true when the flag is set and NODE_ENV is not production', () => {
      process.env.ALLOW_DEV_LOGIN_BYPASS = 'true';
      process.env.NODE_ENV = 'test';
      expect(service.isDevLoginBypassEnabled()).toBe(true);
    });

    it('is false when the flag is not set, regardless of NODE_ENV', () => {
      delete process.env.ALLOW_DEV_LOGIN_BYPASS;
      process.env.NODE_ENV = 'test';
      expect(service.isDevLoginBypassEnabled()).toBe(false);
    });

    it('is false when the flag is set but NODE_ENV is production (defense in depth)', () => {
      process.env.ALLOW_DEV_LOGIN_BYPASS = 'true';
      process.env.NODE_ENV = 'production';
      expect(service.isDevLoginBypassEnabled()).toBe(false);
    });
  });

  describe('isRegistrationAllowed', () => {
    it('is true for known-safe environments', () => {
      process.env.NODE_ENV = 'development';
      expect(service.isRegistrationAllowed()).toBe(true);
    });

    it('is false in production', () => {
      process.env.NODE_ENV = 'production';
      expect(service.isRegistrationAllowed()).toBe(false);
    });

    it('fails closed for an unrecognized/misconfigured NODE_ENV', () => {
      process.env.NODE_ENV = 'staging';
      expect(service.isRegistrationAllowed()).toBe(false);
    });
  });

  describe('getJwtSecret', () => {
    it('throws if JWT_SECRET is not set', async () => {
      delete process.env.JWT_SECRET;
      await expect(service.getJwtSecret()).rejects.toThrow(
        'JWT_SECRET environment variable is not set',
      );
    });

    it('outside production, returns the env var value directly with no AWS call', async () => {
      process.env.NODE_ENV = 'test';
      process.env.JWT_SECRET = 'local-dev-secret';

      const result = await service.getJwtSecret();

      expect(result).toBe('local-dev-secret');
      expect(SecretsManagerClient).not.toHaveBeenCalled();
    });

    describe('in production', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        process.env.JWT_SECRET = 'my-secret-name';
      });

      it('fetches the secret value from Secrets Manager using JWT_SECRET as the secret name', async () => {
        const send = jest
          .fn()
          .mockResolvedValue({ SecretString: 'fetched-secret-value' });
        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
          send,
        }));

        const result = await service.getJwtSecret();

        expect(send).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
        expect(GetSecretValueCommand).toHaveBeenCalledWith({
          SecretId: 'my-secret-name',
        });
        expect(result).toBe('fetched-secret-value');
      });

      it('throws if the secret has no SecretString', async () => {
        const send = jest.fn().mockResolvedValue({});
        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
          send,
        }));

        await expect(service.getJwtSecret()).rejects.toThrow(
          'Secrets Manager secret "my-secret-name" has no SecretString',
        );
      });

      it('only fetches once and caches the in-flight promise for subsequent calls', async () => {
        const send = jest
          .fn()
          .mockResolvedValue({ SecretString: 'fetched-secret-value' });
        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
          send,
        }));

        const [first, second] = await Promise.all([
          service.getJwtSecret(),
          service.getJwtSecret(),
        ]);

        expect(first).toBe('fetched-secret-value');
        expect(second).toBe('fetched-secret-value');
        expect(send).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('getDatabaseUrl', () => {
    it('throws if DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      await expect(service.getDatabaseUrl()).rejects.toThrow(
        'DATABASE_URL environment variable is not set',
      );
    });

    it('outside production, returns the env var value directly with no AWS call', async () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgres://localhost:5432/webapp';

      const result = await service.getDatabaseUrl();

      expect(result).toBe('postgres://localhost:5432/webapp');
      expect(SecretsManagerClient).not.toHaveBeenCalled();
    });

    describe('in production', () => {
      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        process.env.DATABASE_URL = 'my-db-secret-name';
      });

      it('fetches the secret value from Secrets Manager using DATABASE_URL as the secret name', async () => {
        const send = jest.fn().mockResolvedValue({
          SecretString: 'postgres://prod-host:5432/webapp',
        });
        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
          send,
        }));

        const result = await service.getDatabaseUrl();

        expect(send).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
        expect(GetSecretValueCommand).toHaveBeenCalledWith({
          SecretId: 'my-db-secret-name',
        });
        expect(result).toBe('postgres://prod-host:5432/webapp');
      });

      it('throws if the secret has no SecretString', async () => {
        const send = jest.fn().mockResolvedValue({});
        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
          send,
        }));

        await expect(service.getDatabaseUrl()).rejects.toThrow(
          'Secrets Manager secret "my-db-secret-name" has no SecretString',
        );
      });

      it('only fetches once and caches the in-flight promise for subsequent calls', async () => {
        const send = jest.fn().mockResolvedValue({
          SecretString: 'postgres://prod-host:5432/webapp',
        });
        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
          send,
        }));

        const [first, second] = await Promise.all([
          service.getDatabaseUrl(),
          service.getDatabaseUrl(),
        ]);

        expect(first).toBe('postgres://prod-host:5432/webapp');
        expect(second).toBe('postgres://prod-host:5432/webapp');
        expect(send).toHaveBeenCalledTimes(1);
      });
    });
  });
});
