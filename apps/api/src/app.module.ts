import { Module, Logger } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PostsModule } from './modules/posts/posts.module';

const logger = new Logger('Database');
const CONNECTION_ATTEMPTS = 3;
const RETRY_DELAY_MS = 2000;

async function assertDatabaseReachable(url: string | undefined) {
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

@Module({
  imports: [
    TypeOrmModule.forRootAsync({
      useFactory: async () => {
        await assertDatabaseReachable(process.env.DATABASE_URL);
        return {
          type: 'postgres',
          url: process.env.DATABASE_URL,
          autoLoadEntities: true,
          synchronize: process.env.NODE_ENV !== 'production',
        };
      },
    }),
    AuthModule,
    UsersModule,
    PostsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
