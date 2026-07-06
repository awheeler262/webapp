import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';

describe('UsersService', () => {
  let service: UsersService;
  let repository: jest.Mocked<Repository<User>>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: getRepositoryToken(User),
          useValue: {
            create: jest.fn(),
            save: jest.fn(),
            findOne: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get(UsersService);
    repository = module.get(getRepositoryToken(User));
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
});
