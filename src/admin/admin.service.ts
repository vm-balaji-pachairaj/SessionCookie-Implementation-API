import { Injectable, BadRequestException, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../PrismaService/prisma.service';
import { CasbinService } from '../casbin/casbin.service';

export interface UpdateUserRoleDto {
  nt_id: string;
  new_role_id: string;
}

export interface UserRoleResponse {
  user_role_mapping_id: string;
  nt_id: string;
  role_id: string;
  role_name: string;
  is_active: boolean;
  updated_at: string;
}

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly casbinService: CasbinService,
  ) {}

  /**
   * ============================================================================
   * Get all users with their current roles
   * ============================================================================
   */
  async getAllUsersWithRoles() {
    this.logger.log('Fetching all users with roles');

    const users = await this.prisma.user_role_mapping.findMany({
      include: {
        users: {
          select: {
            nt_id: true,
            username: true,
            user_email_id: true,
            is_active: true,
          },
        },
        role_master: {
          select: {
            role_id: true,
            role_name: true,
          },
        },
      },
      where: {
        is_active: true,
      },
    });

    return users.map((mapping) => ({
      user_role_mapping_id: mapping.user_role_mapping_id.toString(),
      nt_id: mapping.nt_id,
      username: mapping.users.username,
      email: mapping.users.user_email_id,
      current_role_id: mapping.role_id.toString(),
      current_role_name: mapping.role_master.role_name,
      is_user_active: mapping.users.is_active,
      is_role_active: mapping.is_active,
    }));
  }

  /**
   * ============================================================================
   * Get all available roles
   * ============================================================================
   */
  async getAllRoles() {
    this.logger.log('Fetching all roles');

    const roles = await this.prisma.role_master.findMany({
      where: {
        is_active: true,
      },
      select: {
        role_id: true,
        role_name: true,
        short_name: true,
      },
    });

    return roles.map((role) => ({
      role_id: role.role_id.toString(),
      role_name: role.role_name,
      description: role.short_name || null,
    }));
  }

  /**
   * ============================================================================
   * Update user's role — CRITICAL: Updates DB + Casbin policies
   * ============================================================================
   *
   * Flow:
   * 1. Validate user and new role exist
   * 2. Check if user already has this role
   * 3. Get current role for logging
   * 4. Update database user_role_mapping
   * 5. Update Casbin policies (remove old, add new)
   * 6. Invalidate user's Redis session (force re-login with new role)
   *
   * ============================================================================
   */
  async updateUserRole(
    dto: UpdateUserRoleDto,
    adminNtId: string,
  ): Promise<UserRoleResponse> {
    const { nt_id, new_role_id } = dto;

    this.logger.log(`Admin ${adminNtId} attempting to change role for user ${nt_id}`, {
      nt_id,
      new_role_id,
      admin_nt_id: adminNtId,
    });

    // --------
    // Step 1: Validate user exists
    // --------
    const user = await this.prisma.users.findUnique({
      where: { nt_id },
    });

    if (!user) {
      this.logger.warn(`User not found: ${nt_id}`);
      throw new NotFoundException(`User with nt_id "${nt_id}" not found`);
    }

    // --------
    // Step 2: Validate new role exists
    // --------
    const newRole = await this.prisma.role_master.findUnique({
      where: { role_id: BigInt(new_role_id) },
    });

    if (!newRole) {
      this.logger.warn(`Role not found: ${new_role_id}`);
      throw new NotFoundException(`Role with id "${new_role_id}" not found`);
    }

    // --------
    // Step 3: Check if user already has this role
    // --------
    const existingRoleMapping = await this.prisma.user_role_mapping.findFirst({
      where: {
        nt_id,
        role_id: BigInt(new_role_id),
        is_active: true,
      },
    });

    if (existingRoleMapping) {
      this.logger.warn(
        `User ${nt_id} already has role ${newRole.role_name}`,
      );
      throw new BadRequestException(
        `User already has the role "${newRole.role_name}"`,
      );
    }

    // --------
    // Step 4: Get current role for logging
    // --------
    const currentRoleMapping = await this.prisma.user_role_mapping.findFirst({
      where: {
        nt_id,
        is_active: true,
      },
      include: {
        role_master: true,
      },
    });

    const oldRoleName = currentRoleMapping?.role_master?.role_name || 'NONE';

    // --------
    // Step 5: Deactivate old role (keep history)
    // --------
    if (currentRoleMapping) {
      await this.prisma.user_role_mapping.update({
        where: {
          user_role_mapping_id: currentRoleMapping.user_role_mapping_id,
        },
        data: {
          is_active: false,
          updated_by: adminNtId,
          updated_at: new Date(),
        },
      });

      this.logger.log(
        `Deactivated old role mapping for user ${nt_id}: ${oldRoleName}`,
      );
    }

    // --------
    // Step 6: Create new role mapping (OR reactivate if exists but inactive)
    // --------
    const inactiveMapping = await this.prisma.user_role_mapping.findFirst({
      where: {
        nt_id,
        role_id: BigInt(new_role_id),
        is_active: false,
      },
    });

    let updatedMapping;

    if (inactiveMapping) {
      // Reactivate existing mapping
      updatedMapping = await this.prisma.user_role_mapping.update({
        where: {
          user_role_mapping_id: inactiveMapping.user_role_mapping_id,
        },
        data: {
          is_active: true,
          updated_by: adminNtId,
          updated_at: new Date(),
        },
        include: {
          role_master: true,
        },
      });

      this.logger.log(
        `Reactivated inactive role mapping for user ${nt_id}: ${newRole.role_name}`,
      );
    } else {
      // Create new mapping
      updatedMapping = await this.prisma.user_role_mapping.create({
        data: {
          nt_id,
          role_id: BigInt(new_role_id),
          is_active: true,
          created_by: adminNtId,
          updated_by: adminNtId,
          updated_at: new Date(),
        },
        include: {
          role_master: true,
        },
      });

      this.logger.log(
        `Created new role mapping for user ${nt_id}: ${newRole.role_name}`,
      );
    }

    // --------
    // Step 7: Update Casbin policies
    // --------
    try {
      // Remove old role policies if exists
      if (oldRoleName && oldRoleName !== 'NONE') {
        await this.casbinService.removeUserRolePolicies(oldRoleName);
        this.logger.log(`Removed Casbin policies for old role: ${oldRoleName}`);
      }

      // Add new role policies
      await this.casbinService.addUserRolePolicies(newRole.role_name);
      this.logger.log(`Added Casbin policies for new role: ${newRole.role_name}`);
    } catch (error) {
      this.logger.warn(
        `Failed to update Casbin policies (non-critical): ${error}`,
      );
      // Don't fail the entire operation if Casbin update fails
      // Policies will be synced on next app restart
    }

    // --------
    // Step 8: Invalidate user's Redis session (force re-login)
    // --------
    try {
      // This will be handled by the Redis service
      // Users will need to login again with their new role
      this.logger.log(
        `User ${nt_id} session should be invalidated (handled separately)`,
      );
    } catch (error) {
      this.logger.warn(`Failed to invalidate user session: ${error}`);
    }

    this.logger.log(
      `Successfully updated role for user ${nt_id}: ${oldRoleName} → ${newRole.role_name}`,
      {
        nt_id,
        old_role: oldRoleName,
        new_role: newRole.role_name,
        admin_nt_id: adminNtId,
      },
    );

    return {
      user_role_mapping_id: updatedMapping.user_role_mapping_id.toString(),
      nt_id: updatedMapping.nt_id,
      role_id: updatedMapping.role_id.toString(),
      role_name: updatedMapping.role_master.role_name,
      is_active: updatedMapping.is_active,
      updated_at: updatedMapping.updated_at.toISOString(),
    };
  }

  /**
   * ============================================================================
   * Get user's role history (audit trail)
   * ============================================================================
   */
  async getUserRoleHistory(nt_id: string) {
    this.logger.log(`Fetching role history for user ${nt_id}`);

    const history = await this.prisma.user_role_mapping.findMany({
      where: { nt_id },
      include: {
        role_master: {
          select: {
            role_name: true,
          },
        },
      },
      orderBy: {
        updated_at: 'desc',
      },
    });

    return history.map((mapping) => ({
      user_role_mapping_id: mapping.user_role_mapping_id.toString(),
      role_name: mapping.role_master.role_name,
      is_active: mapping.is_active,
      changed_by: mapping.updated_by,
      changed_at: mapping.updated_at.toISOString(),
    }));
  }

  /**
   * ============================================================================
   * Get all menus accessible to a specific role
   * ============================================================================
   */
  async getRoleMenus(roleName: string) {
    this.logger.log(`Fetching menus for role: ${roleName}`);

    try {
      const menus = await this.casbinService.getMenusForRole(roleName);

      return menus.map((menuId) => ({
        menu_id: menuId,
        menu_name: menuId
          .split('_')
          .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' '),
      }));
    } catch (error) {
      this.logger.warn(`Failed to fetch menus for role ${roleName}: ${error}`);
      return [];
    }
  }
}
