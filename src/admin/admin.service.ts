import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../PrismaService/prisma.service';
import { CasbinService } from '../casbin/casbin.service';
import { parseP2Metadata } from '../casbin/p2-metadata.util';

export type PolicyType = 'p' | 'p2' | 'p3';

export interface RoleSummary {
  role: string;
  bundleCount: number;
}

export interface RoleBundleSummary {
  id: number;
  name: string;
  description: string | null;
  policyCount: number;
}

export interface HierarchyField {
  key: string;
  name: string;
  policy: string;
  policyName: string;
  access: string;
}

export interface HierarchyMenu {
  key: string;
  name: string;
  displayName: string;
  policy: string;
  policyName: string;
  route: string;
  icon: string;
  order: number;
  fields: HierarchyField[];
}

export interface HierarchySection {
  key: string;
  name: string;
  policy: string;
  policyName: string;
  access: string;
  menus: HierarchyMenu[];
}

export interface ResourceHierarchy {
  sections: HierarchySection[];
}

export interface PolicyBundleSummary {
  id: number;
  name: string;
  description: string | null;
  policyCount: number;
  roleCount: number;
  sectionCount: number;
  menuCount: number;
  fieldCount: number;
  status: string;
  assignedRoles?: string[];
  created_at: Date;
  updated_at: Date;
}

export interface PolicyDefinition {
  ptype: PolicyType;
  lob?: string | null;
  page?: string | null;
  module?: string | null;
  section?: string | null;
  access?: string | null;
  field?: string | null;
  parent?: string | null;
  meta?: string | null;
  displayName?: string | null;
  route?: string | null;
  icon?: string | null;
  order?: number | null;
}

export interface PolicySummary {
  permission: string;
  ptype: PolicyType;
  definitions: PolicyDefinition[];
}

