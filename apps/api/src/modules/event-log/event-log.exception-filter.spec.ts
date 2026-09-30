import {
  ArgumentsHost,
  ForbiddenException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { AbstractHttpAdapter } from '@nestjs/core';
import { EventLogExceptionFilter } from './event-log.exception-filter';
import { EventLogService } from './event-log.service';

// catch() is deliberately synchronous/void (see the class's comment) and
// chains super.catch() inside a .then() rather than awaiting internally, so
// tests need to flush pending microtasks after calling it before asserting.
function flush(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

function hostFor(request: unknown): ArgumentsHost {
  const response = {};
  return {
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
    }),
    getArgByIndex: (i: number) => (i === 1 ? response : request),
  } as unknown as ArgumentsHost;
}

describe('EventLogExceptionFilter', () => {
  let filter: EventLogExceptionFilter;
  let eventLog: jest.Mocked<EventLogService>;
  let applicationRef: jest.Mocked<AbstractHttpAdapter>;

  beforeEach(() => {
    eventLog = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventLogService>;
    applicationRef = {
      isHeadersSent: jest.fn().mockReturnValue(false),
      reply: jest.fn(),
      end: jest.fn(),
    } as unknown as jest.Mocked<AbstractHttpAdapter>;
    filter = new EventLogExceptionFilter(applicationRef, eventLog);
  });

  it('logs the HttpException status/context and still sends the normal error response', async () => {
    const request = {
      user: { id: 'user-1' },
      tenantContext: { tenantId: 't1', roleId: 'r1' },
      method: 'GET',
      path: '/api/tenants',
      ip: '203.0.113.1',
      socket: { remoteAddress: '203.0.113.1' },
    };
    const exception = new ForbiddenException();

    filter.catch(exception, hostFor(request));
    await flush();

    expect(eventLog.record).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: 't1',
      roleId: 'r1',
      method: 'GET',
      path: '/api/tenants',
      statusCode: 403,
      error: null,
      ipAddress: '203.0.113.1',
    });
    expect(applicationRef.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      403,
    );
  });

  it('logs a rejected guard (no req.user) as status 401 with a null userId', async () => {
    const request = {
      method: 'GET',
      path: '/api/tenants',
      socket: { remoteAddress: '203.0.113.1' },
    };
    const exception = new UnauthorizedException();

    filter.catch(exception, hostFor(request));
    await flush();

    expect(eventLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null, statusCode: 401 }),
    );
  });

  it('logs status 500 for a non-HttpException error and still delegates to the base handler', async () => {
    const request = {
      method: 'GET',
      path: '/api/tenants',
      socket: { remoteAddress: '203.0.113.1' },
    };
    const exception = new Error('boom');

    filter.catch(exception, hostFor(request));
    await flush();

    expect(eventLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ statusCode: 500, error: 'Error: boom' }),
    );
    expect(applicationRef.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      500,
    );
  });

  it('logs the cause chain for a 503 but sends the client only the generic message', async () => {
    const request = {
      method: 'POST',
      path: '/api/boost',
      socket: { remoteAddress: '203.0.113.1' },
    };
    const exception = new ServiceUnavailableException('Boost unavailable', {
      cause: new Error(
        'BOOST_LAMBDA_FUNCTION_NAME environment variable is not set',
      ),
    });

    filter.catch(exception, hostFor(request));
    await flush();

    expect(eventLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 503,
        error:
          'ServiceUnavailableException: Boost unavailable <- Error: BOOST_LAMBDA_FUNCTION_NAME environment variable is not set',
      }),
    );
    expect(applicationRef.reply).toHaveBeenCalledWith(
      expect.anything(),
      expect.not.stringContaining('BOOST_LAMBDA_FUNCTION_NAME'),
      503,
    );
  });
});
