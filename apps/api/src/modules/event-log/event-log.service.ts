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

// EventLogInterceptor/EventLogExceptionFilter await record() on every request,
// including ones that never otherwise touch the database (e.g. /api/health,
// or a JwtAuthGuard rejection) -- those routes are deliberately DB-independent
// (see database.providers.ts), so this can't be allowed to inherit the shared
// DataSource's full 3000ms connectionTimeoutMillis on every request during an
// outage. Capped well below that instead: a best-effort audit log losing a
// handful of entries to a race is an acceptable trade, unlike the real
// business-critical writes elsewhere that legitimately need the full budget.
const WRITE_TIMEOUT_MS = 300;

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
      await Promise.race([this.write(entry), this.timeout()]);
    } catch (err) {
      this.logger.error(
        `event_log write failed: ${JSON.stringify(entry)}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }

  private async write(entry: EventLogEntry): Promise<void> {
    const dataSource = await ensureInitialized(this.dataSource);
    const repo = dataSource.getRepository(EventLog);
    await repo.save(repo.create(entry));
  }

  private timeout(): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(
        () => reject(new Error('event_log write timed out')),
        WRITE_TIMEOUT_MS,
      ),
    );
  }
}
