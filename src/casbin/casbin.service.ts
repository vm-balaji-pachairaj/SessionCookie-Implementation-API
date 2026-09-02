import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  newEnforcer,
  Enforcer,
  newModelFromString,
} from 'casbin';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../PrismaService/prisma.service';
import { PrismaCasbinAdapter } from './prisma-casbin.adapter';
// import { MENU_CONFIG } from "./menu.config";

interface CasbinPolicyRow {
  ptype: string;
  v0: string | null;
  v1: string | null;
  v2: string | null;
  v3: string | null;
  v4: string | null;
  v5: string | null;
}

@Injectable()
export class CasbinService implements OnModuleInit {
  private enforcer!: Enforcer;

  private readonly logger = new Logger(CasbinService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    try {
      this.logger.log('Initializing Casbin...');

      // ------------------------------------------------------------
      // 1. Load Casbin model
      // ------------------------------------------------------------
      const modelPath = path.join(
        process.cwd(),
        'src',
        'casbin',
        'model',
        'rbac.conf',
      );

      const model = newModelFromString(
        fs.readFileSync(modelPath, 'utf-8'),
      );

      await this.seedPoliciesFromCsvIfDatabaseIsEmpty();

      // The adapter loads casbin.casbin_rule into the enforcer and persists
      // later policy mutations through the same table.
      this.enforcer = await newEnforcer(
        model,
        new PrismaCasbinAdapter(this.prisma),
      );

      this.logger.log('Casbin enforcer created from database policies');

      this.logger.log(
        'Casbin initialized successfully',
      );
    } catch (error) {
      this.logger.error(
        'Failed to initialize Casbin',
        error instanceof Error
          ? error.stack
          : String(error),
      );

      throw error;
    }
  }

  /**
   * ------------------------------------------------------------
   * CSV → DB bootstrap
   *
   * Only seeds when casbin.casbin_rule is empty, so restarts never
   * re-insert or duplicate policy rows once the table has been seeded.
   * ------------------------------------------------------------
   */
  private async seedPoliciesFromCsvIfDatabaseIsEmpty(): Promise<void> {
    const existingCount = await this.prisma.casbin_rule.count();
    if (existingCount > 0) {
      this.logger.log(
        `Skipping Casbin policy seed: casbin_rule already has ${existingCount} row(s)`,
      );
      return;
    }

    const csvPolicies = await this.readPoliciesFromCsv();
    if (csvPolicies.length === 0) {
      throw new Error('No Casbin policies were found in the CSV files');
    }

    const { count } = await this.prisma.casbin_rule.createMany({
      data: csvPolicies,
      skipDuplicates: true,
    });

    this.logger.log(
      `Inserted ${count} new policy row(s) from CSV files (out of ${csvPolicies.length} total CSV rows)`,
    );
  }

