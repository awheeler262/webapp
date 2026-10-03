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
  const originalBoostPlaceholder = process.env.BOOST_LOCAL_PLACEHOLDER;

  beforeEach(() => {
    service = new ConfigService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalJwtSecret;
    process.env.DATABASE_URL = originalDatabaseUrl;
    process.env.BOOST_LOCAL_PLACEHOLDER = originalBoostPlaceholder;
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

  describe('isBoostPlaceholderEnabled', () => {
    it('is true only when the flag is exactly "true"', () => {
      process.env.BOOST_LOCAL_PLACEHOLDER = 'true';
      expect(service.isBoostPlaceholderEnabled()).toBe(true);
    });

    it('is false when unset', () => {
      delete process.env.BOOST_LOCAL_PLACEHOLDER;
      expect(service.isBoostPlaceholderEnabled()).toBe(false);
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

  describe('getDatabaseConfig', () => {
    it('throws if DATABASE_URL is not set', async () => {
      delete process.env.DATABASE_URL;
      await expect(service.getDatabaseConfig()).rejects.toThrow(
        'DATABASE_URL environment variable is not set',
      );
    });

    it('outside production, returns the env var as a url with no AWS call', async () => {
      process.env.NODE_ENV = 'test';
      process.env.DATABASE_URL = 'postgres://localhost:5432/webapp';

      const result = await service.getDatabaseConfig();

      expect(result).toEqual({ url: 'postgres://localhost:5432/webapp' });
      expect(SecretsManagerClient).not.toHaveBeenCalled();
    });

    describe('in production', () => {
      const secret = {
        username: 'app',
        password: 'p@ss/w:rd#1',
        host: 'db.example.us-east-1.rds.amazonaws.com',
        port: 5432,
        dbname: 'webapp',
      };

      function mockSecret(secretString?: string) {
        const send = jest
          .fn()
          .mockResolvedValue({ SecretString: secretString });
        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({
          send,
        }));
        return send;
      }

      beforeEach(() => {
        process.env.NODE_ENV = 'production';
        process.env.DATABASE_URL = 'my-db-secret-name';
      });

      it('fetches the JSON secret using DATABASE_URL as the secret name and maps its fields', async () => {
        const send = mockSecret(JSON.stringify(secret));

        const result = await service.getDatabaseConfig();

        expect(send).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
        expect(GetSecretValueCommand).toHaveBeenCalledWith({
          SecretId: 'my-db-secret-name',
        });
        expect(result).toEqual({
          host: secret.host,
          port: 5432,
          username: 'app',
          password: 'p@ss/w:rd#1',
          database: 'webapp',
        });
      });

      it('accepts the port as a numeric string', async () => {
        mockSecret(JSON.stringify({ ...secret, port: '5433' }));

        await expect(service.getDatabaseConfig()).resolves.toMatchObject({
          port: 5433,
        });
      });

      it('throws if the secret has no SecretString', async () => {
        mockSecret(undefined);

        await expect(service.getDatabaseConfig()).rejects.toThrow(
          'Secrets Manager secret "my-db-secret-name" has no SecretString',
        );
      });

      it('throws without echoing the contents if the secret is not valid JSON', async () => {
        mockSecret('postgres://app:hunter2@host/db');

        const result = service.getDatabaseConfig();

        await expect(result).rejects.toThrow(
          'Secrets Manager secret "my-db-secret-name" is not valid JSON',
        );
        await expect(result).rejects.not.toThrow(/hunter2/);
      });

      it.each(['username', 'password', 'host', 'dbname'])(
        'throws naming the key if "%s" is missing',
        async (key) => {
          const incomplete: Record<string, unknown> = { ...secret };
          delete incomplete[key];
          mockSecret(JSON.stringify(incomplete));

          await expect(service.getDatabaseConfig()).rejects.toThrow(
            `Secrets Manager secret "my-db-secret-name" is missing "${key}"`,
          );
        },
      );

      it('throws if the port is missing or not a positive integer', async () => {
        mockSecret(JSON.stringify({ ...secret, port: 'abc' }));

        await expect(service.getDatabaseConfig()).rejects.toThrow(
          'Secrets Manager secret "my-db-secret-name" has an invalid "port"',
        );
      });

      it('only fetches once and caches the in-flight promise for subsequent calls', async () => {
        const send = mockSecret(JSON.stringify(secret));

        const [first, second] = await Promise.all([
          service.getDatabaseConfig(),
          service.getDatabaseConfig(),
        ]);

        expect(first).toBe(second);
        expect(send).toHaveBeenCalledTimes(1);
      });
    });
  });
});
