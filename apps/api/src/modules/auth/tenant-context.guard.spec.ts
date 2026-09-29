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
      findTenantUserRole: jest.fn(),
      roleExists: jest.fn(),
      logDevopsAccess: jest.fn(),
    } as unknown as jest.Mocked<CognitoService>;
    guard = new TenantContextGuard(cognito);
  });

  it('throws BadRequestException when X-Tenant-Id or X-Role-Id is missing', async () => {
    const context = contextFor({
      user: { id: 'u1', isDevops: false },
      headers: { 'x-tenant-id': 'tenant-1' },
    });

    await expect(guard.canActivate(context)).rejects.toThrow(
      BadRequestException,
    );
  });

  describe('for a regular (non-devops) user', () => {
    it('allows the request when the header role matches tenant_users', async () => {
      cognito.findTenantUserRole.mockResolvedValue('role-1');
      const context = contextFor({
        user: { id: 'u1', isDevops: false },
        headers: { 'x-tenant-id': 'tenant-1', 'x-role-id': 'role-1' },
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(cognito.findTenantUserRole).toHaveBeenCalledWith('u1', 'tenant-1');
      expect(cognito.logDevopsAccess).not.toHaveBeenCalled();
    });

    it('rejects when the user has no membership in that tenant', async () => {
      cognito.findTenantUserRole.mockResolvedValue(null);
      const context = contextFor({
        user: { id: 'u1', isDevops: false },
        headers: { 'x-tenant-id': 'tenant-1', 'x-role-id': 'role-1' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('rejects when the header role does not match the actual assigned role', async () => {
      cognito.findTenantUserRole.mockResolvedValue('role-1');
      const context = contextFor({
        user: { id: 'u1', isDevops: false },
        headers: { 'x-tenant-id': 'tenant-1', 'x-role-id': 'role-2' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('for a devops user', () => {
    it('allows the request when the role exists for that tenant, and logs the access', async () => {
      cognito.roleExists.mockResolvedValue(true);
      const context = contextFor({
        user: { id: 'devops-1', isDevops: true },
        headers: { 'x-tenant-id': 'tenant-9', 'x-role-id': 'role-9' },
        method: 'GET',
        originalUrl: '/api/tenants/tenant-9/roles',
      });

      await expect(guard.canActivate(context)).resolves.toBe(true);
      expect(cognito.roleExists).toHaveBeenCalledWith('tenant-9', 'role-9');
      expect(cognito.findTenantUserRole).not.toHaveBeenCalled();
      expect(cognito.logDevopsAccess).toHaveBeenCalledWith({
        userId: 'devops-1',
        tenantId: 'tenant-9',
        roleId: 'role-9',
        method: 'GET',
        path: '/api/tenants/tenant-9/roles',
      });
    });

    it('rejects when the role does not exist for that tenant, and does not log', async () => {
      cognito.roleExists.mockResolvedValue(false);
      const context = contextFor({
        user: { id: 'devops-1', isDevops: true },
        headers: { 'x-tenant-id': 'tenant-9', 'x-role-id': 'nonexistent' },
      });

      await expect(guard.canActivate(context)).rejects.toThrow(
        ForbiddenException,
      );
      expect(cognito.logDevopsAccess).not.toHaveBeenCalled();
    });
  });
});
