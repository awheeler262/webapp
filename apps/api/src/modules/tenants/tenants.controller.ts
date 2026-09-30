import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  UseGuards,
} from '@nestjs/common';
import { CognitoService } from '../auth/cognito.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { DevopsGuard } from '../auth/devops.guard';

@Controller('tenants')
@UseGuards(JwtAuthGuard, DevopsGuard)
export class TenantsController {
  constructor(private cognito: CognitoService) {}

  @Get()
  listTenants() {
    return this.cognito.listTenants();
  }

  @Get(':tenantId/roles')
  listRoles(@Param('tenantId', ParseUUIDPipe) tenantId: string) {
    return this.cognito.listRolesForTenant(tenantId);
  }
}