export interface BundlePolicyEntry extends PolicyDefinition {
  permission: string;
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casbinService: CasbinService,
  ) {}

  // ==========================================================================
  // ROLES & ROLE-TO-BUNDLE MANAGEMENT
  // ==========================================================================

  /**
   * List all user roles with the number of Policy Bundles assigned to each.
   */
  async getRoles(): Promise<RoleSummary[]> {
    // Fetch all g3 mappings (role -> bundle)
    const g3Rules = await this.prisma.casbin_rule.findMany({
      where: { ptype: 'g3', v0: { not: null } },
      select: { v0: true, v1: true },
    });

    const bundlesByRole = new Map<string, Set<string>>();
    const allRoles = new Set<string>();

    for (const rule of g3Rules) {
      const role = rule.v0 as string;
      allRoles.add(role);
      if (rule.v1) {
        if (!bundlesByRole.has(role)) {
          bundlesByRole.set(role, new Set());
        }
        bundlesByRole.get(role)!.add(rule.v1);
      }
    }

    // Also include any roles from role_master that might not have bundles yet
    const masterRoles = await this.prisma.role_master.findMany({
      where: { is_active: true },
      select: { role_name: true },
    });
    for (const r of masterRoles) {
      allRoles.add(r.role_name);
    }

    return Array.from(allRoles)
      .sort()
      .map((role) => ({
        role,
        bundleCount: bundlesByRole.get(role)?.size ?? 0,
      }));
  }

  /**
   * Get all Policy Bundles assigned to a role.
   */
  async getRoleBundles(role: string): Promise<RoleBundleSummary[]> {
    const g3Rules = await this.prisma.casbin_rule.findMany({
      where: { ptype: 'g3', v0: role, v1: { not: null } },
      select: { v1: true },
    });

    const bundleNames = g3Rules.map((r) => r.v1 as string);
    if (bundleNames.length === 0) {
      return [];
    }

    const bundles = await this.prisma.policy_bundle.findMany({
      where: { name: { in: bundleNames } },
      include: {
        _count: {
          select: { policies: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    return bundles.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      policyCount: b._count.policies,
    }));
  }

  /**
   * Get Policy Bundles that are not yet assigned to the specified role.
   */
  async getAvailableBundlesForRole(role: string): Promise<PolicyBundleSummary[]> {
    const assignedRules = await this.prisma.casbin_rule.findMany({
      where: { ptype: 'g3', v0: role, v1: { not: null } },
      select: { v1: true },
    });

    const assignedNames = new Set(assignedRules.map((r) => r.v1 as string));
    const allBundles = await this.getPolicyBundles();

    return allBundles.filter((b) => !assignedNames.has(b.name));
  }

  /**
   * Assign a Policy Bundle to a role using Casbin g3.
   */
  async addBundleToRole(role: string, bundleName: string) {
    const bundle = await this.prisma.policy_bundle.findUnique({
      where: { name: bundleName },
    });

    if (!bundle) {
      throw new NotFoundException(`Policy bundle "${bundleName}" was not found`);
    }

    const existing = await this.prisma.casbin_rule.findFirst({
      where: { ptype: 'g3', v0: role, v1: bundleName },
    });

    if (!existing) {
      await this.prisma.casbin_rule.create({
        data: {
          ptype: 'g3',
          v0: role,
          v1: bundleName,
          v2: null,
          v3: null,
          v4: null,
          v5: null,
          v6: null,
        },
      });
    }

    await this.casbinService.reloadPolicy();
    return { message: `Policy bundle "${bundleName}" assigned to role "${role}"` };
  }

  /**
   * Remove a Policy Bundle assignment from a role (removes g3).
   */
  async removeBundleFromRole(role: string, bundleName: string) {
    await this.prisma.casbin_rule.deleteMany({
      where: { ptype: 'g3', v0: role, v1: bundleName },
    });

    await this.casbinService.reloadPolicy();
    return { message: `Policy bundle "${bundleName}" removed from role "${role}"` };
  }

  // ==========================================================================
  // POLICY BUNDLE CRUD
  // ==========================================================================

  /**
   * List all Policy Bundles with their policy count and role count.
   */
  async getPolicyBundles(): Promise<PolicyBundleSummary[]> {
    const bundles = await this.prisma.policy_bundle.findMany({
      include: {
        _count: {
          select: { policies: true },
        },
      },
      orderBy: { name: 'asc' },
    });

    // Count roles per bundle from g3 rules
    const g3Rules = await this.prisma.casbin_rule.findMany({
      where: { ptype: 'g3', v1: { not: null } },
      select: { v0: true, v1: true },
    });

    const rolesByBundle = new Map<string, Set<string>>();
    for (const rule of g3Rules) {
      const role = rule.v0 as string;
      const bundle = rule.v1 as string;
      if (!rolesByBundle.has(bundle)) {
        rolesByBundle.set(bundle, new Set());
      }
      rolesByBundle.get(bundle)!.add(role);
    }

    // Breakdown by ptype per bundle
    const policyPtypeCounts = await this.prisma.policy_bundle_policy.groupBy({
      by: ['bundle_id', 'ptype'],
      _count: { policy_name: true },
    });

    const bundleBreakdown = new Map<number, { p: number; p2: number; p3: number }>();
    for (const row of policyPtypeCounts) {
      if (!bundleBreakdown.has(row.bundle_id)) {
        bundleBreakdown.set(row.bundle_id, { p: 0, p2: 0, p3: 0 });
      }
      const b = bundleBreakdown.get(row.bundle_id)!;
      if (row.ptype === 'p') b.p = row._count.policy_name;
      else if (row.ptype === 'p2') b.p2 = row._count.policy_name;
      else if (row.ptype === 'p3') b.p3 = row._count.policy_name;
    }

    return bundles.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.description,
      policyCount: b._count.policies,
      roleCount: rolesByBundle.get(b.name)?.size ?? 0,
      sectionCount: bundleBreakdown.get(b.id)?.p ?? 0,
      menuCount: bundleBreakdown.get(b.id)?.p2 ?? 0,
      fieldCount: bundleBreakdown.get(b.id)?.p3 ?? 0,
      status: 'Active',
      assignedRoles: Array.from(rolesByBundle.get(b.name) ?? []).sort(),
      created_at: b.created_at,
      updated_at: b.updated_at,
    }));
  }

  /**
   * Get single Policy Bundle by ID.
   */
  async getPolicyBundleById(id: number) {
    const bundle = await this.prisma.policy_bundle.findUnique({
      where: { id },
      include: {
        policies: true,
        _count: {
          select: { policies: true },
        },
      },
    });

    if (!bundle) {
      throw new NotFoundException(`Policy bundle with ID ${id} not found`);
    }

    const g3Rules = await this.prisma.casbin_rule.findMany({
      where: { ptype: 'g3', v1: bundle.name, v0: { not: null } },
      select: { v0: true },
    });

    const assignedRoles = Array.from(
      new Set(g3Rules.map((r) => r.v0 as string)),
    ).sort();

    const breakdown = { p: 0, p2: 0, p3: 0 };
    for (const p of bundle.policies) {
      if (p.ptype === 'p') breakdown.p++;
      else if (p.ptype === 'p2') breakdown.p2++;
      else if (p.ptype === 'p3') breakdown.p3++;
    }

    return {
      ...bundle,
      sectionCount: breakdown.p,
      menuCount: breakdown.p2,
      fieldCount: breakdown.p3,
      status: 'Active',
      assignedRoles,
    };
  }

  /**
   * Assign a role to a Policy Bundle.
   */
  async assignRoleToBundle(bundleId: number, roleName: string) {
    const bundle = await this.prisma.policy_bundle.findUnique({
      where: { id: bundleId },
    });
    if (!bundle) {
      throw new NotFoundException(`Policy bundle with ID ${bundleId} not found`);
    }
    await this.casbinService.assignBundleToRole(roleName, bundle.name);
    return { message: `Role "${roleName}" assigned to bundle "${bundle.name}"` };
  }

  /**
   * Remove a role from a Policy Bundle.
   */
  async removeRoleFromBundle(bundleId: number, roleName: string) {
    const bundle = await this.prisma.policy_bundle.findUnique({
      where: { id: bundleId },
    });
    if (!bundle) {
      throw new NotFoundException(`Policy bundle with ID ${bundleId} not found`);
    }
    await this.casbinService.removeBundleFromRole(roleName, bundle.name);
    return { message: `Role "${roleName}" removed from bundle "${bundle.name}"` };
  }

  /**
   * Get roles not yet assigned to this bundle.
   */
  async getAvailableRolesForBundle(bundleId: number): Promise<string[]> {
    const bundle = await this.prisma.policy_bundle.findUnique({
      where: { id: bundleId },
    });
    if (!bundle) {
      throw new NotFoundException(`Policy bundle with ID ${bundleId} not found`);
    }
    const allRoles = (await this.getRoles()).map((r) => r.role);
    const assignedRules = await this.prisma.casbin_rule.findMany({
      where: { ptype: 'g3', v1: bundle.name, v0: { not: null } },
      select: { v0: true },
    });
    const assignedSet = new Set(assignedRules.map((r) => r.v0 as string));
    return allRoles.filter((r) => !assignedSet.has(r)).sort();
  }

  /**
   * Create a new Policy Bundle with optional initial policies.
   */
  async createPolicyBundle(dto: {
    name: string;
    description?: string;
    policyNames?: string[];
  }) {
    const existing = await this.prisma.policy_bundle.findUnique({
      where: { name: dto.name },
    });

    if (existing) {
      throw new BadRequestException(`Policy bundle "${dto.name}" already exists`);
    }

    const bundle = await this.prisma.policy_bundle.create({
      data: {
        name: dto.name,
        description: dto.description ?? null,
      },
    });

    if (dto.policyNames && dto.policyNames.length > 0) {
      for (const policyName of dto.policyNames) {
        await this.addPolicyToBundle(bundle.id, policyName);
      }
    }

    await this.casbinService.reloadPolicy();
    return bundle;
  }

  /**
   * Update a Policy Bundle's name and/or description, and optionally update policies.
   */
  async updatePolicyBundle(
    id: number,
    dto: { name?: string; description?: string; policyNames?: string[] },
  ) {
    const existing = await this.prisma.policy_bundle.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`Policy bundle with ID ${id} not found`);
    }

    const oldName = existing.name;
    const newName = dto.name && dto.name !== oldName ? dto.name : oldName;

    if (newName !== oldName) {
      const nameConflict = await this.prisma.policy_bundle.findUnique({
        where: { name: newName },
      });
      if (nameConflict) {
        throw new BadRequestException(`Policy bundle "${newName}" already exists`);
      }

      // Update Casbin rules referencing the bundle name in g and g3
      await this.prisma.$transaction([
        this.prisma.casbin_rule.updateMany({
          where: { ptype: 'g', v0: oldName },
          data: { v0: newName },
        }),
        this.prisma.casbin_rule.updateMany({
          where: { ptype: 'g3', v1: oldName },
          data: { v1: newName },
        }),
      ]);
    }

    const updated = await this.prisma.policy_bundle.update({
      where: { id },
      data: {
        name: newName,
        description: dto.description !== undefined ? dto.description : existing.description,
      },
    });

    await this.casbinService.reloadPolicy();
    if (dto.policyNames !== undefined) {
      await this.setBundlePolicies(id, dto.policyNames);
    } else {
      await this.casbinService.reloadPolicy();
    }

    return updated;
  }

  /**
   * Delete a Policy Bundle (cleans up Casbin g and g3 rules and DB records).
   */
  async deletePolicyBundle(id: number) {
    const bundle = await this.prisma.policy_bundle.findUnique({
      where: { id },
    });

    if (!bundle) {
      throw new NotFoundException(`Policy bundle with ID ${id} not found`);
    }

    // Delete g and g3 rules in Casbin
    await this.prisma.$transaction([
      this.prisma.casbin_rule.deleteMany({
        where: { ptype: 'g', v0: bundle.name },
      }),
      this.prisma.casbin_rule.deleteMany({
        where: { ptype: 'g3', v1: bundle.name },
      }),
      this.prisma.policy_bundle.delete({
        where: { id },
      }),
    ]);

    await this.casbinService.reloadPolicy();
    return { message: `Policy bundle "${bundle.name}" deleted successfully` };
  }

  // ==========================================================================
  // BUNDLE POLICIES MANAGEMENT
  // ==========================================================================

  /**
   * Get all policies contained in a bundle with their full definitions.
   */
  async getBundlePolicies(bundleId: number): Promise<BundlePolicyEntry[]> {
    const bundle = await this.prisma.policy_bundle.findUnique({
      where: { id: bundleId },
    });

    if (!bundle) {
      throw new NotFoundException(`Policy bundle with ID ${bundleId} not found`);
    }

    const mappings = await this.prisma.policy_bundle_policy.findMany({
      where: { bundle_id: bundleId },
      orderBy: { policy_name: 'asc' },
    });

    const entries: BundlePolicyEntry[] = [];

    for (const mapping of mappings) {
      const definitions = await this.getPolicyDefinitions(
        mapping.policy_name,
        mapping.ptype as PolicyType,
      );

      for (const def of definitions) {
        entries.push({
          permission: mapping.policy_name,
          ...def,
        });
      }
    }

    return entries;
  }

  /**
   * Get policies that are not yet part of the given bundle.
   */
  async getAvailablePoliciesForBundle(bundleId: number): Promise<PolicySummary[]> {
    const allPolicies = await this.getPolicies();
    const existing = await this.prisma.policy_bundle_policy.findMany({
      where: { bundle_id: bundleId },
      select: { policy_name: true, ptype: true },
    });

    const existingKeys = new Set(
      existing.map((e) => `${e.ptype}:${e.policy_name}`),
    );

    return allPolicies.filter(
      (p) => !existingKeys.has(`${p.ptype}:${p.permission}`),
    );
  }

  /**
   * Add an existing individual policy (P, P2, or P3) to a Policy Bundle.
   */
  async addPolicyToBundle(
    bundleId: number,
    policyName: string,
    ptype?: PolicyType,
  ) {
    const bundle = await this.prisma.policy_bundle.findUnique({
      where: { id: bundleId },
    });

    if (!bundle) {
      throw new NotFoundException(`Policy bundle with ID ${bundleId} not found`);
    }

    // Determine ptype if not passed
    let resolvedPtype: PolicyType = ptype ?? 'p';
    if (!ptype) {
      const rule = await this.prisma.casbin_rule.findFirst({
        where: { ptype: { in: ['p', 'p2', 'p3'] }, v0: policyName },
        select: { ptype: true },
      });
      if (!rule) {
        throw new NotFoundException(`Policy "${policyName}" was not found in policy definitions`);
      }
      resolvedPtype = rule.ptype as PolicyType;
    }

    // Enforce parent-child consistency: auto-include parents if missing
    if (resolvedPtype === 'p3') {
      const p3Rule = await this.prisma.casbin_rule.findFirst({
        where: { ptype: 'p3', v0: policyName },
      });
      if (p3Rule) {
        const parentMenu = p3Rule.v3 || p3Rule.v4;
        if (parentMenu) {
          const menuMapped = await this.prisma.policy_bundle_policy.findFirst({
            where: { bundle_id: bundleId, policy_name: parentMenu },
          });
          if (!menuMapped) {
            await this.addPolicyToBundle(bundleId, parentMenu, 'p2');
          }
        }
      }
    } else if (resolvedPtype === 'p2') {
      const p2Rule = await this.prisma.casbin_rule.findFirst({
        where: { ptype: 'p2', v0: policyName },
      });
      if (p2Rule && p2Rule.v2) {
        const parentSecKey = p2Rule.v2;
        const secRule = await this.prisma.casbin_rule.findFirst({
          where: { ptype: 'p', OR: [{ v4: parentSecKey }, { v2: parentSecKey }] },
        });
        if (secRule && secRule.v0) {
          const secMapped = await this.prisma.policy_bundle_policy.findFirst({
            where: { bundle_id: bundleId, policy_name: secRule.v0 },
          });
          if (!secMapped) {
            await this.addPolicyToBundle(bundleId, secRule.v0, 'p');
          }
        }
      }
    }

    // Add to policy_bundle_policy table
    const alreadyMapped = await this.prisma.policy_bundle_policy.findFirst({
      where: {
        bundle_id: bundleId,
        policy_name: policyName,
        ptype: resolvedPtype,
      },
    });

    if (!alreadyMapped) {
      await this.prisma.policy_bundle_policy.create({
        data: {
          bundle_id: bundleId,
          policy_name: policyName,
          ptype: resolvedPtype,
        },
      });
    }

    // Add (g, bundleName, policyName) rule to Casbin
    const alreadyInCasbin = await this.prisma.casbin_rule.findFirst({
      where: {
        ptype: 'g',
        v0: bundle.name,
        v1: policyName,
      },
    });

    if (!alreadyInCasbin) {
      await this.prisma.casbin_rule.create({
        data: {
          ptype: 'g',
          v0: bundle.name,
          v1: policyName,
          v2: null,
          v3: null,
          v4: null,
          v5: null,
          v6: null,
        },
      });
    }

    await this.casbinService.reloadPolicy();
    return {
      message: `Policy "${policyName}" (${resolvedPtype.toUpperCase()}) added to bundle "${bundle.name}"`,
    };
  }

  /**
   * Remove a policy from a Policy Bundle with CASCADING REMOVAL.
   * If a Section is removed, all its child Menus and child Fields are removed.
   * If a Menu is removed, all its child Fields are removed.
   */
  async removePolicyFromBundle(bundleId: number, policyName: string) {
    const bundle = await this.prisma.policy_bundle.findUnique({
      where: { id: bundleId },
    });

    if (!bundle) {
      throw new NotFoundException(`Policy bundle with ID ${bundleId} not found`);
    }

    // Determine what policies to remove (cascading removal)
    const policiesToRemove = new Set<string>([policyName]);

    // Check what type of policy policyName is
    const rule = await this.prisma.casbin_rule.findFirst({
      where: { v0: policyName, ptype: { in: ['p', 'p2', 'p3'] } },
    });

    if (rule?.ptype === 'p') {
      const secKey = rule.v4 || rule.v2 || '';
      // Find all child menus whose parent is this section key
      const childMenus = await this.prisma.casbin_rule.findMany({
        where: { ptype: 'p2', v2: secKey },
        select: { v0: true },
      });
      const menuKeys = childMenus.map((m) => m.v0!).filter(Boolean);
      for (const mk of menuKeys) policiesToRemove.add(mk);

      // Find all child fields under this section or its menus
      const childFields = await this.prisma.casbin_rule.findMany({
        where: {
          ptype: 'p3',
          OR: [
            { v2: secKey },
            { v3: { in: menuKeys } },
            { v4: { in: menuKeys } },
          ],
        },
        select: { v0: true },
      });
      for (const cf of childFields) {
        if (cf.v0) policiesToRemove.add(cf.v0);
      }
    } else if (rule?.ptype === 'p2') {
      const menuKey = policyName;
      // Find all child fields under this menu
      const childFields = await this.prisma.casbin_rule.findMany({
        where: {
          ptype: 'p3',
          OR: [{ v3: menuKey }, { v4: menuKey }],
        },
        select: { v0: true },
      });
      for (const cf of childFields) {
        if (cf.v0) policiesToRemove.add(cf.v0);
      }
    }

    const removeList = Array.from(policiesToRemove);

    // Remove from policy_bundle_policy table
    await this.prisma.policy_bundle_policy.deleteMany({
      where: {
        bundle_id: bundleId,
        policy_name: { in: removeList },
      },
    });

    // Remove from Casbin casbin_rule (ptype='g', v0=bundle.name, v1 in removeList)
    await this.prisma.casbin_rule.deleteMany({
      where: {
        ptype: 'g',
        v0: bundle.name,
        v1: { in: removeList },
      },
    });

    await this.casbinService.reloadPolicy();
    return {
      message: `Removed ${removeList.length} policy/policies (including cascading children) from bundle "${bundle.name}"`,
      removedPolicies: removeList,
    };
  }

  /**
   * Replace/sync all policies in a Policy Bundle atomically.
   * Performs cascading removal of deselected policies and auto-inclusion of parents for newly selected policies.
   */
  async setBundlePolicies(bundleId: number, policyNames: string[]) {
    const bundle = await this.prisma.policy_bundle.findUnique({
      where: { id: bundleId },
    });

    if (!bundle) {
      throw new NotFoundException(`Policy bundle with ID ${bundleId} not found`);
    }

    const currentMappings = await this.prisma.policy_bundle_policy.findMany({
      where: { bundle_id: bundleId },
    });

    const currentPolicyNames = new Set(currentMappings.map((m) => m.policy_name));
    const targetPolicyNames = new Set(policyNames);

    // Identify removals: policies currently in bundle but not in target
    const toRemove = Array.from(currentPolicyNames).filter((p) => !targetPolicyNames.has(p));

    // Cascading removal calculation for deselected items
    const allToRemove = new Set<string>();
    for (const p of toRemove) {
      allToRemove.add(p);
      const rule = await this.prisma.casbin_rule.findFirst({
        where: { v0: p, ptype: { in: ['p', 'p2', 'p3'] } },
      });
      if (rule?.ptype === 'p') {
        const secKey = rule.v4 || rule.v2 || '';
        const childMenus = await this.prisma.casbin_rule.findMany({
          where: { ptype: 'p2', v2: secKey },
          select: { v0: true },
        });
        const menuKeys = childMenus.map((m) => m.v0!).filter(Boolean);
        for (const mk of menuKeys) allToRemove.add(mk);

        const childFields = await this.prisma.casbin_rule.findMany({
          where: {
            ptype: 'p3',
            OR: [
              { v2: secKey },
              { v3: { in: menuKeys } },
              { v4: { in: menuKeys } },
            ],
          },
          select: { v0: true },
        });
        for (const cf of childFields) {
          if (cf.v0) allToRemove.add(cf.v0);
        }
      } else if (rule?.ptype === 'p2') {
        const menuKey = p;
        const childFields = await this.prisma.casbin_rule.findMany({
          where: {
            ptype: 'p3',
            OR: [{ v3: menuKey }, { v4: menuKey }],
          },
          select: { v0: true },
        });
        for (const cf of childFields) {
          if (cf.v0) allToRemove.add(cf.v0);
        }
      }
    }

    if (allToRemove.size > 0) {
      const removeList = Array.from(allToRemove);
      await this.prisma.policy_bundle_policy.deleteMany({
        where: {
          bundle_id: bundleId,
          policy_name: { in: removeList },
        },
      });
      await this.prisma.casbin_rule.deleteMany({
        where: {
          ptype: 'g',
          v0: bundle.name,
          v1: { in: removeList },
        },
      });
    }

    // Now add new policies (excluding any that were pruned in allToRemove)
    const toAdd = Array.from(targetPolicyNames).filter((p) => !allToRemove.has(p));
    for (const p of toAdd) {
      const rule = await this.prisma.casbin_rule.findFirst({
        where: { v0: p, ptype: { in: ['p', 'p2', 'p3'] } },
      });
      if (!rule) continue;
      await this._ensurePolicyInBundle(bundleId, bundle.name, p, rule.ptype as PolicyType);
    }

    await this.casbinService.reloadPolicy();
    return {
      message: `Updated policies for bundle "${bundle.name}"`,
      bundleId,
    };
  }

  private async _ensurePolicyInBundle(
    bundleId: number,
    bundleName: string,
    policyName: string,
    ptype: PolicyType,
  ) {
    if (ptype === 'p3') {
      const p3Rule = await this.prisma.casbin_rule.findFirst({
        where: { ptype: 'p3', v0: policyName },
      });
      if (p3Rule) {
        const parentMenu = p3Rule.v3 || p3Rule.v4;
        if (parentMenu) {
          await this._ensurePolicyInBundle(bundleId, bundleName, parentMenu, 'p2');
        }
      }
    } else if (ptype === 'p2') {
      const p2Rule = await this.prisma.casbin_rule.findFirst({
        where: { ptype: 'p2', v0: policyName },
      });
      if (p2Rule && p2Rule.v2) {
        const parentSecKey = p2Rule.v2;
        const secRule = await this.prisma.casbin_rule.findFirst({
          where: { ptype: 'p', OR: [{ v4: parentSecKey }, { v2: parentSecKey }] },
        });
        if (secRule?.v0) {
          await this._ensurePolicyInBundle(bundleId, bundleName, secRule.v0, 'p');
        }
      }
    }

    const existingMapping = await this.prisma.policy_bundle_policy.findFirst({
      where: { bundle_id: bundleId, policy_name: policyName },
    });
    if (!existingMapping) {
      await this.prisma.policy_bundle_policy.create({
        data: {
          bundle_id: bundleId,
          policy_name: policyName,
          ptype,
        },
      });
    }

    const existingCasbin = await this.prisma.casbin_rule.findFirst({
      where: { ptype: 'g', v0: bundleName, v1: policyName },
    });
    if (!existingCasbin) {
      await this.prisma.casbin_rule.create({
        data: {
          ptype: 'g',
          v0: bundleName,
          v1: policyName,
          v2: null,
          v3: null,
          v4: null,
          v5: null,
          v6: null,
        },
      });
    }
  }

  /**
   * Get the canonical Section -> Menu -> Field resource hierarchy.
   */
  async getResourceHierarchy(): Promise<ResourceHierarchy> {
    const [pRules, p2Rules, p3Rules] = await Promise.all([
      this.prisma.casbin_rule.findMany({ where: { ptype: 'p' }, orderBy: { id: 'asc' } }),
      this.prisma.casbin_rule.findMany({ where: { ptype: 'p2' }, orderBy: { id: 'asc' } }),
      this.prisma.casbin_rule.findMany({ where: { ptype: 'p3' }, orderBy: { id: 'asc' } }),
    ]);

    const formatName = (str: string) => {
      return str
        .replace(/[_-]/g, ' ')
        .replace(/\b\w/g, (char) => char.toUpperCase())
        .trim();
    };

    const sections: HierarchySection[] = [];

    for (const p of pRules) {
      const secKey = p.v4 || p.v2 || '';
      if (!secKey) continue;

      const secName = formatName(secKey);
      const secMenus: HierarchyMenu[] = [];

      // Find P2 menus whose parent is this section key
      const childP2 = p2Rules.filter((r) => r.v2 === secKey);

      for (const m of childP2) {
        const menuKey = m.v0 || '';
        const meta = parseP2Metadata(m.v3);
        const menuName = meta.displayName || formatName(menuKey);

        // Find P3 fields whose section is secKey and module/section is menuKey
        const childP3 = p3Rules.filter(
          (r) =>
            (r.v2 === secKey || r.v4 === secKey) &&
            (r.v3 === menuKey || r.v4 === menuKey),
        );

        const fields: HierarchyField[] = childP3.map((f) => ({
          key: f.v5 || '',
          name: formatName(f.v5 || ''),
          policy: f.v0 || '',
          policyName: f.v0 || '',
          access: f.v6 || 'read',
        }));

        secMenus.push({
          key: menuKey,
          name: menuName,
          displayName: menuName,
          policy: menuKey,
          policyName: menuKey,
          route: meta.route,
          icon: meta.icon,
          order: meta.order,
          fields,
        });
      }

      sections.push({
        key: secKey,
        name: secName,
        policy: p.v0 || '',
        policyName: p.v0 || '',
        access: p.v5 || 'read',
        menus: secMenus,
      });
    }

    return { sections };
  }

  // ==========================================================================
  // POLICY DEFINITIONS BROWSER
  // ==========================================================================

  /**
   * List all individual policies in the application (P, P2, P3).
   */
  async getPolicies(): Promise<PolicySummary[]> {
    const rows = await this.prisma.casbin_rule.findMany({
      where: { ptype: { in: ['p', 'p2', 'p3'] }, v0: { not: null } },
      orderBy: { id: 'asc' },
    });

    const map = new Map<string, PolicySummary>();

    for (const row of rows) {
      const ptype = row.ptype as PolicyType;
      const name = row.v0 as string;
      const mapKey = `${ptype}:${name}`;

      const entry = map.get(mapKey) ?? {
        permission: name,
        ptype,
        definitions: [],
      };

      if (ptype === 'p2') {
        entry.definitions.push({
          ptype: 'p2',
          lob: row.v1,
          parent: row.v2,
          meta: row.v3,
          ...parseP2Metadata(row.v3),
        });
      } else if (ptype === 'p3') {
        entry.definitions.push({
          ptype: 'p3',
          lob: row.v1,
          page: row.v2,
          module: row.v3,
          section: row.v4,
          field: row.v5,
          access: row.v6,
        });
      } else {
        entry.definitions.push({
          ptype: 'p',
          lob: row.v1,
          page: row.v2,
          module: row.v3,
          section: row.v4,
          access: row.v5,
        });
      }

      map.set(mapKey, entry);
    }

    return Array.from(map.values());
  }

  /**
   * All definitions for a single policy name.
   */
  async getPolicyDefinitions(
    permission: string,
    ptype: PolicyType = 'p',
  ): Promise<PolicyDefinition[]> {
    const rows = await this.prisma.casbin_rule.findMany({
      where: { ptype, v0: permission },
      orderBy: { id: 'asc' },
    });

    if (ptype === 'p2') {
      return rows.map((row) => ({
        ptype: 'p2' as const,
        lob: row.v1,
        parent: row.v2,
        meta: row.v3,
        ...parseP2Metadata(row.v3),
      }));
    }

    if (ptype === 'p3') {
      return rows.map((row) => ({
        ptype: 'p3' as const,
        lob: row.v1,
        page: row.v2,
        module: row.v3,
        section: row.v4,
        field: row.v5,
        access: row.v6,
      }));
    }

    return rows.map((row) => ({
      ptype: 'p' as const,
      lob: row.v1,
      page: row.v2,
      module: row.v3,
      section: row.v4,
      access: row.v5,
    }));
  }

  // ==========================================================================
  // ENFORCER CHECKER
  // ==========================================================================

  /**
   * Runs the centralized Casbin enforce() through the Policy Bundle hierarchy.
   */
  async checkEnforcer(params: {
    ptype?: PolicyType;
    role: string;
    lob?: string;
    page?: string;
    module?: string;
    section?: string;
    field?: string;
    access?: string;
    key?: string;
  }): Promise<{
    allowed: boolean;
    ptype: PolicyType;
    role: string;
    lob?: string;
    page?: string;
    module?: string;
    section?: string;
    field?: string;
    access?: string;
    key?: string;
  }> {
    const ptype: PolicyType =
      params.ptype === 'p2' ? 'p2' : params.ptype === 'p3' ? 'p3' : 'p';
    const { role } = params;

    const allowed = await this.casbinService.enforce({
      sub: role,
      lob: params.lob,
      page: params.page,
      module: params.module,
      section: params.section,
      field: params.field,
      access: params.access,
      key: params.key,
      ptype,
    });

    return {
      allowed,
      ptype,
      role,
      lob: params.lob,
      page: params.page,
      module: params.module,
      section: params.section,
      field: params.field,
      access: params.access,
      key: params.key,
    };
  }
}
