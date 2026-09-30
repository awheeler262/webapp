import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR, HttpAdapterHost } from '@nestjs/core';
import { EventLogService } from './event-log.service';
import { EventLogInterceptor } from './event-log.interceptor';
import { EventLogExceptionFilter } from './event-log.exception-filter';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [
    EventLogService,
    { provide: APP_INTERCEPTOR, useClass: EventLogInterceptor },
    {
      provide: APP_FILTER,
      useFactory: (
        httpAdapterHost: HttpAdapterHost,
        eventLog: EventLogService,
      ) => new EventLogExceptionFilter(httpAdapterHost.httpAdapter, eventLog),
      inject: [HttpAdapterHost, EventLogService],
    },
  ],
})
export class EventLogModule {}
