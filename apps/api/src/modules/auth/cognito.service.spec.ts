import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CognitoService } from './cognito.service';
import { Cognito } from './entities/cognito.entity';
import { Invitation } from './entities/invitation.entity';
import { TenantUser } from './entities/tenant-user.entity';
import { User } from '../users/entities/user.entity';
import { DATA_SOURCE } from '../../database/database.module';

describe('CognitoService', () => {
  let service: CognitoService;
  let cognitoRepo: jest.Mocked<Repository<Cognito>>;
  let invitationRepo: jest.Mocked<Repository<Invitation>>;
  let tenantUserRepo: jest.Mocked<Repository<TenantUser>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let queryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    getOne: jest.Mock;
  };
  let dataSource: {
    isInitialized: boolean;
    getRepository: jest.Mock;
    transaction: jest.Mock;
  };

  beforeEach(async () => {
    cognitoRepo = {
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<Cognito>>;
    queryBuilder = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    invitationRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Invitation>>;
    tenantUserRepo = {
      find: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<TenantUser>>;
    userRepo = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    const reposByEntity = new Map<unknown, unknown>([
      [Cognito, cognitoRepo],
      [Invitation, invitationRepo],
      [TenantUser, tenantUserRepo],
      [User, userRepo],
    ]);

    dataSource = {
      isInitialized: true,
      getRepository: jest.fn((entity: unknown) => reposByEntity.get(entity)),
      transaction: jest.fn((fn: (manager: unknown) => Promise<unknown>) =>
        fn(dataSource),
      ),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CognitoService,
        { provide: DATA_SOURCE, useValue: dataSource },
      ],
    }).compile();

    service = module.get(CognitoService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findByEmail', () => {
    it('queries the cognito table by email', async () => {
      const cognito = { id: 'c1', email: 'a@b.com', sub: 'sub-1' } as Cognito;
      cognitoRepo.findOne.mockResolvedValue(cognito);

      const result = await service.findByEmail('a@b.com');

      expect(cognitoRepo.findOne).toHaveBeenCalledWith({
        where: { email: 'a@b.com' },
      });
      expect(result).toBe(cognito);
    });
  });

  describe('findValidInvitation', () => {
    it('filters by email, unaccepted, and unexpired', async () => {
      const invitation = { id: 'inv-1' } as Invitation;
      queryBuilder.getOne.mockResolvedValue(invitation);

      const result = await service.findValidInvitation('invited@b.com');

      expect(queryBuilder.where).toHaveBeenCalledWith(
        'invitation.email = :email',
        { email: 'invited@b.com' },
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'invitation.accepted_at IS NULL',
      );
      expect(queryBuilder.andWhere).toHaveBeenCalledWith(
        'invitation.expires_at > :now',
        expect.objectContaining({ now: expect.any(Date) }),
      );
      expect(result).toBe(invitation);
    });
  });

  describe('findTenantIdsForUser', () => {
    it('returns the tenant ids from tenant_users rows for the user', async () => {
      tenantUserRepo.find.mockResolvedValue([
        { tenantId: 't1' },
        { tenantId: 't2' },
      ] as TenantUser[]);

      const result = await service.findTenantIdsForUser('user-1');

      expect(tenantUserRepo.find).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
      expect(result).toEqual(['t1', 't2']);
    });
  });

  describe('createIdentity', () => {
    it('creates a cognito row and a user row, hashing the password, with no tenant/invitation side effects when no invitation is given', async () => {
      cognitoRepo.create.mockImplementation((v) => v as Cognito);
      cognitoRepo.save.mockResolvedValue({} as Cognito);
      const savedUser = { id: 'user-1', email: 'a@b.com' } as User;
      userRepo.create.mockImplementation((v) => v as User);
      userRepo.save.mockResolvedValue(savedUser);

      const result = await service.createIdentity({
        email: 'a@b.com',
        name: 'Alice',
        passwordPlain: 'plaintext-pw',
      });

      const cognitoCreateArg = cognitoRepo.create.mock.calls[0][0];
      expect(cognitoCreateArg.email).toBe('a@b.com');
      expect(cognitoCreateArg.password).not.toBe('plaintext-pw');
      expect(typeof cognitoCreateArg.sub).toBe('string');

      const userCreateArg = userRepo.create.mock.calls[0][0] as Partial<User>;
      expect(userCreateArg).toEqual({
        email: 'a@b.com',
        name: 'Alice',
        cognitoSub: cognitoCreateArg.sub,
      });

      expect(tenantUserRepo.save).not.toHaveBeenCalled();
      expect(invitationRepo.update).not.toHaveBeenCalled();
      expect(result).toBe(savedUser);
    });

    it('also grants tenant membership and marks the invitation accepted when provisioning from an invitation', async () => {
      cognitoRepo.create.mockImplementation((v) => v as Cognito);
      cognitoRepo.save.mockResolvedValue({} as Cognito);
      const savedUser = { id: 'user-1', email: 'invited@b.com' } as User;
      userRepo.create.mockImplementation((v) => v as User);
      userRepo.save.mockResolvedValue(savedUser);
      tenantUserRepo.create.mockImplementation((v) => v as TenantUser);
      tenantUserRepo.save.mockResolvedValue({} as TenantUser);

      const invitation = {
        id: 'inv-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
      } as Invitation;

      await service.createIdentity({
        email: 'invited@b.com',
        name: '',
        passwordPlain: 'the-temp-token',
        invitation,
      });

      expect(tenantUserRepo.create).toHaveBeenCalledWith({
        userId: 'user-1',
        tenantId: 'tenant-1',
        roleId: 'role-1',
      });
      expect(invitationRepo.update).toHaveBeenCalledWith(
        'inv-1',
        expect.objectContaining({ acceptedAt: expect.any(Date) }),
      );
    });

    it('reports a connectivity failure inside the transaction as a clean 503', async () => {
      dataSource.transaction.mockRejectedValue({ code: 'ECONNREFUSED' });

      await expect(
        service.createIdentity({
          email: 'a@b.com',
          name: 'Alice',
          passwordPlain: 'plaintext-pw',
        }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });
});
