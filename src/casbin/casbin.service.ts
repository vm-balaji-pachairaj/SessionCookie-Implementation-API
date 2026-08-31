import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import {
  newEnforcer,
  Enforcer,
  newModelFromString,
} from 'casbin';
import * as path from 'path';
import * as fs from 'fs';
import { PrismaService } from '../PrismaService/prisma.service';
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

      // ------------------------------------------------------------
      // 2. Create Enforcer
      // ------------------------------------------------------------
      this.enforcer = await newEnforcer(model);

      this.logger.log('Casbin enforcer created');

      // ------------------------------------------------------------
      // 3. CSV → DB synchronization
      // ------------------------------------------------------------
      await this.syncCsvWithDatabase();

      // ------------------------------------------------------------
      // 4. DB → Enforcer
      // ------------------------------------------------------------
      await this.loadPoliciesFromDatabase();

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
   * CSV → DB
   *
   * CSV is treated as the source of truth.
   *
   * New CSV policies are inserted into the database.
   * Policies removed from CSV are removed from the database.
   * Existing policies are left unchanged.
   * ------------------------------------------------------------
   */
  private async syncCsvWithDatabase(): Promise<void> {
    const csvPolicies = await this.readPoliciesFromCsv();

    this.logger.log(
      `CSV contains ${csvPolicies.length} policy rows`,
    );

    const dbPolicies = await this.prisma.casbin_rule.findMany();

    this.logger.log(
      `Database contains ${dbPolicies.length} policy rows`,
    );

    // ------------------------------------------------------------
    // Create comparable keys
    // ------------------------------------------------------------
    const createKey = (policy: CasbinPolicyRow) =>
      [
        policy.ptype,
        policy.v0,
        policy.v1,
        policy.v2,
        policy.v3,
        policy.v4,
        policy.v5,
      ].join('|');

    const csvKeys = new Set(
      csvPolicies.map(createKey),
    );

    const dbKeys = new Set(
      dbPolicies.map(createKey),
    );

    // ------------------------------------------------------------
    // Insert policies that exist in CSV but not in DB
    // ------------------------------------------------------------
    const policiesToInsert = csvPolicies.filter(
      (policy) => !dbKeys.has(createKey(policy)),
    );

    // ------------------------------------------------------------
    // Delete policies that exist in DB but not in CSV
    // ------------------------------------------------------------
    const policiesToDelete = dbPolicies.filter(
      (policy) => !csvKeys.has(createKey(policy)),
    );

    // ------------------------------------------------------------
    // Insert new policies
    // ------------------------------------------------------------
    if (policiesToInsert.length > 0) {
      await this.prisma.casbin_rule.createMany({
        data: policiesToInsert,
        skipDuplicates: true,
      });

      this.logger.log(
        `Inserted ${policiesToInsert.length} new policy rows`,
      );
    }

    // ------------------------------------------------------------
    // Delete removed policies
    // ------------------------------------------------------------
    if (policiesToDelete.length > 0) {
      for (const policy of policiesToDelete) {
        await this.prisma.casbin_rule.delete({
          where: {
            id: policy.id,
          },
        });
      }

      this.logger.log(
        `Deleted ${policiesToDelete.length} removed policy rows`,
      );
    }

    if (
      policiesToInsert.length === 0 &&
      policiesToDelete.length === 0
    ) {
      this.logger.log(
        'CSV and database policies are already synchronized',
      );
    }
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
   * ------------------------------------------------------------
   * DB → Enforcer
   *
   * The Enforcer is populated from casbin.casbin_rule.
   * ------------------------------------------------------------
   */
  private async loadPoliciesFromDatabase(): Promise<void> {
    const policies =
      await this.prisma.casbin_rule.findMany();

    this.logger.log(
      `Loading ${policies.length} policies from database into Casbin`,
    );

    for (const policy of policies) {
      const values = [
        policy.v0,
        policy.v1,
        policy.v2,
        policy.v3,
        policy.v4,
        policy.v5,
      ].filter(
        (value): value is string =>
          value !== null,
      );

      try {
        switch (policy.ptype) {
          case 'p':
            await this.enforcer.addPolicy(
              ...values,
            );
            break;

          case 'g':
            await this.enforcer.addGroupingPolicy(
              ...values,
            );
            break;

          case 'g2':
            await this.enforcer.addNamedGroupingPolicy(
              'g2',
              ...values,
            );
            break;

          case 'g3':
            await this.enforcer.addNamedGroupingPolicy(
              'g3',
              ...values,
            );
            break;

          default:
            this.logger.warn(
              `Unknown ptype "${policy.ptype}" found in database`,
            );
        }
      } catch (error) {
        this.logger.error(
          `Failed to load database policy ID ${policy.id}`,
          error instanceof Error
            ? error.message
            : String(error),
        );
      }
    }

    const pPolicies =
      await this.enforcer.getPolicy();

    const groupingPolicies =
      await this.enforcer.getGroupingPolicy();

    const g2Policies =
      await this.enforcer.getNamedGroupingPolicy(
        'g2',
      );

    this.logger.log(
      `Loaded ${pPolicies.length} p policies`,
    );

    this.logger.log(
      `Loaded ${groupingPolicies.length} g policies`,
    );

    this.logger.log(
      `Loaded ${g2Policies.length} g2 policies`,
    );
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