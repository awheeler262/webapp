import {
  ExecutionContext,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { TenantContextGuard } from './tenant-context.guard';
import { CognitoService } from './cognito.service';

function contextFor(request: {
  user?: unknown;
  headers?: Record<string, string>;
  method?: string;
  originalUrl?: string;
}): ExecutionContext {
  const req = {
    user: request.user,
    headers: request.headers ?? {},
    method: request.method ?? 'GET',
    originalUrl: request.originalUrl ?? '/api/tenants',
  };
  return {
    switchToHttp: () => ({ getRequest: () => req }),
  } as unknown as ExecutionContext;
}

describe('TenantContextGuard', () => {
  let guard: TenantContextGuard;
  let cognito: jest.Mocked<CognitoService>;

  beforeEach(() => {
    cognito = {
      hasTenantUserRole: jest.fn(),
    } as unknown as jest.Mocked<CognitoService>;
    guard = new TenantContextGuard(cognito);
  });

  it('throws BadRequestException when X-Tenant-Id or X-Role-Id is missing', async () => {
    const context = contextFor({
      user: { id: 'u1' },
      headers: { 'x-tenant-id': 'tenant-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('for a user', () => {
    it('allows the request when the header role matches tenant_users', async () => {
      cognito.hasTenantUserRole.mockResolvedValue(true);
      const context = contextFor({
        user: { id: 'u1' },
        headers: { 'x-tenant-id': 'tenant-1', 'x-role-id': 'role-1' },
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(cognito.hasTenantUserRole).toHaveBeenCalledWith(
        'u1',
        'tenant-1',
        'role-1',
      );
    });

    it('rejects when the user has no membership in that tenant', async () => {
      cognito.hasTenantUserRole.mockResolvedValue(false);
      const context = contextFor({
        user: { id: 'u1' },
        headers: { 'x-tenant-id': 'tenant-1', 'x-role-id': 'role-1' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects when the header role does not match the actual assigned role', async () => {
      cognito.hasTenantUserRole.mockResolvedValue(false);
      const context = contextFor({
        user: { id: 'u1' },
        headers: { 'x-tenant-id': 'tenant-1', 'x-role-id': 'role-2' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });
});
