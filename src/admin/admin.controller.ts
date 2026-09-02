import { Body, Controller, Delete, Get, Param, Post } from '@nestjs/common';
import { Public } from '../public.decorator';
import { AdminService } from './admin.service';

// ============================================================================
// Admin console — no authentication / policy checks by design (POC scope).
// ============================================================================
@Public()
@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('roles')
  getRoles() {
    return this.adminService.getRoles();
  }

  @Get('roles/:role/permissions')
  getRolePermissions(@Param('role') role: string) {
    return this.adminService.getRolePermissions(decodeURIComponent(role));
  }

  @Get('roles/:role/available-policies')
  getAvailablePolicies(@Param('role') role: string) {
    return this.adminService.getAvailablePoliciesForRole(
      decodeURIComponent(role),
    );
  }

  @Post('roles/:role/policies')
  addPolicy(
    @Param('role') role: string,
    @Body() body: { permission: string },
  ) {
    return this.adminService.addPolicyToRole(
      decodeURIComponent(role),
      body.permission,
    );
  }

  @Delete('roles/:role/policies/:permission')
  removePolicy(
    @Param('role') role: string,
    @Param('permission') permission: string,
  ) {
    return this.adminService.removePolicyFromRole(
      decodeURIComponent(role),
      decodeURIComponent(permission),
    );
  }

  @Get('policies')
  getPolicies() {
    return this.adminService.getPolicies();
  }

  @Get('policies/:permission/definitions')
  getPolicyDefinitions(@Param('permission') permission: string) {
    return this.adminService.getPolicyDefinitions(
      decodeURIComponent(permission),
    );
  }

  @Post('enforcer/check')
  checkEnforcer(
    @Body()
    body: {
      role: string;
      lob: string;
      page: string;
      module: string;
      section: string;
      access: string;
    },
  ) {
    return this.adminService.checkEnforcer(body);
  }
}
