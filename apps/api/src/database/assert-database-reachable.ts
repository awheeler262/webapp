import { Logger } from '@nestjs/common';
import { DataSource } from 'typeorm';

const logger = new Logger('Database');
const CONNECTION_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

// TypeOrmModule's own default retry loop (10 attempts, 3s apart) buries the real
// error under generic "Retrying..." logs and eventually crashes the process with a
// raw stack trace. Testing the connection here first lets us fail fast with a clear,
// actionable message instead.
export async function assertDatabaseReachable(url: string | undefined) {
  for (let attempt = 1; attempt <= CONNECTION_ATTEMPTS; attempt++) {
    const probe = new DataSource({ type: 'postgres', url });
    try {
      await probe.initialize();
      await probe.destroy();
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(`Database connection attempt ${attempt}/${CONNECTION_ATTEMPTS} failed: ${message}`);
      if (attempt === CONNECTION_ATTEMPTS) {
        logger.error('Could not connect to the database. Check DATABASE_URL in apps/api/.env.');
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
    }
  }
}
