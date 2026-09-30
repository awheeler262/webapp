import {
  BadRequestException,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import type { Request } from 'express';
import { CognitoService } from './cognito.service';

export type TenantContext = {
  tenantId: string;
  roleId: string;
  isDevops: boolean;
};

// Runs after JwtAuthGuard -- req.user must already be populated. Every
// tenant-scoped route carries X-Tenant-Id/X-Role-Id headers rather than
// baking tenant/role into the JWT, so context can change per request without
// re-issuing a token. See apps/api/sql/cognito-schema.sql and the design
// notes in cognito.service.ts for why.
@Injectable()
export class TenantContextGuard implements CanActivate {
  constructor(private cognito: CognitoService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context
      .switchToHttp()
      .getRequest<Request & { tenantContext?: TenantContext }>();
    const user = request.user as { id: string; isDevops?: boolean } | undefined;
    if (!user) throw new ForbiddenException();

    const tenantId = request.headers['x-tenant-id'];
    const roleId = request.headers['x-role-id'];
    if (typeof tenantId !== 'string' || typeof roleId !== 'string') {
      throw new BadRequestException(
        'X-Tenant-Id and X-Role-Id headers are required',
      );
    }

    const isDevops = user.isDevops === true;
    if (isDevops) {
      if (!(await this.cognito.roleExists(tenantId, roleId))) {
        throw new ForbiddenException();
      }
    } else {
      if (!(await this.cognito.hasTenantUserRole(user.id, tenantId, roleId))) {
        throw new ForbiddenException();
      }
    }

    request.tenantContext = { tenantId, roleId, isDevops };
    return true;
  }
}
