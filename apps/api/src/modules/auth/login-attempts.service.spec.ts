import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { LoginAttemptsService } from './login-attempts.service';
import { LoginAttempt } from './entities/login-attempt.entity';
import { DATA_SOURCE } from '../../database/database.module';

describe('LoginAttemptsService', () => {
  let service: LoginAttemptsService;
  let repo: jest.Mocked<Repository<LoginAttempt>>;
  let dataSource: { isInitialized: boolean; getRepository: jest.Mock };

  beforeEach(async () => {
    repo = {
      count: jest.fn().mockResolvedValue(0),
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<LoginAttempt>>;
    dataSource = {
      isInitialized: true,
      getRepository: jest.fn().mockReturnValue(repo),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LoginAttemptsService,
        { provide: DATA_SOURCE, useValue: dataSource },
      ],
    }).compile();

    service = module.get(LoginAttemptsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('isBlocked', () => {
    it('is false when both counts are under their limits', async () => {
      repo.count.mockResolvedValue(0);

      const result = await service.isBlocked('a@b.com', '203.0.113.1');

      expect(result).toBe(false);
    });

    it('is true when the email has reached the email limit (5)', async () => {
      repo.count.mockImplementation((options) => {
        const where = options?.where as { email?: string };
        return Promise.resolve(where.email ? 5 : 0);
      });

      const result = await service.isBlocked('a@b.com', '203.0.113.1');

      expect(result).toBe(true);
    });

    it('is true when the IP has reached the IP limit (20), even with few email failures', async () => {
      repo.count.mockImplementation((options) => {
        const where = options?.where as { ipAddress?: string };
        return Promise.resolve(where.ipAddress ? 20 : 1);
      });

      const result = await service.isBlocked('a@b.com', '203.0.113.1');

      expect(result).toBe(true);
    });

    it('skips the email-dimension query when email is null', async () => {
      await service.isBlocked(null, '203.0.113.1');

      for (const call of repo.count.mock.calls) {
        expect(call[0]?.where).not.toHaveProperty('email');
      }
    });

    it('skips the IP-dimension query when ip is null', async () => {
      await service.isBlocked('a@b.com', null);

      for (const call of repo.count.mock.calls) {
        expect(call[0]?.where).not.toHaveProperty('ipAddress');
      }
    });

    it('fails open (returns false, does not throw) when the query errors', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      repo.count.mockRejectedValue(new Error('connection refused'));

      await expect(service.isBlocked('a@b.com', '203.0.113.1')).resolves.toBe(
        false,
      );

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });

  describe('recordFailure', () => {
    it('inserts a login_attempts row', async () => {
      repo.create.mockImplementation((v) => v as LoginAttempt);
      repo.save.mockResolvedValue({} as LoginAttempt);

      await service.recordFailure('a@b.com', '203.0.113.1');

      expect(repo.create).toHaveBeenCalledWith({
        email: 'a@b.com',
        ipAddress: '203.0.113.1',
      });
      expect(repo.save).toHaveBeenCalled();
    });

    it('never throws when the write fails', async () => {
      const errorSpy = jest
        .spyOn(Logger.prototype, 'error')
        .mockImplementation(() => undefined);
      repo.create.mockImplementation((v) => v as LoginAttempt);
      repo.save.mockRejectedValue(new Error('connection refused'));

      await expect(
        service.recordFailure('a@b.com', '203.0.113.1'),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalled();
      errorSpy.mockRestore();
    });
  });
});
