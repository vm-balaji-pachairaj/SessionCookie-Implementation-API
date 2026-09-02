import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Req,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminService, UpdateUserRoleDto } from './admin.service';
import { TokenPayload } from '../app.service';
import { CheckPolicy } from '../casbin/casbin.decorator';
import { Logger } from 'nest-common-utilities';

@Controller('api/admin')
export class AdminController {
  private logger = new Logger(AdminController.name);

  constructor(private readonly adminService: AdminService) {}

  /**
   * ============================================================================
   * GET /api/admin/users
   *
   * List all users with their current roles
   * Admin only
   * ============================================================================
   */
  @Get('users')
  // @CheckPolicy('admin', 'userManagement', 'list', 'users', 'view')
  async getAllUsersWithRoles(
    @Req() request: Request & { user?: TokenPayload },
  ) {
    const admin = request.user as TokenPayload;

    this.logger.info('Admin fetching all users with roles', {
      methodName: 'getAllUsersWithRoles',
      api: 'GET /api/admin/users',
      admin_nt_id: admin?.userDetails?.nt_id,
    });

    const users = await this.adminService.getAllUsersWithRoles();

    return {
      success: true,
      data: users,
      count: users.length,
    };
  }

  /**
   * ============================================================================
   * GET /api/admin/roles
   *
   * List all available roles
   * Admin only
   * ============================================================================
   */
  @Get('roles')
  // @CheckPolicy('admin', 'userManagement', 'list', 'roles', 'view')
  async getAllRoles(
    @Req() request: Request & { user?: TokenPayload },
  ) {
    const admin = request.user as TokenPayload;

    this.logger.info('Admin fetching all available roles', {
      methodName: 'getAllRoles',
      api: 'GET /api/admin/roles',
      admin_nt_id: admin?.userDetails?.nt_id,
    });

    const roles = await this.adminService.getAllRoles();

    return {
      success: true,
      data: roles,
      count: roles.length,
    };
  }

  /**
   * ============================================================================
   * POST /api/admin/users/:nt_id/role
   *
   * Update a user's role
   * CRITICAL: Updates both database and Casbin policies
   * Admin only
   * ============================================================================
   */
  @Post('users/:nt_id/role')
  // @CheckPolicy('admin', 'userManagement', 'update', 'userRole', 'edit')
  async updateUserRole(
    @Param('nt_id') nt_id: string,
    @Body() body: { new_role_id: string },
    @Req() request: Request & { user?: TokenPayload },
  ) {
    const admin = request.user as TokenPayload;
    const adminNtId = admin?.userDetails?.nt_id || admin?.sub;

    this.logger.info('Admin initiating user role update', {
      methodName: 'updateUserRole',
      api: 'POST /api/admin/users/:nt_id/role',
      admin_nt_id: adminNtId,
      target_user_nt_id: nt_id,
      new_role_id: body.new_role_id,
    });

    const result = await this.adminService.updateUserRole(
      {
        nt_id,
        new_role_id: body.new_role_id,
      },
      adminNtId,
    );

    this.logger.info('User role updated successfully', {
      methodName: 'updateUserRole',
      api: 'POST /api/admin/users/:nt_id/role',
      admin_nt_id: adminNtId,
      target_user_nt_id: nt_id,
      new_role_id: result.role_id,
      new_role_name: result.role_name,
    });

    return {
      success: true,
      message: `User role updated successfully`,
      code: 'ROLE_UPDATED',
      statusCode: HttpStatus.OK,
      data: result,
    };
  }

