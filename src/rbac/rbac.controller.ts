import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { RbacService } from './rbac.service';
import { Public } from '../public.decorator';
import type { UpdateRolePermissionsDto } from './dto/update-role-permissions.dto';

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
  @Public()
  @Patch('rbac/roles/:role/permissions')
  async updateRolePermissions(
    @Param('role') roleParam: string,
    @Body() body: UpdateRolePermissionsDto,
  ) {
    return this.rbacService.updateRolePermissions(String(roleParam), body);
  }
}
