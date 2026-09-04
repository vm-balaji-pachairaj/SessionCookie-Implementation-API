import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  newEnforcer,
  Enforcer,
  newModelFromString,
  EnforceContext,
} from 'casbin';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../PrismaService/prisma.service';
import { PrismaCasbinAdapter } from './prisma-casbin.adapter';
import { parseP2Metadata } from './p2-metadata.util';
import { createPolicyBundleTables } from '../../prisma/create-policy-bundle-tables';

export interface FieldPermission {
  permission: string;
  lob: string;
  page: string;
  module: string;
  section: string;
  field: string;
  access: string;
}

export interface MenuInfo {
  key: string;
  lob: string;
  parent: string;
  displayName: string;
  route: string;
  icon: string;
  order: number;
}

export interface EnforceOptions {
  sub: string;
  lob?: string;
  page?: string;
  module?: string;
  section?: string;
  field?: string;
  access?: string;
  key?: string;
  ptype?: 'p' | 'p2' | 'p3';
}

@Injectable()
export class CasbinService implements OnModuleInit {
  private enforcer!: Enforcer;
  private readonly logger = new Logger(CasbinService.name);

  // In-memory lookup sets derived directly from Casbin enforcer rules
  // role -> set of assigned bundle names (from g3)
  private roleBundles = new Map<string, Set<string>>();
  // bundle -> set of contained policy names (from g)
  private bundlePolicies = new Map<string, Set<string>>();

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing Casbin with Policy Bundle architecture...');

      // 1. Ensure PostgreSQL schema & tables exist idempotently
      await createPolicyBundleTables();

      // 2. Load Casbin model configuration
      const modelPath = path.join(
        process.cwd(),
        'src',
        'casbin',
        'model',
        'rbac.conf',
      );

      const model = newModelFromString(fs.readFileSync(modelPath, 'utf-8'));

      // 3. Initialize the Casbin enforcer using Prisma adapter (reads directly from database)
      this.enforcer = await newEnforcer(
        model,
        new PrismaCasbinAdapter(this.prisma),
      );

      // 4. Register custom matcher function `g3_has_policy`
      // Used by matcher: m = g3_has_policy(r.sub, p.perm) && ...
      await this.enforcer.addFunction(
        'g3_has_policy',
        (sub: string, perm: string): boolean => this.g3_has_policy(sub, perm),
      );

      // 5. Build in-memory fast index from loaded rules
      await this.rebuildCacheFromEnforcer();

