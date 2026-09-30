import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { EventLog } from './entities/event-log.entity';
import { ensureInitialized } from '../../database/database.providers';
import { DATA_SOURCE } from '../../database/database.module';

export type EventLogEntry = {
  userId: string | null;
  tenantId: string | null;
  roleId: string | null;
  isDevops: boolean;
  method: string;
  path: string;
  statusCode: number;
  ipAddress: string | null;
};

@Injectable()
export class EventLogService {
  private readonly logger = new Logger(EventLogService.name);

  constructor(@Inject(DATA_SOURCE) private dataSource: DataSource) {}

  // Never throws -- a logging failure must never fail the actual request. On
  // any write failure (most commonly the database being unreachable, which is
  // exactly the one case this table can't record itself), falls back to
  // Logger.error (Lambda ships console.error to CloudWatch) with the same
  // context plus the error, rather than losing the entry silently.
  async record(entry: EventLogEntry): Promise<void> {
    try {
      const dataSource = await ensureInitialized(this.dataSource);
      const repo = dataSource.getRepository(EventLog);
      await repo.save(repo.create(entry));
    } catch (err) {
      this.logger.error(
        `event_log write failed: ${JSON.stringify(entry)}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
