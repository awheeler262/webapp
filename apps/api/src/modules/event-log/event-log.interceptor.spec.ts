import { ExecutionContext, HttpCode } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { of, firstValueFrom } from 'rxjs';
import { EventLogInterceptor } from './event-log.interceptor';
import { EventLogService } from './event-log.service';

class TestController {
  @HttpCode(204)
  withExplicitCode() {}

  withoutExplicitCode() {}
}

function contextFor(
  handler: () => unknown,
  request: {
    user?: { id: string };
    tenantContext?: {
      tenantId: string;
      roleId: string;
      isDevops: boolean;
    };
    method?: string;
    path?: string;
    ip?: string;
  },
): ExecutionContext {
  const req = {
    user: request.user,
    tenantContext: request.tenantContext,
    method: request.method ?? 'GET',
    path: request.path ?? '/api/tenants',
    ip: request.ip ?? '203.0.113.1',
    socket: { remoteAddress: '203.0.113.1' },
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
    getHandler: () => handler,
  } as unknown as ExecutionContext;
}

describe('EventLogInterceptor', () => {
  let interceptor: EventLogInterceptor;
  let eventLog: jest.Mocked<EventLogService>;

  beforeEach(() => {
    eventLog = {
      record: jest.fn().mockResolvedValue(undefined),
    } as unknown as jest.Mocked<EventLogService>;
    interceptor = new EventLogInterceptor(eventLog, new Reflector());
  });

  it('logs the @HttpCode()-declared status on success', async () => {
    const context = contextFor(TestController.prototype.withExplicitCode, {
      user: { id: 'user-1' },
      method: 'POST',
      path: '/api/things',
    });

    await firstValueFrom(
      interceptor.intercept(context, { handle: () => of({ ok: true }) }),
    );

    expect(eventLog.record).toHaveBeenCalledWith({
      userId: 'user-1',
      tenantId: null,
      roleId: null,
      isDevops: false,
      method: 'POST',
      path: '/api/things',
      statusCode: 204,
      ipAddress: '203.0.113.1',
    });
  });

  it('defaults to 201 for POST and 200 otherwise when there is no @HttpCode()', async () => {
    const postContext = contextFor(
      TestController.prototype.withoutExplicitCode,
      {
        method: 'POST',
        path: '/api/things',
      },
    );
    await firstValueFrom(
      interceptor.intercept(postContext, { handle: () => of({}) }),
    );
    expect(eventLog.record).toHaveBeenLastCalledWith(
      expect.objectContaining({ statusCode: 201 }),
    );

    const getContext = contextFor(
      TestController.prototype.withoutExplicitCode,
      {
        method: 'GET',
        path: '/api/things',
      },
    );
    await firstValueFrom(
      interceptor.intercept(getContext, { handle: () => of({}) }),
    );
    expect(eventLog.record).toHaveBeenLastCalledWith(
      expect.objectContaining({ statusCode: 200 }),
    );
  });

  it('includes tenantContext fields when TenantContextGuard has set them', async () => {
    const context = contextFor(TestController.prototype.withoutExplicitCode, {
      user: { id: 'devops-1' },
      tenantContext: { tenantId: 't1', roleId: 'r1', isDevops: true },
      method: 'GET',
      path: '/api/tenants',
    });

    await firstValueFrom(
      interceptor.intercept(context, { handle: () => of({}) }),
    );

    expect(eventLog.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'devops-1',
        tenantId: 't1',
        roleId: 'r1',
        isDevops: true,
      }),
    );
  });

  it('logs null userId for an anonymous request', async () => {
    const context = contextFor(TestController.prototype.withoutExplicitCode, {
      method: 'POST',
      path: '/api/auth/login',
    });

    await firstValueFrom(
      interceptor.intercept(context, { handle: () => of({}) }),
    );

    expect(eventLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ userId: null }),
    );
  });

  it('falls back to the socket remote address when req.ip is unset', async () => {
    const req = {
      method: 'GET',
      path: '/api/tenants',
      socket: { remoteAddress: '198.51.100.7' },
    };
    const context = {
      switchToHttp: () => ({ getRequest: () => req }),
      getHandler: () => TestController.prototype.withoutExplicitCode,
    } as unknown as ExecutionContext;

    await firstValueFrom(
      interceptor.intercept(context, { handle: () => of({}) }),
    );

    expect(eventLog.record).toHaveBeenCalledWith(
      expect.objectContaining({ ipAddress: '198.51.100.7' }),
    );
  });

  // Error-path logging (guard rejections, pipe failures, handler exceptions)
  // is covered by EventLogExceptionFilter, not this interceptor -- see its
  // spec and the comment atop event-log.interceptor.ts for why: a rejected
  // guard throws before any interceptor is ever invoked.
});
