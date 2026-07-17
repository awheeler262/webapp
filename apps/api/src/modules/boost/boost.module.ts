import { Module } from '@nestjs/common';
import { LambdaClient } from '@aws-sdk/client-lambda';
import { ConfigModule } from '../../config/config.module';
import { BoostController } from './boost.controller';
import { BoostService } from './boost.service';
import { LAMBDA_CLIENT } from './boost.constants';

@Module({
  imports: [ConfigModule],
  providers: [
    { provide: LAMBDA_CLIENT, useValue: new LambdaClient({}) },
    BoostService,
  ],
  controllers: [BoostController],
  exports: [],
})
export class BoostModule {}
