import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';
import { ConfigService } from './config.service';

jest.mock('@aws-sdk/client-secrets-manager');

describe('ConfigService', () => {
  let service: ConfigService;
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    service = new ConfigService();
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    process.env.JWT_SECRET = originalJwtSecret;
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
        const send = jest.fn().mockResolvedValue({ SecretString: 'fetched-secret-value' });
        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({ send }));

        const result = await service.getJwtSecret();

        expect(send).toHaveBeenCalledWith(expect.any(GetSecretValueCommand));
        expect(GetSecretValueCommand).toHaveBeenCalledWith({ SecretId: 'my-secret-name' });
        expect(result).toBe('fetched-secret-value');
      });

      it('throws if the secret has no SecretString', async () => {
        const send = jest.fn().mockResolvedValue({});
        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({ send }));

        await expect(service.getJwtSecret()).rejects.toThrow(
          'Secrets Manager secret "my-secret-name" has no SecretString',
        );
      });

      it('only fetches once and caches the in-flight promise for subsequent calls', async () => {
        const send = jest.fn().mockResolvedValue({ SecretString: 'fetched-secret-value' });
        (SecretsManagerClient as jest.Mock).mockImplementation(() => ({ send }));

        const [first, second] = await Promise.all([service.getJwtSecret(), service.getJwtSecret()]);

        expect(first).toBe('fetched-secret-value');
        expect(second).toBe('fetched-secret-value');
        expect(send).toHaveBeenCalledTimes(1);
      });
    });
  });
});
