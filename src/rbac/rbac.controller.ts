import { Controller, Get, Param } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { Public } from '../public.decorator';

@Controller('api')
export class RbacController {
  constructor(private readonly rbacService: RbacService) {}

  @Public()
  @Get('rbac/roles')
  async getActiveRoles() {
    const roles = await this.rbacService.getActiveRoles();
    return { roles };
  }

  @Public()
  @Get('rbac/roles/:role/permissions')
  async getRolePermissions(@Param('role') roleParam: string) {
    const matrix = await this.rbacService.getRolePermissionMatrix(String(roleParam));
    return matrix;
  }
}
