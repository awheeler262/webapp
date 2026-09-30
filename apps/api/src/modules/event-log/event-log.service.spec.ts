import { Test, TestingModule } from '@nestjs/testing';
import { Logger } from '@nestjs/common';
import { Repository } from 'typeorm';
import { EventLogService } from './event-log.service';
import { EventLog } from './entities/event-log.entity';
import { DATA_SOURCE } from '../../database/database.module';

describe('EventLogService', () => {
  let service: EventLogService;
  let repo: jest.Mocked<Repository<EventLog>>;
  let dataSource: { isInitialized: boolean; getRepository: jest.Mock };

  const entry = {
    userId: 'user-1',
    tenantId: 'tenant-1',
    roleId: 'role-1',
    isDevops: false,
    method: 'GET',
    path: '/api/tenants',
    statusCode: 200,
    ipAddress: '203.0.113.1',
  };

  beforeEach(async () => {
    repo = {
      create: jest.fn(),
      save: jest.fn(),
    } as unknown as jest.Mocked<Repository<EventLog>>;
    dataSource = {
      isInitialized: true,
      getRepository: jest.fn().mockReturnValue(repo),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EventLogService,
        { provide: DATA_SOURCE, useValue: dataSource },
      ],
    }).compile();

    service = module.get(EventLogService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('inserts an event_log row', async () => {
    repo.create.mockImplementation((v) => v as EventLog);
    repo.save.mockResolvedValue({} as EventLog);

    await service.record(entry);

    expect(repo.create).toHaveBeenCalledWith(entry);
    expect(repo.save).toHaveBeenCalledWith(entry);
  });

  it('falls back to Logger.error instead of throwing when the write fails', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    repo.create.mockImplementation((v) => v as EventLog);
    repo.save.mockRejectedValue(new Error('connection refused'));

    await expect(service.record(entry)).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining('event_log write failed'),
      expect.any(String),
    );
    errorSpy.mockRestore();
  });
});
