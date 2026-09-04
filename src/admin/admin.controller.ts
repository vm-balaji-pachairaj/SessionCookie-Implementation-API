import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { Public } from '../public.decorator';
import { AdminService } from './admin.service';
import type { PolicyType } from './admin.service';

// ============================================================================
// Admin console — no authentication / policy checks by design (POC scope).
// Centralized around the Policy Bundle architecture:
// Role -> (g3) -> Policy Bundle -> (g) -> Policies (P, P2, P3).
// ============================================================================
@Public()
@Controller('api/admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  // --------------------------------------------------------------------------
  // Roles & Role-to-Bundle Mappings
  // --------------------------------------------------------------------------

  @Get('roles')
  getRoles() {
    return this.adminService.getRoles();
  }

  @Get('roles/:role/bundles')
  getRoleBundles(@Param('role') role: string) {
    return this.adminService.getRoleBundles(decodeURIComponent(role));
  }

  @Get('roles/:role/available-bundles')
  getAvailableBundlesForRole(@Param('role') role: string) {
    return this.adminService.getAvailableBundlesForRole(decodeURIComponent(role));
  }

  @Post('roles/:role/bundles')
  addBundleToRole(
    @Param('role') role: string,
    @Body() body: { bundleName: string },
  ) {
    return this.adminService.addBundleToRole(
      decodeURIComponent(role),
      body.bundleName,
    );
  }

  @Delete('roles/:role/bundles/:bundleName')
  removeBundleFromRole(
    @Param('role') role: string,
    @Param('bundleName') bundleName: string,
  ) {
    return this.adminService.removeBundleFromRole(
      decodeURIComponent(role),
      decodeURIComponent(bundleName),
    );
  }

  // --------------------------------------------------------------------------
  // Policy Bundles Management (CRUD)
  // --------------------------------------------------------------------------

  @Get('policy-bundles')
  getPolicyBundles() {
    return this.adminService.getPolicyBundles();
  }

  @Get('policy-bundles/:id')
  getPolicyBundleById(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getPolicyBundleById(id);
  }

  @Post('policy-bundles')
  createPolicyBundle(
    @Body()
    body: {
      name: string;
      description?: string;
      policyNames?: string[];
    },
  ) {
    return this.adminService.createPolicyBundle(body);
  }

  @Put('policy-bundles/:id')
  updatePolicyBundle(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    body: {
      name?: string;
      description?: string;
    },
  ) {
    return this.adminService.updatePolicyBundle(id, body);
  }

  @Delete('policy-bundles/:id')
  deletePolicyBundle(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.deletePolicyBundle(id);
  }

  @Get('policy-bundles/:id/available-roles')
  getAvailableRolesForBundle(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getAvailableRolesForBundle(id);
  }

  @Post('policy-bundles/:id/roles')
  assignRoleToBundle(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { roleName: string },
  ) {
    return this.adminService.assignRoleToBundle(id, body.roleName);
  }

  @Delete('policy-bundles/:id/roles/:roleName')
  removeRoleFromBundle(
    @Param('id', ParseIntPipe) id: number,
    @Param('roleName') roleName: string,
  ) {
    return this.adminService.removeRoleFromBundle(
      id,
      decodeURIComponent(roleName),
    );
  }

  // --------------------------------------------------------------------------
  // Bundle Policies Management
  // --------------------------------------------------------------------------

  @Get('policy-bundles/:id/policies')
  getBundlePolicies(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getBundlePolicies(id);
  }

  @Get('policy-bundles/:id/available-policies')
  getAvailablePoliciesForBundle(@Param('id', ParseIntPipe) id: number) {
    return this.adminService.getAvailablePoliciesForBundle(id);
  }

  @Post('policy-bundles/:id/policies')
  addPolicyToBundle(
    @Param('id', ParseIntPipe) id: number,
    @Body() body: { policyName: string; ptype?: PolicyType },
  ) {
    return this.adminService.addPolicyToBundle(
      id,
      body.policyName,
      body.ptype,
    );
  }

  @Delete('policy-bundles/:id/policies/:policyName')
  removePolicyFromBundle(
    @Param('id', ParseIntPipe) id: number,
    @Param('policyName') policyName: string,
  ) {
    return this.adminService.removePolicyFromBundle(
      id,
      decodeURIComponent(policyName),
    );
  }

  // --------------------------------------------------------------------------
  // Individual Policies & Definitions Browser
  // --------------------------------------------------------------------------

  @Get('policies')
  getPolicies() {
    return this.adminService.getPolicies();
  }

  @Get('policies/:permission/definitions')
  getPolicyDefinitions(
    @Param('permission') permission: string,
    @Query('ptype') ptype?: PolicyType,
  ) {
    return this.adminService.getPolicyDefinitions(
      decodeURIComponent(permission),
      ptype === 'p2' ? 'p2' : ptype === 'p3' ? 'p3' : 'p',
    );
  }

  // --------------------------------------------------------------------------
  // Centralized Enforcer Checker
  // --------------------------------------------------------------------------

  @Post('enforcer/check')
  checkEnforcer(
    @Body()
    body: {
      ptype?: PolicyType;
      role: string;
      lob?: string;
      page?: string;
      module?: string;
      section?: string;
      field?: string;
      access?: string;
      key?: string;
    },
  ) {
    return this.adminService.checkEnforcer(body);
  }
}
