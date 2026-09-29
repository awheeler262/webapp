import { INestApplication } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { User } from '../../src/modules/users/entities/user.entity';
import { Cognito } from '../../src/modules/auth/entities/cognito.entity';

// AppDataSource is a manually-provided value, not a TypeOrmModule-managed
// connection -- app.close() doesn't know to tear it down, so the open pg
// pool would otherwise keep the Jest worker from exiting cleanly.
export async function cleanupTestUser(
  dataSource: DataSource,
  email: string,
  app: INestApplication,
) {
  // users has no DB-level FK to cognito (they're linked by sub/cognito_sub
  // values only), so deleting the user row doesn't cascade -- clean up both.
  await dataSource.getRepository(User).delete({ email });
  await dataSource.getRepository(Cognito).delete({ email });
  await app.close();
  await dataSource.destroy();
}
