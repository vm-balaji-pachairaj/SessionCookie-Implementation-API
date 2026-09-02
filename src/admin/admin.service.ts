import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../PrismaService/prisma.service';
import { CasbinService } from '../casbin/casbin.service';

export interface RoleSummary {
  role: string;
  permissionCount: number;
}

export interface PolicyDefinition {
  lob: string | null;
  page: string | null;
  module: string | null;
  section: string | null;
  access: string | null;
}

export interface PolicySummary {
  permission: string;
  definitions: PolicyDefinition[];
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly casbinService: CasbinService,
  ) {}

  /**
   * Distinct policy names (v0 of ptype 'p' rows) — the set of actual,
   * assignable permissions as opposed to menu keys stored under 'g'.
   */
  private async getAllPolicyNames(): Promise<Set<string>> {
    const rows = await this.prisma.casbin_rule.findMany({
      where: { ptype: 'p', v0: { not: null } },
      select: { v0: true },
      distinct: ['v0'],
    });

    return new Set(rows.map((row) => row.v0 as string));
  }

  /**
   * List every user role in the application, with how many real
   * permissions (as opposed to menu mappings) each one has.
   */
  async getRoles(): Promise<RoleSummary[]> {
    const groupings = await this.prisma.casbin_rule.findMany({
      where: { ptype: 'g', v0: { not: null } },
      select: { v0: true, v1: true },
    });

    const policyNames = await this.getAllPolicyNames();

    const countByRole = new Map<string, number>();
    const roles = new Set<string>();

    for (const grouping of groupings) {
      const role = grouping.v0 as string;
      roles.add(role);

      if (grouping.v1 && policyNames.has(grouping.v1)) {
        countByRole.set(role, (countByRole.get(role) ?? 0) + 1);
      }
    }

    return Array.from(roles)
      .sort()
      .map((role) => ({
        role,
        permissionCount: countByRole.get(role) ?? 0,
      }));
  }

  /**
   * All permissions assigned to a role, resolved to their policy definition.
   */
  async getRolePermissions(role: string) {
    return this.casbinService.getPermissionsForRole(role);
  }

  /**
   * Policies (with their definitions) that exist in the application but are
   * not yet assigned to the given role — used by the "Add Policy" search.
   */
  async getAvailablePoliciesForRole(role: string): Promise<PolicySummary[]> {
    const allPolicies = await this.getPolicies();

    const assigned = await this.prisma.casbin_rule.findMany({
      where: { ptype: 'g', v0: role, v1: { not: null } },
      select: { v1: true },
    });

    const assignedNames = new Set(assigned.map((row) => row.v1 as string));

    return allPolicies.filter((policy) => !assignedNames.has(policy.permission));
  }

  /**
   * Assign an existing policy to a role, then reload the enforcer fresh
   * from the database (per requirement: full reload, no incremental add).
   */
  async addPolicyToRole(role: string, permission: string) {
    const policyExists = await this.prisma.casbin_rule.findFirst({
      where: { ptype: 'p', v0: permission },
    });

    if (!policyExists) {
      throw new NotFoundException(`Policy "${permission}" was not found`);
    }

    const alreadyAssigned = await this.prisma.casbin_rule.findFirst({
      where: { ptype: 'g', v0: role, v1: permission },
    });

    if (!alreadyAssigned) {
      await this.prisma.casbin_rule.create({
        data: {
          ptype: 'g',
          v0: role,
          v1: permission,
          v2: null,
          v3: null,
          v4: null,
          v5: null,
        },
      });
    }

    await this.casbinService.reloadPolicy();

    return { message: `Policy "${permission}" added to role "${role}"` };
  }

  /**
   * Remove a policy from a role, then reload the enforcer fresh from
   * the database (per requirement: full reload, no incremental remove).
   */
  async removePolicyFromRole(role: string, permission: string) {
    await this.prisma.casbin_rule.deleteMany({
      where: { ptype: 'g', v0: role, v1: permission },
    });

    await this.casbinService.reloadPolicy();

    return { message: `Policy "${permission}" removed from role "${role}"` };
  }

  /**
   * List every policy in the application. A policy name can have more
   * than one definition (row) — all of them are returned together.
   */
  async getPolicies(): Promise<PolicySummary[]> {
    const rows = await this.prisma.casbin_rule.findMany({
      where: { ptype: 'p', v0: { not: null } },
      orderBy: { id: 'asc' },
    });

    const map = new Map<string, PolicyDefinition[]>();

    for (const row of rows) {
      const name = row.v0 as string;
      const definitions = map.get(name) ?? [];

      definitions.push({
        lob: row.v1,
        page: row.v2,
        module: row.v3,
        section: row.v4,
        access: row.v5,
      });

      map.set(name, definitions);
    }

    return Array.from(map.entries()).map(([permission, definitions]) => ({
      permission,
      definitions,
    }));
  }

  /**
   * All definitions for a single policy name — used by the "View Access"
   * / "View Definition" modal.
   */
  async getPolicyDefinitions(permission: string): Promise<PolicyDefinition[]> {
    const rows = await this.prisma.casbin_rule.findMany({
      where: { ptype: 'p', v0: permission },
      orderBy: { id: 'asc' },
    });

    return rows.map((row) => ({
      lob: row.v1,
      page: row.v2,
      module: row.v3,
      section: row.v4,
      access: row.v5,
    }));
  }

  /**
   * Enforcer Checker (demo) — runs the real Casbin enforcer against a
   * role + policy dimensions and returns whether access is allowed.
   */
  async checkEnforcer(params: {
    role: string;
    lob: string;
    page: string;
    module: string;
    section: string;
    access: string;
  }): Promise<{
    allowed: boolean;
    role: string;
    lob: string;
    page: string;
    module: string;
    section: string;
    access: string;
  }> {
    const { role, lob, page, module, section, access } = params;

    const allowed = await this.casbinService.enforce(
      role,
      lob,
      page,
      module,
      section,
      access,
    );

    return { allowed, role, lob, page, module, section, access };
  }
}
