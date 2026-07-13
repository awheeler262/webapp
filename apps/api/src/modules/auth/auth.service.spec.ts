import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '../../config/config.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: { findByEmail: jest.fn(), create: jest.fn() } },
        { provide: JwtService, useValue: { sign: jest.fn(), decode: jest.fn() } },
        {
          provide: ConfigService,
          useValue: {
            isProduction: jest.fn().mockReturnValue(false),
            isDevLoginBypassEnabled: jest.fn().mockReturnValue(false),
            isRegistrationAllowed: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);
    configService = module.get(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('register', () => {
    it('throws ForbiddenException when registration is not allowed', async () => {
      configService.isRegistrationAllowed.mockReturnValue(false);

      await expect(
        service.register({ email: 'a@b.com', name: 'A', password: 'pw' } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });

    it('throws ConflictException if the email is already in use', async () => {
      usersService.findByEmail.mockResolvedValue({ id: '1' } as any);

      await expect(
        service.register({ email: 'a@b.com', name: 'A', password: 'pw' } as any),
      ).rejects.toThrow(ConflictException);
      expect(usersService.create).not.toHaveBeenCalled();
    });

    it('creates the user and returns a signed token with user info and exp', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      usersService.create.mockResolvedValue({ id: '1', email: 'a@b.com' } as any);
      jwtService.sign.mockReturnValue('signed-token');
      jwtService.decode.mockReturnValue({ exp: 1234567890 });

      const result = await service.register({ email: 'a@b.com', name: 'A', password: 'pw' } as any);

      expect(usersService.create).toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith({ sub: '1', email: 'a@b.com' });
      expect(result).toEqual({
        accessToken: 'signed-token',
        user: { id: '1', email: 'a@b.com' },
        exp: 1234567890,
      });
    });
  });

  describe('login', () => {
    it('when the dev login bypass is enabled, returns a token for the fixed dev user id regardless of credentials', async () => {
      configService.isDevLoginBypassEnabled.mockReturnValue(true);
      jwtService.sign.mockReturnValue('dev-token');
      jwtService.decode.mockReturnValue({ exp: 1234567890 });

      const result = await service.login('anyone@example.com', 'whatever-password');

      expect(usersService.findByEmail).not.toHaveBeenCalled();
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: '8fb2a405-503e-4344-8543-6e8d93f4c9ee',
        email: 'anyone@example.com',
      });
      expect(result).toEqual({
        accessToken: 'dev-token',
        user: { id: '8fb2a405-503e-4344-8543-6e8d93f4c9ee', email: 'anyone@example.com' },
        exp: 1234567890,
      });
    });

    describe('when the dev login bypass is disabled', () => {
      it('throws UnauthorizedException if no user matches the email', async () => {
        usersService.findByEmail.mockResolvedValue(null);

        await expect(service.login('a@b.com', 'pw')).rejects.toThrow(UnauthorizedException);
      });

      it('throws UnauthorizedException if the password does not match', async () => {
        usersService.findByEmail.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'hashed' } as any);
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(service.login('a@b.com', 'wrong-pw')).rejects.toThrow(UnauthorizedException);
      });

      it('returns a signed token when credentials are valid', async () => {
        usersService.findByEmail.mockResolvedValue({ id: '1', email: 'a@b.com', password: 'hashed' } as any);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        jwtService.sign.mockReturnValue('real-token');
        jwtService.decode.mockReturnValue({ exp: 1234567890 });

        const result = await service.login('a@b.com', 'correct-pw');

        expect(jwtService.sign).toHaveBeenCalledWith({ sub: '1', email: 'a@b.com' });
        expect(result).toEqual({
          accessToken: 'real-token',
          user: { id: '1', email: 'a@b.com' },
          exp: 1234567890,
        });
      });
    });
  });
});
