import { Test, TestingModule } from '@nestjs/testing';
import {
  ConflictException,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { CognitoService } from './cognito.service';
import { UsersService } from '../users/users.service';
import { ConfigService } from '../../config/config.service';

jest.mock('bcrypt');

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let cognitoService: jest.Mocked<CognitoService>;
  let jwtService: jest.Mocked<JwtService>;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: UsersService,
          useValue: { findByEmail: jest.fn(), findByCognitoSub: jest.fn() },
        },
        {
          provide: CognitoService,
          useValue: {
            findByEmail: jest.fn(),
            findValidInvitation: jest.fn(),
            createIdentity: jest.fn(),
            findTenantIdsForUser: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: JwtService,
          useValue: { sign: jest.fn(), decode: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: {
            isProduction: jest.fn().mockReturnValue(false),
            isCognitoEnabled: jest.fn().mockReturnValue(false),
            isRegistrationAllowed: jest.fn().mockReturnValue(true),
          },
        },
      ],
    }).compile();

    service = module.get(AuthService);
    usersService = module.get(UsersService);
    cognitoService = module.get(CognitoService);
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
        service.register({
          email: 'a@b.com',
          name: 'A',
          password: 'pw',
        } as any),
      ).rejects.toThrow(ForbiddenException);
      expect(usersService.findByEmail).not.toHaveBeenCalled();
    });

    it('throws ConflictException if the email is already in use', async () => {
      usersService.findByEmail.mockResolvedValue({ id: '1' } as any);

      await expect(
        service.register({
          email: 'a@b.com',
          name: 'A',
          password: 'pw',
        } as any),
      ).rejects.toThrow(ConflictException);
      expect(cognitoService.createIdentity).not.toHaveBeenCalled();
    });

    it('creates the identity (no invitation) and returns a signed token with tenants', async () => {
      usersService.findByEmail.mockResolvedValue(null);
      cognitoService.createIdentity.mockResolvedValue({
        id: '1',
        email: 'a@b.com',
      } as any);
      cognitoService.findTenantIdsForUser.mockResolvedValue([]);
      jwtService.sign.mockReturnValue('signed-token');
      jwtService.decode.mockReturnValue({ exp: 1234567890 });

      const result = await service.register({
        email: 'a@b.com',
        name: 'A',
        password: 'pw',
      });

      expect(cognitoService.createIdentity).toHaveBeenCalledWith({
        email: 'a@b.com',
        name: 'A',
        passwordPlain: 'pw',
      });
      expect(jwtService.sign).toHaveBeenCalledWith({
        sub: '1',
        email: 'a@b.com',
      });
      expect(result).toEqual({
        accessToken: 'signed-token',
        user: { id: '1', email: 'a@b.com' },
        exp: 1234567890,
        tenants: [],
      });
    });
  });

  describe('login', () => {
    it('returns 503 when cognito is enabled, without touching the database', async () => {
      configService.isCognitoEnabled.mockReturnValue(true);

      await expect(service.login('a@b.com', 'pw')).rejects.toThrow(
        ServiceUnavailableException,
      );
      expect(cognitoService.findByEmail).not.toHaveBeenCalled();
    });

    describe('when a cognito identity exists for the email', () => {
      it('throws UnauthorizedException if the password does not match', async () => {
        cognitoService.findByEmail.mockResolvedValue({
          id: 'c1',
          email: 'a@b.com',
          password: 'hashed',
          sub: 'sub-1',
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(service.login('a@b.com', 'wrong-pw')).rejects.toThrow(
          UnauthorizedException,
        );
        expect(usersService.findByCognitoSub).not.toHaveBeenCalled();
      });

      it('returns a signed token with tenants when the password matches', async () => {
        cognitoService.findByEmail.mockResolvedValue({
          id: 'c1',
          email: 'a@b.com',
          password: 'hashed',
          sub: 'sub-1',
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        usersService.findByCognitoSub.mockResolvedValue({
          id: '1',
          email: 'a@b.com',
        } as any);
        cognitoService.findTenantIdsForUser.mockResolvedValue(['t1', 't2']);
        jwtService.sign.mockReturnValue('real-token');
        jwtService.decode.mockReturnValue({ exp: 1234567890 });

        const result = await service.login('a@b.com', 'correct-pw');

        expect(jwtService.sign).toHaveBeenCalledWith({
          sub: '1',
          email: 'a@b.com',
        });
        expect(result).toEqual({
          accessToken: 'real-token',
          user: { id: '1', email: 'a@b.com' },
          exp: 1234567890,
          tenants: ['t1', 't2'],
        });
      });

      it('includes isDevops in the response user, but never in the signed JWT payload', async () => {
        cognitoService.findByEmail.mockResolvedValue({
          id: 'c1',
          email: 'devops@b.com',
          password: 'hashed',
          sub: 'sub-1',
        });
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        usersService.findByCognitoSub.mockResolvedValue({
          id: '1',
          email: 'devops@b.com',
          isDevops: true,
        } as any);
        cognitoService.findTenantIdsForUser.mockResolvedValue([]);
        jwtService.sign.mockReturnValue('devops-token');
        jwtService.decode.mockReturnValue({ exp: 1234567890 });

        const result = await service.login('devops@b.com', 'correct-pw');

        expect(jwtService.sign).toHaveBeenCalledWith({
          sub: '1',
          email: 'devops@b.com',
        });
        expect(result.user).toEqual({
          id: '1',
          email: 'devops@b.com',
          isDevops: true,
        });
      });
    });

    describe('when no cognito identity exists for the email', () => {
      it('throws UnauthorizedException if there is no valid invitation', async () => {
        cognitoService.findByEmail.mockResolvedValue(null);
        cognitoService.findValidInvitation.mockResolvedValue(null);

        await expect(
          service.login('invited@b.com', 'temp-token'),
        ).rejects.toThrow(UnauthorizedException);
        expect(cognitoService.createIdentity).not.toHaveBeenCalled();
      });

      it('throws UnauthorizedException if the submitted password does not match the invitation token hash', async () => {
        cognitoService.findByEmail.mockResolvedValue(null);
        cognitoService.findValidInvitation.mockResolvedValue({
          id: 'inv-1',
          email: 'invited@b.com',
          tokenHash: 'hashed-token',
        } as any);
        (bcrypt.compare as jest.Mock).mockResolvedValue(false);

        await expect(
          service.login('invited@b.com', 'wrong-token'),
        ).rejects.toThrow(UnauthorizedException);
        expect(cognitoService.createIdentity).not.toHaveBeenCalled();
      });

      it('provisions the identity from the invitation and returns a signed token with tenants', async () => {
        const invitation = {
          id: 'inv-1',
          email: 'invited@b.com',
          tenantId: 'tenant-1',
          roleId: 'role-1',
          tokenHash: 'hashed-token',
        };
        cognitoService.findByEmail.mockResolvedValue(null);
        cognitoService.findValidInvitation.mockResolvedValue(invitation as any);
        (bcrypt.compare as jest.Mock).mockResolvedValue(true);
        cognitoService.createIdentity.mockResolvedValue({
          id: '1',
          email: 'invited@b.com',
        } as any);
        cognitoService.findTenantIdsForUser.mockResolvedValue(['tenant-1']);
        jwtService.sign.mockReturnValue('provisioned-token');
        jwtService.decode.mockReturnValue({ exp: 1234567890 });

        const result = await service.login('invited@b.com', 'the-real-token');

        expect(cognitoService.createIdentity).toHaveBeenCalledWith({
          email: 'invited@b.com',
          name: '',
          passwordPlain: 'the-real-token',
          invitation,
        });
        expect(result).toEqual({
          accessToken: 'provisioned-token',
          user: { id: '1', email: 'invited@b.com' },
          exp: 1234567890,
          tenants: ['tenant-1'],
        });
      });
    });
  });
});
