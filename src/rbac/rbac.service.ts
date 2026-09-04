import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../PrismaService/prisma.service';
import { CasbinService } from '../casbin/casbin.service';
import {
  RolePermissionUpdateItemDto,
  UpdateRolePermissionsDto,
} from './dto/update-role-permissions.dto';

@Injectable()
export class RbacService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casbinService: CasbinService,
  ) {}

  async getActiveRoles(): Promise<Array<{ role_id: string; role_name: string }>> {
    const roles = await this.prisma.role_master.findMany({
      where: { is_active: true },
      select: { role_id: true, role_name: true },
    });

    return roles.map((r) => ({
      role_id: typeof r.role_id === 'bigint' ? r.role_id.toString() : String(r.role_id),
      role_name: r.role_name,
    }));
  }

  /**
   * Build permission matrix for a given role id (BigInt as string) or role name.
   * Returns the selected role permissions (assigned: true/false) and assigned menus.
   */
  async getRolePermissionMatrix(roleId: string) {
    // Resolve role: allow caller to pass either numeric role_id or role_name
    const input = String(roleId || '').trim();

    let role;

    if (/^\d+$/.test(input)) {
      role = await this.prisma.role_master.findUnique({
        where: {
          role_id: BigInt(input),
        },
        select: {
          role_id: true,
          role_name: true,
        },
      });
    } else {
      role = await this.prisma.role_master.findUnique({
        where: {
          role_name: input,
        },
        select: {
          role_id: true,
          role_name: true,
        },
      });
    }

    if (!role) {
      return {
        role: null,
        permissions: {
          menus: [],
          pages: [],
        },
        defaultMenu: '',
      };
    }

    const roleName = role.role_name;

    // --------------------------------------------------
    // 1. Get all available menus
    // --------------------------------------------------
    const menuRows = await this.prisma.casbin_rule.findMany({
      where: {
        ptype: 'p',
      },
      select: {
        v0: true,
        v1: true,
        v2: true,
        v3: true,
        v4: true,
        v5: true,
      },
    });
    console.log(`Found ${menuRows.length} menu rows in casbin_rule table`);

    const parseMenuMeta = (row: any) => {
      const id = row.v0 as string;

      const metaStr =
        [row.v3, row.v4, row.v5].find(
          (v) =>
            typeof v === 'string' &&
            v.includes('displayName'),
        ) || '';

      const meta: Record<string, string> = {};

      if (metaStr) {
        for (const part of (metaStr as string).split('|')) {
          const [k, ...rest] = part.split(':');

          if (k && rest.length > 0) {
            meta[k.trim()] = rest.join(':').trim();
          }
        }
      }

      return {
        id,
        displayName: meta.displayName || id,
        route: meta.route || '',
        icon: meta.icon || '',
        displayOrder: meta.order
          ? Number(meta.order)
          : undefined,
      };
    };

    const menusMeta = menuRows.map(parseMenuMeta);

    // --------------------------------------------------
    // 2. Get ALL master permission definitions
    // --------------------------------------------------
    const allPPolicies =
      await this.casbinService
        .getEnforcer()
        .getPolicy();

    const allPermissions = (allPPolicies || [])
      .map((p: string[]) => ({
        permission: p[0],
        lob: p[1] || '',
        page: p[2] || '',
        module: p[3] || '',
        section: p[4] || '',
        access: p[5] || '',
      }))
      // Keep related permissions together for the UI: page -> module -> section.
      .sort((first, second) => {
        const compare = (a: string, b: string) =>
          a.localeCompare(b, undefined, { sensitivity: 'base' });

        return (
          compare(first.page, second.page) ||
          compare(first.module, second.module) ||
          compare(first.section, second.section) ||
          compare(first.access, second.access)
        );
      });

    // --------------------------------------------------
    // 3. Get permissions assigned ONLY to selected role
    // --------------------------------------------------
    const rolePermissions =
      await this.casbinService.getPermissionsForRole(
        roleName,
      );

    const roleMenus =
      await this.casbinService.getMenusForRole(
        roleName,
      );

    // --------------------------------------------------
    // 4. Mark each permission as assigned/unassigned
    // --------------------------------------------------
    const permissionsForRole = {
      menus: menusMeta.map((menu) => ({
        ...menu,
        assigned: roleMenus.includes(menu.id),
      })),

      pages: allPermissions.map((perm) => ({
        ...perm,
        assigned: rolePermissions.some(
          (rp: any) =>
            rp.permission === perm.permission &&
            rp.lob === perm.lob &&
            rp.page === perm.page &&
            rp.module === perm.module &&
            rp.section === perm.section &&
            rp.access === perm.access,
        ),
      })),
    };

    // --------------------------------------------------
    // 5. Get default menu for selected role
    // --------------------------------------------------
    const g2 =
      await this.casbinService
        .getEnforcer()
        .getNamedGroupingPolicy('g2');

    const defaultMenuRow = g2.find(
      (row: string[]) => row[0] === roleName,
    );

    const defaultMenu = defaultMenuRow
      ? defaultMenuRow[1]
      : '';

    // --------------------------------------------------
    // 6. Return response
    // --------------------------------------------------
    return {
      role: {
        roleId: role.role_id.toString(),
        roleName: roleName,
      },
      permissions: permissionsForRole,
      defaultMenu,
    };
  }

  /**
   * Replaces this role's permission assignments.
   * Validates incoming permissions, dynamically registers any new section permissions
   * (e.g. view/edit) into Casbin master policies & database, and updates role -> permission `g` mappings.
   */
  async updateRolePermissions(
    roleId: string,
    body: UpdateRolePermissionsDto,
  ) {
    if (!body || !Array.isArray(body.permissions) || body.permissions.length === 0) {
      throw new BadRequestException('permissions must be a non-empty array');
    }

    const input = String(roleId || '').trim();
    const role = /^\d+$/.test(input)
      ? await this.prisma.role_master.findUnique({
          where: { role_id: BigInt(input) },
          select: { role_id: true, role_name: true },
        })
      : await this.prisma.role_master.findUnique({
          where: { role_name: input },
          select: { role_id: true, role_name: true },
        });

    if (!role) {
      throw new NotFoundException('Role not found');
    }

    const hasValidShape = (item: RolePermissionUpdateItemDto) =>
      item &&
      typeof item.lob === 'string' &&
      typeof item.page === 'string' &&
      typeof item.module === 'string' &&
      typeof item.section === 'string' &&
      typeof item.access === 'string' &&
      typeof item.assigned === 'boolean' &&
      ['edit', 'view'].includes(item.access) &&
      [item.lob, item.page, item.module, item.section].every((value) => value.trim().length > 0);

    if (!body.permissions.every(hasValidShape)) {
      throw new BadRequestException(
        'Each permission requires lob, page, module, section, access (edit/view), and assigned (boolean)',
      );
    }

    // Deduplicate incoming permissions by unique composite key
    const deduplicatedMap = new Map<string, RolePermissionUpdateItemDto>();
    for (const item of body.permissions) {
      const key = `${item.lob.trim()}|${item.page.trim()}|${item.module.trim()}|${item.section.trim()}|${item.access.trim()}`;
      deduplicatedMap.set(key, {
        lob: item.lob.trim(),
        page: item.page.trim(),
        module: item.module.trim(),
        section: item.section.trim(),
        access: item.access.trim() as 'edit' | 'view',
        assigned: Boolean(item.assigned),
      });
    }

    const deduplicatedList = Array.from(deduplicatedMap.values());

    const enforcer = this.casbinService.getEnforcer();
    const masterPolicies = await enforcer.getPolicy();
    const masterPermissionIds = new Set(masterPolicies.map((policy) => policy[0]));

    const assignedPermissionIds = new Set<string>();
    const touchedPermissionIds = new Set<string>();
    const newPoliciesToInsert: Array<{
      ptype: string;
      v0: string;
      v1: string;
      v2: string;
      v3: string;
      v4: string;
      v5: string;
    }> = [];

    for (const item of deduplicatedList) {
      // Find all policies associated with this section (both view and edit)
      const allRelatedPolicies = masterPolicies.filter(
        (policy) =>
          policy[1] === item.lob &&
          policy[2] === item.page &&
          policy[3] === item.module &&
          policy[4] === item.section,
      );

      // Track all related permission IDs so old access variants (e.g. view when switching to edit) get cleaned up
      for (const rel of allRelatedPolicies) {
        touchedPermissionIds.add(rel[0]);
      }

      const matchingPolicies = allRelatedPolicies.filter(
        (policy) => policy[5] === item.access,
      );

      let permissionId: string;

      if (matchingPolicies.length > 0) {
        permissionId = matchingPolicies[0][0];
      } else {
        // Auto-generate deterministic permission ID for new/unregistered permission
        const baseId = `${item.page}-${item.module}-${item.section}-${item.access}`;
        permissionId = baseId;
        let counter = 1;
        while (masterPermissionIds.has(permissionId)) {
          permissionId = `${baseId}-${counter++}`;
        }

        masterPermissionIds.add(permissionId);
        masterPolicies.push([
          permissionId,
          item.lob,
          item.page,
          item.module,
          item.section,
          item.access,
        ]);

        newPoliciesToInsert.push({
          ptype: 'p',
          v0: permissionId,
          v1: item.lob,
          v2: item.page,
          v3: item.module,
          v4: item.section,
          v5: item.access,
        });

        // Add dynamically to live Enforcer
        await enforcer.addPolicy(
          permissionId,
          item.lob,
          item.page,
          item.module,
          item.section,
          item.access,
        );
      }

      touchedPermissionIds.add(permissionId);

      if (item.assigned) {
        assignedPermissionIds.add(permissionId);
      }
    }

    const roleName = role.role_name;
    const finalAssignedPermissionIds = Array.from(assignedPermissionIds);
    const finalTouchedPermissionIds = Array.from(touchedPermissionIds);

    await this.prisma.$transaction(async (transaction) => {
      // 1. Insert any new master p policies into DB
      if (newPoliciesToInsert.length > 0) {
        await transaction.casbin_rule.createMany({
          data: newPoliciesToInsert,
          skipDuplicates: true,
        });
      }

      // 2. Delete existing role assignment g rows for the touched permissions
      if (finalTouchedPermissionIds.length > 0) {
        await transaction.casbin_rule.deleteMany({
          where: {
            ptype: 'g',
            v0: roleName,
            v1: { in: finalTouchedPermissionIds },
          },
        });
      }

      // 3. Insert new role assignments for active permissions
      if (finalAssignedPermissionIds.length > 0) {
        await transaction.casbin_rule.createMany({
          data: finalAssignedPermissionIds.map((permId) => ({
            ptype: 'g',
            v0: roleName,
            v1: permId,
            v2: null,
            v3: null,
            v4: null,
            v5: null,
          })),
          skipDuplicates: true,
        });
      }
    });

    // 4. Keep the running Casbin enforcer in sync immediately
    const currentMappings = await enforcer.getFilteredGroupingPolicy(0, roleName);
    for (const mapping of currentMappings) {
      if (touchedPermissionIds.has(mapping[1])) {
        await enforcer.removeGroupingPolicy(...mapping);
      }
    }

    for (const permId of finalAssignedPermissionIds) {
      await enforcer.addGroupingPolicy(roleName, permId);
    }

    return {
      role: {
        roleId: role.role_id.toString(),
        roleName,
      },
      updatedCount: deduplicatedList.length,
      assignedCount: finalAssignedPermissionIds.length,
    };
  }
}
