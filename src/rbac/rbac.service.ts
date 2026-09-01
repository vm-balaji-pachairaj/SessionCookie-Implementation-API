import { Injectable } from '@nestjs/common';
import { PrismaService } from '../PrismaService/prisma.service';
import { CasbinService } from '../casbin/casbin.service';

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
   * Build permission matrix for a given role id (BigInt as string).
   * Returns the selected role permissions (assigned: true) and other roles with their assigned flags.
   */
  // async getRolePermissionMatrix(roleId: string) {
  //    // Resolve role: allow caller to pass either numeric role_id or role_name
  //   const input = String(roleId || '').trim();
  //   let role;

  //   if (/^\d+$/.test(input)) {
  //     role = await this.prisma.role_master.findUnique({
  //       where: { role_id: BigInt(input) },
  //       select: { role_id: true, role_name: true },
  //     });
  //   } else {
  //     role = await this.prisma.role_master.findUnique({
  //       where: { role_name: input },
  //       select: { role_id: true, role_name: true },
  //     });
  //   }

  //   if (!role) {
  //     return { roles: [], permissions: {}, otherRoles: [], defaultMenu: '' };
  //   }

  //   const roleName = role.role_name;
  //   const selectedRoleIdStr = role.role_id.toString();

  //   // All active roles
  //   const allRoles = await this.prisma.role_master.findMany({
  //     where: { is_active: true },
  //     select: { role_id: true, role_name: true },
  //   });

  //   // --- Menus: read p2 rows from DB and parse displayName metadata ---
  //   const menuRows = await this.prisma.casbin_rule.findMany({
  //     where: { ptype: 'p2' },
  //     select: { v0: true, v1: true, v2: true, v3: true, v4: true, v5: true },
  //   });

  //   const parseMenuMeta = (row: any) => {
  //     const id = row.v0 as string;
  //     const metaStr = [row.v3, row.v4, row.v5].find((v) => typeof v === 'string' && v.includes('displayName')) || '';
  //     const meta: Record<string, string> = {};
  //     if (metaStr) {
  //       for (const part of (metaStr as string).split('|')) {
  //         const [k, ...rest] = part.split(':');
  //         if (k && rest.length > 0) {
  //           meta[k.trim()] = rest.join(':').trim();
  //         }
  //       }
  //     }

  //     return {
  //       id,
  //       displayName: meta.displayName || id,
  //       route: meta.route || '',
  //       icon: meta.icon || '',
  //       displayOrder: meta.order ? Number(meta.order) : undefined,
  //     };
  //   };

  //   const menusMeta = menuRows.map(parseMenuMeta);

  //   // --- Permissions (p policies) ---
  //   const allPPolicies = await this.casbinService.getEnforcer().getPolicy();

  //   const allPermissions = (allPPolicies || []).map((p: string[]) => ({
  //     permission: p[0],
  //     lob: p[1] || '',
  //     page: p[2] || '',
  //     module: p[3] || '',
  //     section: p[4] || '',
  //     access: p[5] || '',
  //   }));

  //   // Role-specific assigned permissions
  //   const rolePermissions = await this.casbinService.getPermissionsForRole(roleName);
  //   const roleMenus = await this.casbinService.getMenusForRole(roleName);

  //   const permissionsForRole = {
  //     menus: menusMeta.map((m) => ({ ...m, assigned: roleMenus.includes(m.id) })),
  //     pages: allPermissions.map((perm) => ({ ...perm, assigned: rolePermissions.some((rp: any) =>
  //       rp.permission === perm.permission && rp.lob === perm.lob && rp.page === perm.page && rp.module === perm.module && rp.section === perm.section && rp.access === perm.access
  //     ) })),
  //   };

  //   // Other roles
  //   const otherRoles = [] as any[];

  //   for (const r of allRoles) {
  //     if (r.role_id.toString() === selectedRoleIdStr) continue;

  //     const otherRoleName = r.role_name;
  //     const otherRolePermissions = await this.casbinService.getPermissionsForRole(otherRoleName);
  //     const otherRoleMenus = await this.casbinService.getMenusForRole(otherRoleName);

  //     otherRoles.push({
  //       role: otherRoleName,
  //       permissions: {
  //         menus: menusMeta.map((m) => ({ ...m, assigned: otherRoleMenus.includes(m.id) })),
  //         pages: allPermissions.map((perm) => ({ ...perm, assigned: otherRolePermissions.some((orp: any) =>
  //           orp.permission === perm.permission && orp.lob === perm.lob && orp.page === perm.page && orp.module === perm.module && orp.section === perm.section && orp.access === perm.access
  //         ) })),
  //       },
  //     });
  //   }

  //   // defaultMenu: look for g2 named grouping policy where v0 is roleName and v1 is menu key
  //   const g2 = await this.casbinService.getEnforcer().getNamedGroupingPolicy('g2');
  //   const defaultMenuRow = g2.find((row: string[]) => row[0] === roleName);
  //   const defaultMenu = defaultMenuRow ? defaultMenuRow[1] : '';

  //   const rolesArray = [
  //     { role: roleName, permissions: permissionsForRole, defaultMenu: defaultMenu || '' },
  //     ...otherRoles.map((o) => ({ role: o.role, permissions: o.permissions })),
  //   ];

  //   return {
  //     roles: rolesArray,
  //     defaultMenu: defaultMenu || '',
  //   };
  // }


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
      ptype: 'p2',
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
  // 2. Get ALL permission definitions
  //    This is the common master permission list
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
  // 6. Return ONLY selected role
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
}
