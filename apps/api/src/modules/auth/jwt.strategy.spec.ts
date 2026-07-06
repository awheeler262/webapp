import { UnauthorizedException } from '@nestjs/common';
import { JwtStrategy } from './jwt.strategy';
import { UsersService } from '../users/users.service';

describe('JwtStrategy', () => {
  const originalSecret = process.env.JWT_SECRET;

  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret';
  });

  afterEach(() => {
    process.env.JWT_SECRET = originalSecret;
  });

  it('throws at construction time if JWT_SECRET is not set', () => {
    delete process.env.JWT_SECRET;
    const usersService = { findById: jest.fn() } as unknown as UsersService;

    expect(() => new JwtStrategy(usersService)).toThrow(
      'JWT_SECRET environment variable is not set',
    );
  });

  describe('validate', () => {
    it('returns the user when the token subject still exists', async () => {
      const user = { id: '1', email: 'a@b.com' };
      const usersService = { findById: jest.fn().mockResolvedValue(user) } as unknown as UsersService;
      const strategy = new JwtStrategy(usersService);

      const result = await strategy.validate({ sub: '1', email: 'a@b.com' });

      expect(usersService.findById).toHaveBeenCalledWith('1');
      expect(result).toBe(user);
    });

    it('throws UnauthorizedException when the user no longer exists', async () => {
      const usersService = { findById: jest.fn().mockResolvedValue(null) } as unknown as UsersService;
      const strategy = new JwtStrategy(usersService);

      await expect(strategy.validate({ sub: 'missing', email: 'a@b.com' })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
