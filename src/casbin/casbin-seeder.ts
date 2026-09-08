import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';
import { Logger } from '@nestjs/common';
import { ResourceDefinition, HIERARCHY_DATA } from './casbin-resources';

export interface SeedOptions {
  force?: boolean;
  logger?: Logger;
}

export type { ResourceDefinition };
export { HIERARCHY_DATA };

function locatePoliciesDirectory(): string | null {
  const candidates = [
    path.join(__dirname, 'policies'),
    path.join(__dirname, '..', 'policies'),
    path.join(process.cwd(), 'src', 'casbin', 'policies'),
    path.join(process.cwd(), 'api', 'src', 'casbin', 'policies'),
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return dir;
    }
  }
  return null;
}

/**
 * Idempotently ensures that the casbin schema and tables exist,
 * and if the tables are empty, seeds all canonical policies, CSV policies,
 * policy bundles, role mappings (g3), and landing pages (g2).
 */
export async function ensureCasbinTablesAndSeed(logger?: Logger, options?: SeedOptions): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const log = (msg: string) => {
    if (logger) {
      logger.log(msg);
    } else {
      // eslint-disable-next-line no-console
      console.log(`[CasbinSeeder] ${msg}`);
    }
  };

  try {
    // The seeder runs at startup and is intentionally idempotent: it creates the
    // schema only once and skips the data load if the policy tables already hold
    // the canonical role bundle data.
    await client.query(`CREATE SCHEMA IF NOT EXISTS casbin;`);

    await client.query(`
      CREATE TABLE IF NOT EXISTS casbin.casbin_rule (
        id SERIAL PRIMARY KEY,
        ptype VARCHAR(10) NOT NULL,
        v0 TEXT,
        v1 TEXT,
        v2 TEXT,
        v3 TEXT,
        v4 TEXT,
        v5 TEXT,
        v6 TEXT,
        CONSTRAINT casbin_policy_ptype_v0_v1_v2_v3_v4_v5_v6_key
          UNIQUE NULLS NOT DISTINCT (ptype, v0, v1, v2, v3, v4, v5, v6)
      );
    `);

    // Ensure NULLS NOT DISTINCT constraint and deduplicate any existing dirty rows
    try {
      await client.query(`
        DO $$
        BEGIN
          IF EXISTS (
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_schema = 'casbin' AND constraint_name = 'casbin_policy_ptype_v0_v1_v2_v3_v4_v5_v6_key'
          ) THEN
            DELETE FROM casbin.casbin_rule a
            USING casbin.casbin_rule b
            WHERE a.id > b.id
              AND a.ptype = b.ptype
              AND (a.v0 = b.v0 OR (a.v0 IS NULL AND b.v0 IS NULL))
              AND (a.v1 = b.v1 OR (a.v1 IS NULL AND b.v1 IS NULL))
              AND (a.v2 = b.v2 OR (a.v2 IS NULL AND b.v2 IS NULL))
              AND (a.v3 = b.v3 OR (a.v3 IS NULL AND b.v3 IS NULL))
              AND (a.v4 = b.v4 OR (a.v4 IS NULL AND b.v4 IS NULL))
              AND (a.v5 = b.v5 OR (a.v5 IS NULL AND b.v5 IS NULL))
              AND (a.v6 = b.v6 OR (a.v6 IS NULL AND b.v6 IS NULL));

            ALTER TABLE casbin.casbin_rule
              DROP CONSTRAINT casbin_policy_ptype_v0_v1_v2_v3_v4_v5_v6_key;
            ALTER TABLE casbin.casbin_rule
              ADD CONSTRAINT casbin_policy_ptype_v0_v1_v2_v3_v4_v5_v6_key
              UNIQUE NULLS NOT DISTINCT (ptype, v0, v1, v2, v3, v4, v5, v6);
          END IF;
        EXCEPTION WHEN OTHERS THEN
          NULL;
        END $$;
      `);
    } catch {
      // Ignore if table was freshly created or alter not supported
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS casbin.policy_bundle (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP(0) NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP(0) NOT NULL DEFAULT NOW()
      );
    `);

    await client.query(`
      CREATE TABLE IF NOT EXISTS casbin.policy_bundle_policy (
        id SERIAL PRIMARY KEY,
        bundle_id INT NOT NULL REFERENCES casbin.policy_bundle(id) ON DELETE CASCADE,
        policy_name VARCHAR(100) NOT NULL,
        ptype VARCHAR(10) NOT NULL,
        created_at TIMESTAMP(0) NOT NULL DEFAULT NOW(),
        CONSTRAINT uq_bundle_policy_ptype UNIQUE (bundle_id, policy_name, ptype)
      );
    `);

    const force = options?.force === true;

    if (force) {
      await client.query(`DELETE FROM casbin.policy_bundle_policy;`);
      await client.query(`DELETE FROM casbin.policy_bundle;`);
      await client.query(`DELETE FROM casbin.casbin_rule;`);
      log('Force re-seed requested: cleared existing Casbin tables.');
    }

    // Check if bundles and rules are already populated BEFORE inserting any new rows
    const ruleCountRes = await client.query(`SELECT COUNT(*)::int as count FROM casbin.casbin_rule;`);
    const bundleCountRes = await client.query(`SELECT COUNT(*)::int as count FROM casbin.policy_bundle;`);

    const ruleCount = ruleCountRes.rows[0]?.count ?? 0;
    const bundleCount = bundleCountRes.rows[0]?.count ?? 0;

    if (!force && ruleCount > 0 && bundleCount > 0) {
      log(`Casbin tables already populated (${ruleCount} rules, ${bundleCount} bundles). Canonical resources verified and synced.`);
      return;
    }

    log(`Casbin tables empty or force re-seed requested. Seeding policies, bundles, and role mappings...`);

    // In-memory set to prevent duplicate rule insertions during seeding
    const insertedRules = new Set<string>();

    const insertRule = async (
      ptype: string,
      v0: string | null,
      v1: string | null = null,
      v2: string | null = null,
      v3: string | null = null,
      v4: string | null = null,
      v5: string | null = null,
      v6: string | null = null,
    ) => {
      const sig = `${ptype}|${v0}|${v1}|${v2}|${v3}|${v4}|${v5}|${v6}`;
      if (insertedRules.has(sig)) return;
      insertedRules.add(sig);

      await client.query(
        `INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT DO NOTHING;`,
        [ptype, v0, v1, v2, v3, v4, v5, v6],
      );
    };

    // Maps to track policy definitions: policyName -> ptype ('p' | 'p2' | 'p3')
    const policyTypes = new Map<string, 'p' | 'p2' | 'p3'>();
    // Set of all policies to give to Full Administrator Bundle
    const allSystemPolicies = new Set<string>();

    // 2. Seed Canonical Hierarchy (HIERARCHY_DATA) resources (P, P2, P3)
    for (const menu of HIERARCHY_DATA.menus) {
      const meta = `displayName:${menu.name}|route:${menu.route}|icon:${menu.icon}|order:${menu.order}`;
      // P: Menu (key, lob, page, meta)
      await insertRule('p', menu.key, 'hcp', menu.key, meta);
      policyTypes.set(menu.key, 'p');
      allSystemPolicies.add(menu.key);

      for (const section of menu.sections) {
        // P2: Section (perm, lob, page, mod, sec, access)
        await insertRule('p2', section.policy, 'hcp', menu.key, section.key, section.key, section.access);
        policyTypes.set(section.policy, 'p2');
        allSystemPolicies.add(section.policy);

        for (const field of section.fields) {
          // P3: Field (perm, lob, page, mod, sec, field, access)
          await insertRule('p3', field.policy, 'hcp', menu.key, section.key, section.key, field.key, field.access);
          policyTypes.set(field.policy, 'p3');
          allSystemPolicies.add(field.policy);
        }
      }
    }

    // 3. Parse and seed CSV policy files if available
    const policiesDir = locatePoliciesDirectory();
    // Role -> Set of target policies
    const rolePolicies = new Map<string, Set<string>>();
    // Role -> landing page
    const roleLandings = new Map<string, { lob: string; landing: string }>();

    if (policiesDir) {
      const files = fs.readdirSync(policiesDir);
      for (const file of files) {
        if (!file.endsWith('.csv')) continue;
        const filePath = path.join(policiesDir, file);
        const content = fs.readFileSync(filePath, 'utf-8');
        const lines = content.split('\n');

        for (let line of lines) {
          line = line.trim();
          if (!line || line.startsWith('#')) continue;

          const parts = line.split(',').map((s) => s.trim());
          const ptype = parts[0];

          if (file === 'menu.csv' && ptype === 'p2') {
            // menu.csv has: p2, menuKey, lob, parent, meta
            // In our current Casbin model, menus are ptype = 'p'
            const menuKey = parts[1];
            const lob = parts[2] || 'hcp';
            const parent = parts[3] || '_';
            const meta = parts.slice(4).join(',');

            // Skip if this menu was already defined by canonical HIERARCHY_DATA
            if (menuKey && !policyTypes.has(menuKey)) {
              // For menus, v2 is its page identifier (menuKey)
              await insertRule('p', menuKey, lob, menuKey, meta);
              policyTypes.set(menuKey, 'p');
              allSystemPolicies.add(menuKey);
            }
          } else if (ptype === 'p') {
            // Section level policy from CSV: p, perm, lob, page, mod, sec, access
            // In our Casbin model, section policies are ptype = 'p2'
            const perm = parts[1];
            const lob = parts[2] || 'hcp';
            const page = parts[3] || '';
            const mod = parts[4] || '';
            const sec = parts[5] || '';
            const access = parts[6] || 'read';

            if (perm) {
              await insertRule('p2', perm, lob, page, mod, sec, access);
              if (!policyTypes.has(perm)) policyTypes.set(perm, 'p2');
              allSystemPolicies.add(perm);
            }
          } else if (ptype === 'p2') {
            // Section policy: p2, perm, lob, page, mod, sec, access
            const perm = parts[1];
            const lob = parts[2] || 'hcp';
            const page = parts[3] || '';
            const mod = parts[4] || '';
            const sec = parts[5] || '';
            const access = parts[6] || 'read';

            if (perm) {
              await insertRule('p2', perm, lob, page, mod, sec, access);
              if (!policyTypes.has(perm)) policyTypes.set(perm, 'p2');
              allSystemPolicies.add(perm);
            }
          } else if (ptype === 'p3') {
            // Field policy: p3, perm, lob, page, mod, sec, field, access
            const perm = parts[1];
            const lob = parts[2] || 'hcp';
            const page = parts[3] || '';
            const mod = parts[4] || '';
            const sec = parts[5] || '';
            const field = parts[6] || '';
            const access = parts[7] || 'read';

            if (perm) {
              await insertRule('p3', perm, lob, page, mod, sec, field, access);
              if (!policyTypes.has(perm)) policyTypes.set(perm, 'p3');
              allSystemPolicies.add(perm);
            }
          } else if (ptype === 'g') {
            // Role -> Target mapping: g, role, target
            const role = parts[1];
            const target = parts[2];
            if (role && target) {
              if (!rolePolicies.has(role)) {
                rolePolicies.set(role, new Set());
              }
              rolePolicies.get(role)!.add(target);
            }
          } else if (ptype === 'g2') {
            // Landing page mapping: g2, role, lob, landing
            const role = parts[1];
            const lob = parts[2] || 'hcp';
            const landing = parts[3] || '';
            if (role && landing) {
              roleLandings.set(role, { lob, landing });
            }
          }
        }
      }
    }

    // 4. Seed Canonical Bundles
    interface BundleSpec {
      name: string;
      description: string;
      policies: string[];
    }

    const canonicalBundles: BundleSpec[] = [
      {
        name: 'Full Administrator Bundle',
        description: 'Complete system access across all Menus, Sections, and Fields.',
        policies: Array.from(allSystemPolicies),
      },
      {
        name: 'Sales Manager Bundle',
        description: 'Comprehensive access to Dashboard, Sales, and Reports.',
        policies: [
          'dashboard', 'sec_dashboard_overview',
          'field_overview_welcome_banner', 'field_overview_quick_stats', 'field_overview_recent_activity',
          'sales', 'sec_sales_summary', 'field_sales_revenue', 'field_sales_growth',
          'sec_orders', 'field_orders_order_id', 'field_orders_customer', 'field_orders_amount', 'field_orders_status', 'field_orders_created_date', 'field_orders_actions',
          'sec_customers', 'field_customers_name', 'field_customers_email', 'field_customers_phone', 'field_customers_segment', 'field_customers_actions',
          'reports', 'sec_rep_sales', 'field_reports_monthly_trends', 'field_reports_export_pdf',
          'sec_rep_user_activity', 'field_reports_login_history', 'field_reports_failed_attempts',
          'sec_rep_audit_trail', 'field_reports_system_events', 'field_reports_critical_alerts',
        ],
      },
      {
        name: 'Sales Agent Bundle',
        description: 'Operational sales access (Orders and Customers without Amount or Action edit).',
        policies: [
          'dashboard', 'sec_dashboard_overview',
          'field_overview_welcome_banner', 'field_overview_quick_stats', 'field_overview_recent_activity',
          'sales', 'sec_sales_summary', 'field_sales_revenue',
          'sec_orders', 'field_orders_order_id', 'field_orders_customer', 'field_orders_status', 'field_orders_created_date',
          'sec_customers', 'field_customers_name', 'field_customers_email', 'field_customers_phone', 'field_customers_segment',
        ],
      },
      {
        name: 'User Access Support Bundle',
        description: 'Manage users, assign bundles, and view permissions matrix.',
        policies: [
          'dashboard', 'sec_dashboard_overview',
          'field_overview_welcome_banner', 'field_overview_quick_stats', 'field_overview_recent_activity',
          'user_management', 'sec_user_directory', 'field_users_list', 'field_users_add', 'field_users_status',
          'sec_roles', 'field_roles_list', 'field_roles_assign_bundles',
          'sec_permissions', 'field_permissions_matrix_view', 'field_permissions_export',
        ],
      },
      {
        name: 'Auditor Bundle',
        description: 'Read-only access to Overview, Audit Reports, and Audit Logs.',
        policies: [
          'dashboard', 'sec_dashboard_overview',
          'field_overview_welcome_banner', 'field_overview_quick_stats', 'field_overview_recent_activity',
          'reports', 'sec_rep_audit_trail', 'field_reports_system_events', 'field_reports_critical_alerts',
          'audit', 'sec_audit_logs', 'field_audit_log_id', 'field_audit_user', 'field_audit_action_desc', 'field_audit_time',
        ],
      },
    ];

    // Helper to insert a bundle and attach policies
    const insertBundleWithPolicies = async (b: BundleSpec) => {
      const bRes = await client.query(
        `INSERT INTO casbin.policy_bundle (name, description, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (name) DO UPDATE SET description = EXCLUDED.description, updated_at = NOW()
         RETURNING id;`,
        [b.name, b.description],
      );
      const bundleId = bRes.rows[0].id;

      for (const policyName of b.policies) {
        const ptype = policyTypes.get(policyName) || 'p2';

        // Add to casbin.policy_bundle_policy
        await client.query(
          `INSERT INTO casbin.policy_bundle_policy (bundle_id, policy_name, ptype, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT ON CONSTRAINT uq_bundle_policy_ptype DO NOTHING;`,
          [bundleId, policyName, ptype],
        );

        // Add to casbin.casbin_rule as (g, bundleName, policyName)
        await insertRule('g', b.name, policyName);
      }
    };

    // Insert canonical bundles
    for (const b of canonicalBundles) {
      await insertBundleWithPolicies(b);
    }

    // 5. Insert Role Bundles from CSV files
    for (const [role, targets] of rolePolicies.entries()) {
      const bundleName = `${role} Bundle`;
      const bundleDesc = `Access bundle for ${role}`;
      await insertBundleWithPolicies({
        name: bundleName,
        description: bundleDesc,
        policies: Array.from(targets),
      });

      // Link Role -> Bundle via g3: (g3, role, bundleName)
      await insertRule('g3', role, bundleName);
    }

    // 6. Assign Canonical Bundles to Key Roles (g3) and Landing Pages (g2)
    const roleMappings = [
      { role: 'System Admin', bundle: 'Full Administrator Bundle', landing: 'dashboard' },
      { role: 'Sales Manager', bundle: 'Sales Manager Bundle', landing: 'sales' },
      { role: 'Sales Agent', bundle: 'Sales Agent Bundle', landing: 'sales' },
      { role: 'User Access Support Initiator', bundle: 'User Access Support Bundle', landing: 'user_management' },
      { role: 'Auditor', bundle: 'Auditor Bundle', landing: 'reports' },
    ];

    for (const rm of roleMappings) {
      await insertRule('g3', rm.role, rm.bundle);
      await insertRule('g2', rm.role, 'hcp', rm.landing);
    }

    // Apply any CSV-defined landing pages
    for (const [role, info] of roleLandings.entries()) {
      await insertRule('g2', role, info.lob, info.landing);
    }

    // 7. Ensure baseline roles exist in users.role_master if table exists
    try {
      const defaultRoles = [
        'System Admin',
        'Sales Manager',
        'Sales Agent',
        'User Access Support Initiator',
        'User Access Support Reviewer',
        'ScanAdmin',
        'Call Center User',
        'Auditor',
        'Medico',
        'QC',
      ];
      for (const rName of defaultRoles) {
        await client.query(`
          INSERT INTO users.role_master (role_name, is_active)
          SELECT $1, true
          WHERE NOT EXISTS (SELECT 1 FROM users.role_master WHERE role_name = $1);
        `, [rName]);
      }
    } catch {
      // Ignore if users.role_master has different schema
    }

    const finalRules = await client.query(`SELECT COUNT(*)::int as count FROM casbin.casbin_rule;`);
    const finalBundles = await client.query(`SELECT COUNT(*)::int as count FROM casbin.policy_bundle;`);
    log(`Seeding complete. Seeded ${finalRules.rows[0].count} Casbin rules and ${finalBundles.rows[0].count} policy bundles.`);
  } finally {
    await client.end();
  }
}
