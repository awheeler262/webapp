import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../src/modules/users/entities/user.entity';

// AppDataSource is a manually-provided value, not a TypeOrmModule-managed
// connection -- app.close() doesn't know to tear it down, so the open pg
// pool would otherwise keep the Jest worker from exiting cleanly.
export async function cleanupTestUser(dataSource: DataSource, email: string, app: INestApplication) {
  await dataSource.getRepository(User).delete({ email });
  await app.close();
  await dataSource.destroy();
}