      this.logger.log(
        `Casbin initialized successfully. Loaded ${this.roleBundles.size} role-bundle mapping(s) and ${this.bundlePolicies.size} bundle-policy mapping(s).`,
      );
    } catch (error) {
      this.logger.error(
        'Failed to initialize Casbin',
        error instanceof Error ? error.stack : String(error),
      );
      throw error;
    }
  }

  /**
   * Rebuilds fast in-memory sets from the enforcer's loaded rules.
   * Called on startup and whenever rules are reloaded from the database.
   */
  private async rebuildCacheFromEnforcer(): Promise<void> {
    this.roleBundles.clear();
    this.bundlePolicies.clear();

    // Load g3 rules: (g3, role, bundle)
    const g3Rules = await this.enforcer.getNamedGroupingPolicy('g3');
    for (const [role, bundle] of g3Rules) {
      if (!role || !bundle) continue;
      if (!this.roleBundles.has(role)) {
        this.roleBundles.set(role, new Set());
      }
      this.roleBundles.get(role)!.add(bundle);
    }

    // Load g rules: (g, bundle, policy)
    const gRules = await this.enforcer.getGroupingPolicy();
    for (const [bundle, policy] of gRules) {
      if (!bundle || !policy) continue;
      if (!this.bundlePolicies.has(bundle)) {
        this.bundlePolicies.set(bundle, new Set());
      }
      this.bundlePolicies.get(bundle)!.add(policy);
    }
  }

  /**
   * Synchronous check used by Casbin matchers:
   * Returns true if role `sub` is assigned to any Policy Bundle that contains policy `perm`.
   */
  g3_has_policy(sub: string, perm: string): boolean {
    if (!sub || !perm) return false;
    const bundles = this.roleBundles.get(sub);
    if (!bundles || bundles.size === 0) return false;

    for (const bundle of bundles) {
      const policies = this.bundlePolicies.get(bundle);
      if (policies && policies.has(perm)) {
        return true;
      }
    }
    return false;
  }

  // ==========================================================================
  // Centralized Enforcement Entry Point
  // Handles:
  // - Section-level policies (P)
  // - Menu-level policies (P2)
  // - Field-level policies (P3)
  // - Parameter objects (EnforceOptions)
  // ==========================================================================

  async enforce(options: EnforceOptions): Promise<boolean>;
  async enforce(sub: string, menuKey: string): Promise<boolean>;
  async enforce(
    sub: string,
    lob: string,
    page: string,
    mod: string,
    sec: string,
    access: string,
  ): Promise<boolean>;
  async enforce(
    sub: string,
    lob: string,
    page: string,
    mod: string,
    sec: string,
    field: string,
    access: string,
  ): Promise<boolean>;
  async enforce(
    arg1: string | EnforceOptions,
    arg2?: string,
    arg3?: string,
    arg4?: string,
    arg5?: string,
    arg6?: string,
    arg7?: string,
  ): Promise<boolean> {
    if (typeof arg1 === 'object') {
      return this.enforceWithOptions(arg1);
    }

    const sub = arg1;

    // 2 string arguments: (sub, menuKey) -> P2 Menu enforcement
    if (arg2 !== undefined && arg3 === undefined) {
      return this.enforceMenu(sub, arg2);
    }

    // 7 string arguments: (sub, lob, page, mod, sec, field, access) -> P3 Field enforcement
    if (arg7 !== undefined) {
      return this.enforceFieldInternal(
        sub,
        arg2!,
        arg3!,
        arg4!,
        arg5!,
        arg6!,
        arg7,
      );
    }

    // 6 string arguments: (sub, lob, page, mod, sec, access) -> P Section enforcement
    if (arg6 !== undefined) {
      return this.enforcer.enforce(sub, arg2!, arg3!, arg4!, arg5!, arg6);
    }

    return false;
  }

  private async enforceWithOptions(options: EnforceOptions): Promise<boolean> {
    const { sub, lob = '', page = '', module = '', section = '', field, access = '', key, ptype } = options;

    if (ptype === 'p2' || (key && !page && !module)) {
      return this.enforceMenu(sub, key ?? '');
    }

    if (ptype === 'p3' || field !== undefined) {
      return this.enforceFieldInternal(sub, lob, page, module, section, field ?? '', access);
    }

    return this.enforcer.enforce(sub, lob, page, module, section, access);
  }

  private async enforceMenu(role: string, key: string): Promise<boolean> {
    const menu = await this.getMenuInfo(key);
    if (!menu) {
      return false;
    }
    return this.g3_has_policy(role, key);
  }

  private async enforceFieldInternal(
    sub: string,
    lob: string,
    page: string,
    mod: string,
    sec: string,
    field: string,
    access: string,
  ): Promise<boolean> {
    const matcher = this.enforcer
      .getModel()
      .model.get('m')
      ?.get('m3')?.value;

    if (!matcher) {
      throw new Error('m3 matcher not found in the Casbin model');
    }

    return this.enforcer.enforceWithMatcher(
      matcher,
      new EnforceContext('r3', 'p3', 'e', 'm3'),
      sub,
      lob,
      page,
      mod,
      sec,
      field,
      access,
    );
  }

  // ==========================================================================
  // Role & Policy Bundle Resolution Methods
  // ==========================================================================

  /**
   * Get all Policy Bundles assigned to a role.
   */
  async getBundlesForRole(roleName: string): Promise<string[]> {
    const bundles = this.roleBundles.get(roleName);
    return bundles ? Array.from(bundles).sort() : [];
  }

  /**
   * Assign a Policy Bundle to a role using Casbin g3.
   */
  async assignBundleToRole(role: string, bundle: string): Promise<void> {
    await this.enforcer.addNamedGroupingPolicy('g3', role, bundle);
    if (!this.roleBundles.has(role)) {
      this.roleBundles.set(role, new Set());
    }
    this.roleBundles.get(role)!.add(bundle);
  }

  /**
   * Remove a Policy Bundle from a role (removes g3 link).
   */
  async removeBundleFromRole(role: string, bundle: string): Promise<void> {
    await this.enforcer.removeNamedGroupingPolicy('g3', role, bundle);
    const bundles = this.roleBundles.get(role);
    if (bundles) {
      bundles.delete(bundle);
    }
  }

  /**
   * Get all policies contained in a Policy Bundle.
   */
  async getPoliciesForBundle(bundleName: string): Promise<string[]> {
    const policies = this.bundlePolicies.get(bundleName);
    return policies ? Array.from(policies).sort() : [];
  }

  /**
   * Add an individual policy to a Policy Bundle using Casbin g.
   */
  async addPolicyToBundle(bundle: string, policy: string): Promise<void> {
    await this.enforcer.addGroupingPolicy(bundle, policy);
    if (!this.bundlePolicies.has(bundle)) {
      this.bundlePolicies.set(bundle, new Set());
    }
    this.bundlePolicies.get(bundle)!.add(policy);
  }

  /**
   * Remove an individual policy from a Policy Bundle (removes g link).
   */
  async removePolicyFromBundle(bundle: string, policy: string): Promise<void> {
    await this.enforcer.removeGroupingPolicy(bundle, policy);
    const policies = this.bundlePolicies.get(bundle);
    if (policies) {
      policies.delete(policy);
    }
  }

  /**
   * Reload all policies from the database into the enforcer and rebuild memory cache.
   */
  async reloadPolicy(): Promise<void> {
    await this.enforcer.loadPolicy();
    await this.rebuildCacheFromEnforcer();
  }

  /**
   * Expose the Casbin enforcer.
   */
  getEnforcer(): Enforcer {
    return this.enforcer;
  }

  /**
   * Get all g2 mappings for a role (landing page).
   */
  async getLandingPagesForRole(roleName: string): Promise<string[][]> {
    return this.enforcer.getFilteredNamedGroupingPolicy('g2', 0, roleName);
  }

  /**
   * Get section-level permissions (P) for a role, resolved through its assigned Policy Bundles.
   */
  async getPermissionsForRole(roleName: string) {
    const bundles = await this.getBundlesForRole(roleName);
    const permissions: Array<{
      permission: string;
      lob: string;
      page: string;
      module: string;
      section: string;
      access: string;
    }> = [];

    const seenPolicies = new Set<string>();

    for (const bundle of bundles) {
      const policyNames = await this.getPoliciesForBundle(bundle);

      for (const policyName of policyNames) {
        if (seenPolicies.has(policyName)) continue;
        seenPolicies.add(policyName);

        const policies = await this.enforcer.getFilteredPolicy(0, policyName);
        for (const policy of policies) {
          permissions.push({
            permission: policy[0],
            lob: policy[1],
            page: policy[2],
            module: policy[3],
            section: policy[4],
            access: policy[5],
          });
        }
      }
    }

    return permissions;
  }

  /**
   * Get field-level permissions (P3) for a role, resolved through its assigned Policy Bundles.
   */
  async getFieldPermissionsForRole(roleName: string): Promise<FieldPermission[]> {
    const bundles = await this.getBundlesForRole(roleName);
    const fieldPermissions: FieldPermission[] = [];
    const seenPolicies = new Set<string>();

    for (const bundle of bundles) {
      const policyNames = await this.getPoliciesForBundle(bundle);

      for (const policyName of policyNames) {
        if (seenPolicies.has(policyName)) continue;
        seenPolicies.add(policyName);

        const policies = await this.enforcer.getFilteredNamedPolicy(
          'p3',
          0,
          policyName,
        );

        for (const policy of policies) {
          fieldPermissions.push({
            permission: policy[0],
            lob: policy[1],
            page: policy[2],
            module: policy[3],
            section: policy[4],
            field: policy[5],
            access: policy[6],
          });
        }
      }
    }

    return fieldPermissions;
  }

  /**
   * Look up P2 menu definition for a menu key.
   */
  async getMenuInfo(key: string): Promise<MenuInfo | null> {
    const [p2Policy] = await this.enforcer.getFilteredNamedPolicy('p2', 0, key);
    if (!p2Policy) {
      return null;
    }

    const [menuKey, lob, parent, meta] = p2Policy;
    return {
      key: menuKey,
      lob,
      parent,
      ...parseP2Metadata(meta),
    };
  }

  /**
   * Get all P2 menu definitions.
   */
  async getAllP2Menus(): Promise<MenuInfo[]> {
    const p2Policies = await this.enforcer.getNamedPolicy('p2');
    return p2Policies.map(([key, lob, parent, meta]) => ({
      key,
      lob,
      parent,
      ...parseP2Metadata(meta),
    }));
  }

  /**
   * Get menus assigned to a role, resolved through its assigned Policy Bundles.
   */
  async getMenusForRole(roleName: string): Promise<MenuInfo[]> {
    const bundles = await this.getBundlesForRole(roleName);
    const menus: MenuInfo[] = [];
    const seenMenuKeys = new Set<string>();

    for (const bundle of bundles) {
      const policyNames = await this.getPoliciesForBundle(bundle);

      for (const target of policyNames) {
        if (seenMenuKeys.has(target)) continue;
        seenMenuKeys.add(target);

        // Check if target is a P policy
        const permissionPolicies = await this.enforcer.getFilteredPolicy(
          0,
          target,
        );

        // If not a P policy, resolve as P2 menu definition
        if (permissionPolicies.length === 0) {
          const menuInfo = await this.getMenuInfo(target);
          if (menuInfo) {
            menus.push(menuInfo);
          }
        }
      }
    }

    const uniqueMenus = new Map(menus.map((menu) => [menu.key, menu]));
    return [...uniqueMenus.values()];
  }
}
