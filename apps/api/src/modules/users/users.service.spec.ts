import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';
import { DATA_SOURCE } from '../../database/database.module';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      save: jest.fn(),
      findOne: jest.fn(),
    } as unknown as jest.Mocked<Repository<User>>;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: DATA_SOURCE,
          useValue: {
            isInitialized: true,
            getRepository: jest.fn().mockReturnValue(repository),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('create', () => {
    const dto = { email: 'alice@example.com', name: 'Alice', password: 'plaintext-pw' };

    it('hashes the password before persisting it', async () => {
      const saved = {
        id: 'uuid-1',
        email: dto.email,
        name: dto.name,
        password: 'irrelevant-return-value',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;
      repository.create.mockReturnValue(saved);
      repository.save.mockResolvedValue(saved);

      await service.create(dto as any);

      const createArg = repository.create.mock.calls[0][0] as Partial<User>;
      expect(createArg.password).not.toBe(dto.password);
      expect(await bcrypt.compare(dto.password, createArg.password!)).toBe(true);
      expect(repository.save).toHaveBeenCalledWith(saved);
    });

    it('never returns the password hash or updatedAt', async () => {
      const saved = {
        id: 'uuid-1',
        email: dto.email,
        name: dto.name,
        password: 'hashed-value',
        createdAt: new Date(),
        updatedAt: new Date(),
      } as User;
      repository.create.mockReturnValue(saved);
      repository.save.mockResolvedValue(saved);

      const result = await service.create(dto as any);

      expect(result).toEqual({
        id: saved.id,
        email: saved.email,
        name: saved.name,
        createdAt: saved.createdAt,
      });
      expect(result).not.toHaveProperty('password');
      expect(result).not.toHaveProperty('updatedAt');
    });
  });

  describe('findByEmail', () => {
    it('queries by email and returns the full entity, including the password hash', async () => {
      const user = { id: '1', email: 'alice@example.com', password: 'hashed' } as User;
      repository.findOne.mockResolvedValue(user);

      const result = await service.findByEmail('alice@example.com');

      expect(repository.findOne).toHaveBeenCalledWith({ where: { email: 'alice@example.com' } });
      expect(result).toBe(user);
    });

    it('returns null when no user matches', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByEmail('nobody@example.com');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('queries by id with a narrowed select that excludes the password', async () => {
      const user = { id: '1', email: 'alice@example.com', name: 'Alice', createdAt: new Date() } as User;
      repository.findOne.mockResolvedValue(user);

      const result = await service.findById('1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        select: { id: true, email: true, name: true, createdAt: true },
      });
      expect(result).toBe(user);
    });
  });

  // Covers a connection that was live (isInitialized stays true) but has since
  // died -- getRepo()/ensureInitialized never sees this, only the query call does.
  describe('when the database becomes unavailable mid-connection', () => {
    it('reports findByEmail as a clean 503 instead of the raw connectivity error', async () => {
      repository.findOne.mockRejectedValue({ code: 'ECONNREFUSED' });

      await expect(service.findByEmail('alice@example.com')).rejects.toThrow(ServiceUnavailableException);
    });

    it('reports create as a clean 503 instead of the raw connectivity error', async () => {
      const dto = { email: 'alice@example.com', name: 'Alice', password: 'plaintext-pw' };
      repository.create.mockReturnValue({} as User);
      repository.save.mockRejectedValue({ driverError: { code: '08006' } });

      await expect(service.create(dto as any)).rejects.toThrow(ServiceUnavailableException);
    });

    it('does not reclassify a genuine application-level error (e.g. a unique-constraint race)', async () => {
      const dto = { email: 'alice@example.com', name: 'Alice', password: 'plaintext-pw' };
      const conflictError = { code: '23505', message: 'duplicate key value' };
      repository.create.mockReturnValue({} as User);
      repository.save.mockRejectedValue(conflictError);

      await expect(service.create(dto as any)).rejects.toBe(conflictError);
    });
  });
});
