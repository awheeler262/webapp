import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { HTTP_CODE_METADATA } from '@nestjs/common/constants';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { Observable, mergeMap } from 'rxjs';
import { EventLogService } from './event-log.service';
import { logRequest, LoggableRequest } from './log-request';

// Success path only -- a rejected guard (e.g. JwtAuthGuard with no/bad token)
// throws *before* any interceptor is invoked at all (Nest's pipeline is
// Guards -> Interceptors -> Pipes -> Handler), so this can never see or log
// a guard rejection. EventLogExceptionFilter covers every error case
// (guards, pipes, and the handler itself) uniformly instead.
@Injectable()
export class EventLogInterceptor implements NestInterceptor {
  constructor(
    private eventLog: EventLogService,
    private reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<LoggableRequest>();

    return next.handle().pipe(
      mergeMap(async (body: unknown) => {
        await logRequest(
          this.eventLog,
          request,
          this.successStatus(context, request),
        );
        return body;
      }),
    );
  }

  // Nest writes the response's real status code *after* interceptors resolve,
  // so response.statusCode isn't reliable to read from here -- resolve it the
  // same way Nest's own RouterResponseController does: @HttpCode() metadata,
  // falling back to its default-by-method (201 for POST, 200 otherwise).
  private successStatus(context: ExecutionContext, request: Request): number {
    const explicit = this.reflector.get<number | undefined>(
      HTTP_CODE_METADATA,
      context.getHandler(),
    );
    if (explicit !== undefined) return explicit;
    return request.method === 'POST' ? 201 : 200;
  }
}
