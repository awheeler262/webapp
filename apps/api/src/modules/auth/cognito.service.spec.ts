import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { CognitoService } from './cognito.service';
import { Cognito } from './entities/cognito.entity';
import { Invitation } from './entities/invitation.entity';
import { Tenant } from './entities/tenant.entity';
import { Role } from './entities/role.entity';
import { TenantUser } from './entities/tenant-user.entity';
import { User } from '../users/entities/user.entity';
import { DATA_SOURCE } from '../../database/database.module';

describe('CognitoService', () => {
  let service: CognitoService;
  let cognitoRepo: jest.Mocked<Repository<Cognito>>;
  let invitationRepo: jest.Mocked<Repository<Invitation>>;
  let tenantRepo: jest.Mocked<Repository<Tenant>>;
  let roleRepo: jest.Mocked<Repository<Role>>;
  let tenantUserRepo: jest.Mocked<Repository<TenantUser>>;
  let userRepo: jest.Mocked<Repository<User>>;
  let queryBuilder: {
    where: jest.Mock;
    andWhere: jest.Mock;
    orderBy: jest.Mock;
    getOne: jest.Mock;
  };
  let roleJoinQb: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    getRawMany: jest.Mock;
  };
  let tenantUserJoinQb: {
    innerJoin: jest.Mock;
    where: jest.Mock;
    select: jest.Mock;
    addSelect: jest.Mock;
    getRawMany: jest.Mock;
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
      orderBy: jest.fn().mockReturnThis(),
      getOne: jest.fn(),
    };
    invitationRepo = {
      createQueryBuilder: jest.fn().mockReturnValue(queryBuilder),
      update: jest.fn(),
    } as unknown as jest.Mocked<Repository<Invitation>>;
    tenantRepo = {
      find: jest.fn(),
    } as unknown as jest.Mocked<Repository<Tenant>>;
    roleJoinQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    tenantUserJoinQb = {
      innerJoin: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      addSelect: jest.fn().mockReturnThis(),
      getRawMany: jest.fn().mockResolvedValue([]),
    };
    roleRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(roleJoinQb),
    } as unknown as jest.Mocked<Repository<Role>>;
    tenantUserRepo = {
      find: jest.fn(),
      findOne: jest.fn(),
      create: jest.fn(),
      save: jest.fn(),
      createQueryBuilder: jest.fn().mockReturnValue(tenantUserJoinQb),
    } as unknown as jest.Mocked<Repository<TenantUser>>;
    userRepo = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    const reposByEntity = new Map<unknown, unknown>([
      [Cognito, cognitoRepo],
      [Invitation, invitationRepo],
      [Tenant, tenantRepo],
      [Role, roleRepo],
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
      expect(queryBuilder.orderBy).toHaveBeenCalledWith(
        'invitation.expires_at',
        'ASC',
      );
      expect(result).toBe(invitation);
    });
  });

  describe('findAvailableTenants', () => {
    it('queries tenant_users joined to tenant and roles, scoped to that user', async () => {
      const rows = [
        { tenantId: 't1', tenantName: 'SALT', roleId: 'r1', roleName: 'STAFF' },
      ];
      tenantUserJoinQb.getRawMany.mockResolvedValue(rows);

      const result = await service.findAvailableTenants({
        id: 'user-1',
      });

      expect(tenantUserRepo.createQueryBuilder).toHaveBeenCalledWith(
        'tenantUser',
      );
      expect(tenantUserJoinQb.where).toHaveBeenCalledWith(
        'tenantUser.user_id = :userId',
        { userId: 'user-1' },
      );
      expect(roleRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(result).toBe(rows);
    });

    it('reports a connectivity failure as a clean 503', async () => {
      tenantUserJoinQb.getRawMany.mockRejectedValue({ code: 'ECONNREFUSED' });

      await expect(
        service.findAvailableTenants({ id: 'user-1' }),
      ).rejects.toThrow(ServiceUnavailableException);
    });
  });

  describe('hasTenantUserRole', () => {
    // Queries the exact tuple rather than fetching *a* row for (user, tenant)
    // and comparing roleId separately -- a user can hold several roles in the
    // same tenant, so they'd otherwise get an arbitrary row back and could be
    // spuriously rejected for a role they actually hold.
    it('is true when the exact (user, tenant, role) tuple is on file', async () => {
      tenantUserRepo.findOne.mockResolvedValue({} as TenantUser);

      const result = await service.hasTenantUserRole(
        'user-1',
        'tenant-1',
        'role-1',
      );

      expect(tenantUserRepo.findOne).toHaveBeenCalledWith({
        where: { userId: 'user-1', tenantId: 'tenant-1', roleId: 'role-1' },
      });
      expect(result).toBe(true);
    });

    it('is false when the user is not a member of that tenant', async () => {
      tenantUserRepo.findOne.mockResolvedValue(null);

      const result = await service.hasTenantUserRole(
        'user-1',
        'tenant-1',
        'role-1',
      );

      expect(result).toBe(false);
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
