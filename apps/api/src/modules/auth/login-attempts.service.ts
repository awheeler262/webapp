import { Inject, Injectable, Logger } from '@nestjs/common';
import { DataSource, MoreThan } from 'typeorm';
import { LoginAttempt } from './entities/login-attempt.entity';
import { ensureInitialized } from '../../database/database.providers';
import { DATA_SOURCE } from '../../database/database.module';

const EMAIL_LIMIT = 5;
const IP_LIMIT = 20;
const WINDOW_MS = 15 * 60 * 1000;

@Injectable()
export class LoginAttemptsService {
  private readonly logger = new Logger(LoginAttemptsService.name);

  constructor(@Inject(DATA_SOURCE) private dataSource: DataSource) {}

  // Fail-open: a defense-in-depth secondary control that can't render a
  // verdict shouldn't block a legitimate login. AuthService.login()'s own DB
  // calls still correctly 503 on a real outage regardless of what this
  // returns -- this only decides whether the throttle itself trips.
  // email is nullable -- LoginThrottleGuard runs before LoginDto's
  // ValidationPipe, so the submitted body may not have a usable email yet.
  // The IP-dimension check still applies regardless.
  async isBlocked(email: string | null, ip: string | null): Promise<boolean> {
    try {
      const dataSource = await ensureInitialized(this.dataSource);
      const repo = dataSource.getRepository(LoginAttempt);
      const since = new Date(Date.now() - WINDOW_MS);

      if (email) {
        const emailCount = await repo.count({
          where: { email, createdAt: MoreThan(since) },
        });
        if (emailCount >= EMAIL_LIMIT) return true;
      }

      if (ip) {
        const ipCount = await repo.count({
          where: { ipAddress: ip, createdAt: MoreThan(since) },
        });
        if (ipCount >= IP_LIMIT) return true;
      }

      return false;
    } catch (err) {
      this.logger.error(
        `login_attempts threshold check failed for email=${email}`,
        err instanceof Error ? err.stack : String(err),
      );
      return false;
    }
  }

  async recordFailure(email: string, ip: string | null): Promise<void> {
    try {
      const dataSource = await ensureInitialized(this.dataSource);
      const repo = dataSource.getRepository(LoginAttempt);
      await repo.save(repo.create({ email, ipAddress: ip }));
    } catch (err) {
      this.logger.error(
        `login_attempts write failed for email=${email}`,
        err instanceof Error ? err.stack : String(err),
      );
    }
  }
}
