import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';
import { ConfigService } from '../../config/config.service';

describe('JwtStrategy', () => {
  const originalSecret = process.env.JWT_SECRET;

  const mockConfigService = (secret = 'resolved-secret') =>
    ({ getJwtSecret: jest.fn().mockResolvedValue(secret) }) as unknown as ConfigService;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('throws at construction time if JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    const usersService = { findById: jest.fn() } as unknown as UsersService;

    expect(() => new JwtStrategy(usersService, mockConfigService())).toThrow(
      'JWT_SECRET environment variable is not set',
    );
  });

  describe('secretOrKeyProvider', () => {
    it('resolves the secret via ConfigService.getJwtSecret()', (done) => {
      const usersService = { findById: jest.fn() } as unknown as UsersService;
      const configService = mockConfigService('resolved-secret');
      const strategy = new JwtStrategy(usersService, configService);

      (strategy as any)._secretOrKeyProvider(
        {},
        'raw-token',
        (err: unknown, secret?: string) => {
          expect(err).toBeNull();
          expect(secret).toBe('resolved-secret');
          expect(configService.getJwtSecret).toHaveBeenCalled();
          done();
        },
      );
    });

    it('propagates a rejection from ConfigService.getJwtSecret() as an error', (done) => {
      const usersService = { findById: jest.fn() } as unknown as UsersService;
      const configService = {
        getJwtSecret: jest.fn().mockRejectedValue(new Error('secrets manager unreachable')),
      } as unknown as ConfigService;
      const strategy = new JwtStrategy(usersService, configService);

      (strategy as any)._secretOrKeyProvider({}, 'raw-token', (err: unknown) => {
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toBe('secrets manager unreachable');
        done();
      });
    });
  });

  describe('validate', () => {
    it('returns the user when the token subject still exists', async () => {
      const user = { id: '1', email: 'a@b.com' };
      const usersService = { findById: jest.fn().mockResolvedValue(user) } as unknown as UsersService;
      const strategy = new JwtStrategy(usersService, mockConfigService());

      const result = await strategy.validate({ sub: '1', email: 'a@b.com' });

      expect(usersService.findById).toHaveBeenCalledWith('1');
      expect(result).toBe(user);
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      const usersService = { findById: jest.fn().mockResolvedValue(null) } as unknown as UsersService;
      const strategy = new JwtStrategy(usersService, mockConfigService());

      await expect(strategy.validate({ sub: 'missing', email: 'a@b.com' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