  /**
   * ------------------------------------------------------------
   * Read all CSV files.
   *
   * The CSV is converted into:
   *
   * p, permission, lob, page, module, section, access
   *
   * =>
   *
   * {
   *   ptype: 'p',
   *   v0: 'permission',
   *   v1: 'lob',
   *   v2: 'page',
   *   v3: 'module',
   *   v4: 'section',
   *   v5: 'access'
   * }
   * ------------------------------------------------------------
   */
  private async readPoliciesFromCsv(): Promise<
    CasbinPolicyRow[]
  > {
    const policyDir = path.join(
      process.cwd(),
      'src',
      'casbin',
      'policies',
    );

    this.logger.log(
      `Looking for policies at: ${policyDir}`,
    );

    if (!fs.existsSync(policyDir)) {
      throw new Error(
        `Policy directory not found: ${policyDir}`,
      );
    }

    const csvFiles = fs
      .readdirSync(policyDir)
      .filter((file) =>
        file.toLowerCase().endsWith('.csv'),
      );

    if (csvFiles.length === 0) {
      throw new Error(
        `No policy CSV files found in ${policyDir}`,
      );
    }

    this.logger.log(
      `Found ${csvFiles.length} policy CSV file(s)`,
    );

    const policies: CasbinPolicyRow[] = [];

    for (const file of csvFiles) {
      const filePath = path.join(
        policyDir,
        file,
      );

      this.logger.log(
        `Reading policy file: ${file}`,
      );

      const content = fs.readFileSync(
        filePath,
        'utf-8',
      );

      const lines = content
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .filter((line) => !line.startsWith('#'));

      for (const [index, line] of lines.entries()) {
        try {
          const values = this.parseCsvLine(line);

          if (values.length === 0) {
            continue;
          }

          const [ptype, ...policyValues] = values;

          if (!['p', 'g', 'g2', 'g3'].includes(ptype)) {
            this.logger.warn(
              `Unknown policy type "${ptype}" in ${file}:${index + 1}`,
            );

            continue;
          }

          if (policyValues.length > 6) {
            throw new Error(
              `Policy contains more than 6 values`,
            );
          }

          policies.push({
            ptype,
            v0: policyValues[0] ?? null,
            v1: policyValues[1] ?? null,
            v2: policyValues[2] ?? null,
            v3: policyValues[3] ?? null,
            v4: policyValues[4] ?? null,
            v5: policyValues[5] ?? null,
          });
        } catch (error) {
          this.logger.error(
            `Failed to parse ${file}:${index + 1}`,
            error instanceof Error
              ? error.message
              : String(error),
          );
        }
      }
    }

    return policies;
  }

  /**
   * Simple CSV parser.
   */
  private parseCsvLine(
    line: string,
  ): string[] {
    return line
      .split(',')
      .map((value) => value.trim());
  }

  /**
   * Check whether a role is allowed to perform
   * an action on a specific resource.
   */
  async enforce(
    sub: string,
    lob: string,
    page: string,
    mod: string,
    sec: string,
    access: string,
  ): Promise<boolean> {
    return this.enforcer.enforce(
      sub,
      lob,
      page,
      mod,
      sec,
      access,
    );
  }

  /**
   * Get all g2 mappings for a role.
   */
  async getLandingPagesForRole(
    roleName: string,
  ): Promise<string[][]> {
    return this.enforcer.getFilteredNamedGroupingPolicy(
      'g2',
      0,
      roleName,
    );
  }

  /**
   * Expose the Casbin enforcer.
   */
  getEnforcer(): Enforcer {
    return this.enforcer;
  }

  /**
   * Reload all policies from the database into the enforcer.
   * Used by the admin console after a raw DB policy change (add/remove)
   * instead of incremental enforcer.addPolicy/removePolicy calls.
   */
  async reloadPolicy(): Promise<void> {
    await this.enforcer.loadPolicy();
  }

  /**
   * Get permissions for a role.
   */
  async getPermissionsForRole(
    roleName: string,
  ) {
    const groupingPolicies =
      await this.enforcer.getFilteredGroupingPolicy(
        0,
        roleName,
      );

    const permissions: Array<{
      permission: string;
      lob: string;
      page: string;
      module: string;
      section: string;
      access: string;
    }> = [];

    for (const grouping of groupingPolicies) {
      const permissionName = grouping[1];

      const policies =
        await this.enforcer.getFilteredPolicy(
          0,
          permissionName,
        );

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

    return permissions;
  }

  
  async getMenusForRole(
    roleName: string,
    ): Promise<string[]> {
    const groupingPolicies =
      await this.enforcer.getFilteredGroupingPolicy(
        0,
        roleName,
      );

    const menus: string[] = [];

    for (const grouping of groupingPolicies) {
      const target = grouping[1];

      if (!target) {
        continue;
      }

      // Check whether this target is a permission.
      const permissionPolicies =
        await this.enforcer.getFilteredPolicy(
          0,
          target,
        );

      // If there is no p policy for this target,
      // it is a menu mapping.
      if (permissionPolicies.length === 0) {
        menus.push(target);
      }
    }

    return [...new Set(menus)];
  }
}