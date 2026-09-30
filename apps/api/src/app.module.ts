import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { BoostModule } from './modules/boost/boost.module';
import { TenantsModule } from './modules/tenants/tenants.module';
import { EventLogModule } from './modules/event-log/event-log.module';
import { DatabaseModule } from './database/database.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    DatabaseModule,
    AuthModule,
    UsersModule,
    BoostModule,
    TenantsModule,
    EventLogModule,
    HealthModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
