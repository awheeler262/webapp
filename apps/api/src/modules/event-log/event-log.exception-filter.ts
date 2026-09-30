import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { AbstractHttpAdapter, BaseExceptionFilter } from '@nestjs/core';
import { EventLogService } from './event-log.service';
import { formatError } from './format-error';
import { logRequest, LoggableRequest } from './log-request';

// Catches everything (guard rejections, pipe validation failures, handler
// exceptions) -- the one stage of the request pipeline every error passes
// through, unlike EventLogInterceptor which only sees the success path (see
// its comment for why). Delegates to BaseExceptionFilter for the actual
// error response so Nest's normal error formatting/behavior is unchanged --
// this only adds the event_log write.
@Catch()
export class EventLogExceptionFilter extends BaseExceptionFilter {
  constructor(
    applicationRef: AbstractHttpAdapter,
    private eventLog: EventLogService,
  ) {
    super(applicationRef);
  }

  // BaseExceptionFilter.catch() is declared void, not Promise<void> -- the
  // log write still has to finish before the response goes out (see the
  // module-level comment on the Lambda constraint this mirrors from
  // EventLogInterceptor), so this chains super.catch() inside the promise
  // instead of making the override itself async.
  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<LoggableRequest>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    // Internal detail, so only kept for server errors and never sent to the
    // client -- BaseExceptionFilter builds the response independently.
    const error = status >= 500 ? formatError(exception) : null;
    void logRequest(this.eventLog, request, status, error).then(() => {
      super.catch(exception, host);
    });
  }
}
