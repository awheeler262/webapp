import { Test, TestingModule } from '@nestjs/testing';
import { ServiceUnavailableException } from '@nestjs/common';
import { Repository } from 'typeorm';
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

  describe('findByCognitoSub', () => {
    it('queries by cognitoSub and returns the full entity', async () => {
      const user = {
        id: '1',
        email: 'alice@example.com',
        cognitoSub: 'sub-1',
      } as User;
      repository.findOne.mockResolvedValue(user);

      const result = await service.findByCognitoSub('sub-1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { cognitoSub: 'sub-1' },
      });
      expect(result).toBe(user);
    });

    it('returns null when no user matches', async () => {
      repository.findOne.mockResolvedValue(null);

      const result = await service.findByCognitoSub('nonexistent-sub');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('queries by id with a narrowed select that excludes cognitoSub', async () => {
      const user = {
        id: '1',
        email: 'alice@example.com',
        name: 'Alice',
        createdAt: new Date(),
      } as User;
      repository.findOne.mockResolvedValue(user);

      const result = await service.findById('1');

      expect(repository.findOne).toHaveBeenCalledWith({
        where: { id: '1' },
        select: {
          id: true,
          email: true,
          name: true,
          isDevops: true,
          createdAt: true,
        },
      });
      expect(result).toBe(user);
    });
  });

  // Covers a connection that was live (isInitialized stays true) but has since
  // died -- getRepo()/ensureInitialized never sees this, only the query call does.
  describe('when the database becomes unavailable mid-connection', () => {
    it('reports findByCognitoSub as a clean 503 instead of the raw connectivity error', async () => {
      repository.findOne.mockRejectedValue({ code: 'ECONNREFUSED' });

      await expect(service.findByCognitoSub('sub-1')).rejects.toThrow(
        ServiceUnavailableException,
      );
    });

    it('does not reclassify a genuine application-level error (e.g. a unique-constraint race)', async () => {
      const conflictError = { code: '23505', message: 'duplicate key value' };
      repository.findOne.mockRejectedValue(conflictError);

      await expect(service.findByCognitoSub('sub-1')).rejects.toBe(
        conflictError,
      );
    });
  });
});
