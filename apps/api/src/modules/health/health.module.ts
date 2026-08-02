import { Module } from '@nestjs/common';
import { ConfigModule } from '../../config/config.module';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

@Module({
  imports: [ConfigModule],
  providers: [HealthService],
  controllers: [HealthController],
  exports: [],
})
export class HealthModule {}
