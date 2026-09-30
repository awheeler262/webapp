import type { Request } from 'express';
import { EventLogService } from './event-log.service';
import { TenantContext } from '../auth/tenant-context.guard';

export type LoggableRequest = Request & {
  user?: { id: string };
  tenantContext?: TenantContext;
};

export function logRequest(
  eventLog: EventLogService,
  request: LoggableRequest,
  statusCode: number,
  error: string | null = null,
): Promise<void> {
  return eventLog.record({
    userId: request.user?.id ?? null,
    tenantId: request.tenantContext?.tenantId ?? null,
    roleId: request.tenantContext?.roleId ?? null,
    method: request.method,
    path: request.path,
    statusCode,
    error,
    // Same source as BoostController's extractProxyRequest (sourceIp) -- req.ip
    // falls back to the raw socket peer when there's no trust-proxy config.
    ipAddress: request.ip ?? request.socket.remoteAddress ?? null,
  });
}
