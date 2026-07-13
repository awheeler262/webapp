import { Module } from '@nestjs/common';
import { AppDataSource } from './database.providers';

export const DATA_SOURCE = 'DATA_SOURCE';

@Module({
  providers: [{ provide: DATA_SOURCE, useValue: AppDataSource }],
  exports: [DATA_SOURCE],
})
export class DatabaseModule {}