  /**
   * ============================================================================
   * GET /api/admin/users/:nt_id/role-history
   *
   * Get user's role change history (audit trail)
   * Admin only
   * ============================================================================
   */
  @Get('users/:nt_id/role-history')
  // @CheckPolicy('admin', 'userManagement', 'list', 'roleHistory', 'view')
  async getUserRoleHistory(
    @Param('nt_id') nt_id: string,
    @Req() request: Request & { user?: TokenPayload },
  ) {
    const admin = request.user as TokenPayload;

    this.logger.info('Admin fetching user role history', {
      methodName: 'getUserRoleHistory',
      api: 'GET /api/admin/users/:nt_id/role-history',
      admin_nt_id: admin?.userDetails?.nt_id,
      target_user_nt_id: nt_id,
    });

    const history = await this.adminService.getUserRoleHistory(nt_id);

    return {
      success: true,
      data: history,
      count: history.length,
    };
  }

  /**
   * ============================================================================
   * GET /api/admin/users/:nt_id
   *
   * Get detailed information about a specific user
   * Admin only
   * ============================================================================
   */
  @Get('users/:nt_id')
  // @CheckPolicy('admin', 'userManagement', 'list', 'users', 'view')
  async getUserDetails(
    @Param('nt_id') nt_id: string,
    @Req() request: Request & { user?: TokenPayload },
  ) {
    const admin = request.user as TokenPayload;

    this.logger.info('Admin fetching user details', {
      methodName: 'getUserDetails',
      api: 'GET /api/admin/users/:nt_id',
      admin_nt_id: admin?.userDetails?.nt_id,
      target_user_nt_id: nt_id,
    });

    const users = await this.adminService.getAllUsersWithRoles();
    const user = users.find((u) => u.nt_id === nt_id);

    if (!user) {
      return {
        success: false,
        message: 'User not found',
        code: 'USER_NOT_FOUND',
        statusCode: HttpStatus.NOT_FOUND,
        data: null,
      };
    }

    // Get role history
    const history = await this.adminService.getUserRoleHistory(nt_id);

    return {
      success: true,
      data: {
        ...user,
        role_history: history,
      },
    };
  }

  /**
   * ============================================================================
   * GET /api/admin/dashboard
   *
   * Admin dashboard statistics
   * Admin only
   * ============================================================================
   */
  @Get('dashboard')
  // @CheckPolicy('admin', 'admin', 'view', 'dashboard', 'view')
  async getAdminDashboard(
    @Req() request: Request & { user?: TokenPayload },
  ) {
    const admin = request.user as TokenPayload;

    this.logger.info('Admin accessing dashboard', {
      methodName: 'getAdminDashboard',
      api: 'GET /api/admin/dashboard',
      admin_nt_id: admin?.userDetails?.nt_id,
    });

    const users = await this.adminService.getAllUsersWithRoles();
    const roles = await this.adminService.getAllRoles();

    return {
      success: true,
      data: {
        total_users: users.length,
        total_roles: roles.length,
        active_users: users.filter((u) => u.is_user_active).length,
        active_roles: roles.length,
        users_by_role: this.groupUsersByRole(users),
      },
    };
  }

  /**
   * ============================================================================
   * GET /api/admin/roles/:role_name/menus
   *
   * Get all menus accessible to a specific role
   * Admin only
   * ============================================================================
   */
  @Get('roles/:role_name/menus')
  // @CheckPolicy('admin', 'admin', 'view', 'roleMenus', 'view')
  async getRoleMenus(
    @Param('role_name') role_name: string,
    @Req() request: Request & { user?: TokenPayload },
  ) {
    const admin = request.user as TokenPayload;

    this.logger.info('Admin fetching menus for role', {
      methodName: 'getRoleMenus',
      api: 'GET /api/admin/roles/:role_name/menus',
      admin_nt_id: admin?.userDetails?.nt_id,
      role_name,
    });

    const menus = await this.adminService.getRoleMenus(role_name);

    return {
      success: true,
      role: role_name,
      data: menus,
      count: menus.length,
    };
  }

  /**
   * Helper function to group users by role
   */
  private groupUsersByRole(users: any[]) {
    return users.reduce(
      (acc, user) => {
        const role = user.current_role_name;
        if (!acc[role]) {
          acc[role] = [];
        }
        acc[role].push(user);
        return acc;
      },
      {} as Record<string, any[]>,
    );
  }
}
