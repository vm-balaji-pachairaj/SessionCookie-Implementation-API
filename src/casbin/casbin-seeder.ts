import * as path from 'path';
import * as fs from 'fs';
import { Client } from 'pg';
import { Logger } from '@nestjs/common';

export interface SeedOptions {
  force?: boolean;
  logger?: Logger;
}

export interface ResourceDefinition {
  menus: {
    key: string;
    name: string;
    route: string;
    icon: string;
    order: number;
    sections: {
      key: string;
      name: string;
      policy: string;
      access: string;
      fields: {
        key: string;
        name: string;
        policy: string;
        access: string;
      }[];
    }[];
  }[];
}
import { ResourceDefinition, HIERARCHY_DATA } from './casbin-resources';

export const HIERARCHY_DATA: ResourceDefinition = {
  menus: [
    {
      key: 'dashboard',
      name: 'Dashboard',
      route: '/dashboard',
      icon: 'dashboard',
      order: 1,
      sections: [
        {
          key: 'overview',
          name: 'Overview',
          policy: 'sec_dashboard_overview',
          access: 'read',
          fields: [
            { key: 'welcome_banner', name: 'Welcome Banner', policy: 'field_overview_welcome_banner', access: 'view' },
            { key: 'quick_stats', name: 'Quick Stats', policy: 'field_overview_quick_stats', access: 'view' },
            { key: 'recent_activity', name: 'Recent Activity', policy: 'field_overview_recent_activity', access: 'view' },
          ],
        },
      ],
    },
    {
      key: 'sales',
      name: 'Sales',
      route: '/sales',
      icon: 'chart-bar',
      order: 2,
      sections: [
        {
          key: 'summary',
          name: 'Sales Summary',
          policy: 'sec_sales_summary',
          access: 'read',
          fields: [
            { key: 'revenue', name: 'Revenue Metric', policy: 'field_sales_revenue', access: 'view' },
            { key: 'growth_rate', name: 'Growth Rate', policy: 'field_sales_growth', access: 'view' },
          ],
        },
        {
          key: 'orders',
          name: 'Orders',
          policy: 'sec_orders',
          access: 'read',
          fields: [
            { key: 'order_id', name: 'Order ID', policy: 'field_orders_order_id', access: 'read' },
            { key: 'customer', name: 'Customer', policy: 'field_orders_customer', access: 'read' },
            { key: 'amount', name: 'Amount', policy: 'field_orders_amount', access: 'read' },
            { key: 'status', name: 'Status', policy: 'field_orders_status', access: 'read' },
            { key: 'created_date', name: 'Created Date', policy: 'field_orders_created_date', access: 'read' },
            { key: 'actions', name: 'Actions', policy: 'field_orders_actions', access: 'edit' },
          ],
        },
        {
          key: 'customers',
          name: 'Customers',
          policy: 'sec_customers',
          access: 'read',
          fields: [
            { key: 'customer_name', name: 'Customer Name', policy: 'field_customers_name', access: 'read' },
            { key: 'email', name: 'Email', policy: 'field_customers_email', access: 'read' },
            { key: 'phone', name: 'Phone', policy: 'field_customers_phone', access: 'read' },
            { key: 'segment', name: 'Segment', policy: 'field_customers_segment', access: 'read' },
            { key: 'actions', name: 'Customer Actions', policy: 'field_customers_actions', access: 'edit' },
          ],
        },
      ],
    },
    {
      key: 'user_management',
      name: 'User Management',
      route: '/user-management',
      icon: 'users',
      order: 3,
      sections: [
        {
          key: 'users',
          name: 'User Directory',
          policy: 'sec_user_directory',
          access: 'read',
          fields: [
            { key: 'user_list', name: 'User List', policy: 'field_users_list', access: 'read' },
            { key: 'add_user', name: 'Add User', policy: 'field_users_add', access: 'edit' },
            { key: 'user_status', name: 'User Status', policy: 'field_users_status', access: 'read' },
          ],
        },
        {
          key: 'basic_details',
          name: 'User Basic Details',
          policy: 'userManagement-user-basicDetails',
          access: 'edit',
          fields: [
            { key: 'firstName', name: 'First Name', policy: 'userManagement-user-basicDetails-firstName', access: 'edit' },
            { key: 'lastName', name: 'Last Name', policy: 'userManagement-user-basicDetails-lastName', access: 'edit' },
            { key: 'employeeId', name: 'Employee ID', policy: 'userManagement-user-basicDetails-employeeId', access: 'edit' },
          ],
        },
        {
          key: 'contact_details',
          name: 'User Contact Details',
          policy: 'userManagement-user-contactDetails',
          access: 'edit',
          fields: [
            { key: 'email', name: 'Email', policy: 'userManagement-user-contactDetails-email', access: 'edit' },
            { key: 'phone', name: 'Phone', policy: 'userManagement-user-contactDetails-phone', access: 'edit' },
            { key: 'address', name: 'Address', policy: 'userManagement-user-contactDetails-address', access: 'edit' },
          ],
        },
        {
          key: 'role_access',
          name: 'User Role & Department',
          policy: 'userManagement-user-roleAccess',
          access: 'edit',
          fields: [
            { key: 'role', name: 'Role', policy: 'userManagement-user-roleAccess-role', access: 'edit' },
            { key: 'department', name: 'Department', policy: 'userManagement-user-roleAccess-department', access: 'edit' },
          ],
        },
        {
          key: 'user_list_columns',
          name: 'User List Columns',
          policy: 'userManagement-listUsers',
          access: 'view',
          fields: [
            { key: 'employeeId', name: 'Employee ID Column', policy: 'userManagement-userList-employeeId', access: 'view' },
            { key: 'firstName', name: 'First Name Column', policy: 'userManagement-userList-firstName', access: 'view' },
            { key: 'lastName', name: 'Last Name Column', policy: 'userManagement-userList-lastName', access: 'view' },
            { key: 'email', name: 'Email Column', policy: 'userManagement-userList-email', access: 'view' },
            { key: 'phone', name: 'Phone Column', policy: 'userManagement-userList-phone', access: 'view' },
            { key: 'role', name: 'Role Column', policy: 'userManagement-userList-role', access: 'view' },
            { key: 'department', name: 'Department Column', policy: 'userManagement-userList-department', access: 'view' },
          ],
        },
        {
          key: 'roles',
          name: 'Role Management',
          policy: 'sec_roles',
          access: 'read',
          fields: [
            { key: 'role_list', name: 'Role List', policy: 'field_roles_list', access: 'read' },
            { key: 'assign_bundles', name: 'Assign Policy Bundles', policy: 'field_roles_assign_bundles', access: 'edit' },
          ],
        },
        {
          key: 'permissions',
          name: 'Permissions Matrix',
          policy: 'sec_permissions',
          access: 'read',
          fields: [
            { key: 'matrix_view', name: 'Matrix View', policy: 'field_permissions_matrix_view', access: 'view' },
            { key: 'export_matrix', name: 'Export Matrix', policy: 'field_permissions_export', access: 'export' },
          ],
        },
      ],
    },
    {
      key: 'reports',
      name: 'Reports',
      route: '/reports',
      icon: 'file-text',
      order: 4,
      sections: [
        {
          key: 'sales_report',
          name: 'Sales Report',
          policy: 'sec_rep_sales',
          access: 'read',
          fields: [
            { key: 'monthly_trends', name: 'Monthly Trends', policy: 'field_reports_monthly_trends', access: 'view' },
            { key: 'export_pdf', name: 'Export PDF', policy: 'field_reports_export_pdf', access: 'export' },
          ],
        },
        {
          key: 'user_activity',
          name: 'User Activity Report',
          policy: 'sec_rep_user_activity',
          access: 'read',
          fields: [
            { key: 'login_history', name: 'Login History', policy: 'field_reports_login_history', access: 'view' },
            { key: 'failed_attempts', name: 'Failed Attempts', policy: 'field_reports_failed_attempts', access: 'view' },
          ],
        },
        {
          key: 'audit_trail',
          name: 'Audit Trail',
          policy: 'sec_rep_audit_trail',
          access: 'read',
          fields: [
            { key: 'system_events', name: 'System Events', policy: 'field_reports_system_events', access: 'read' },
            { key: 'critical_alerts', name: 'Critical Alerts', policy: 'field_reports_critical_alerts', access: 'read' },
          ],
        },
      ],
    },
    {
      key: 'settings',
      name: 'Settings',
      route: '/settings',
      icon: 'settings',
      order: 5,
      sections: [
        {
          key: 'general',
          name: 'General Settings',
          policy: 'sec_settings_general',
          access: 'read',
          fields: [
            { key: 'site_name', name: 'Site Name', policy: 'field_settings_site_name', access: 'edit' },
            { key: 'timezone', name: 'Timezone', policy: 'field_settings_timezone', access: 'edit' },
          ],
        },
        {
          key: 'notifications',
          name: 'Notification Settings',
          policy: 'sec_settings_notifications',
          access: 'read',
          fields: [
            { key: 'email_alerts', name: 'Email Alerts', policy: 'field_settings_email_alerts', access: 'read' },
          ],
        },
      ],
    },
    {
      key: 'audit',
      name: 'Audit',
      route: '/audit',
      icon: 'clipboard-check',
      order: 6,
      sections: [
        {
          key: 'audit_logs',
          name: 'Audit Logs',
          policy: 'sec_audit_logs',
          access: 'read',
          fields: [
            { key: 'log_id', name: 'Log ID', policy: 'field_audit_log_id', access: 'read' },
            { key: 'user', name: 'User', policy: 'field_audit_user', access: 'read' },
            { key: 'action', name: 'Action', policy: 'field_audit_action_desc', access: 'read' },
            { key: 'timestamp', name: 'Timestamp', policy: 'field_audit_time', access: 'read' },
          ],
        },
      ],
    },
  ],
};
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
    // 1. Ensure schema & tables exist
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
          UNIQUE (ptype, v0, v1, v2, v3, v4, v5, v6)
      );
    `);

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

    // 2. Check if tables are already populated
    const ruleCountRes = await client.query(`SELECT COUNT(*)::int as count FROM casbin.casbin_rule;`);
    const bundleCountRes = await client.query(`SELECT COUNT(*)::int as count FROM casbin.policy_bundle;`);
    // Maps to track policy definitions: policyName -> ptype ('p' | 'p2' | 'p3')
    const policyTypes = new Map<string, 'p' | 'p2' | 'p3'>();
    // Set of all policies to give to Full Administrator Bundle
    const allSystemPolicies = new Set<string>();

    const ruleCount = ruleCountRes.rows[0]?.count ?? 0;
    const bundleCount = bundleCountRes.rows[0]?.count ?? 0;

    const force = options?.force === true;

    if (!force && ruleCount > 0 && bundleCount > 0) {
      log(`Casbin tables already populated (${ruleCount} rules, ${bundleCount} bundles). Auto-seed skipped.`);
      return;
    }

    log(`Casbin tables empty or force re-seed requested. Seeding policies and bundles...`);

    if (force) {
      await client.query(`DELETE FROM casbin.policy_bundle_policy;`);
      await client.query(`DELETE FROM casbin.policy_bundle;`);
      await client.query(`DELETE FROM casbin.casbin_rule;`);
      log('Force re-seed requested: cleared existing Casbin tables.');
    }

    // Maps to track policy definitions: policyName -> ptype ('p' | 'p2' | 'p3')
    const policyTypes = new Map<string, 'p' | 'p2' | 'p3'>();
    // Set of all policies to give to Full Administrator Bundle
    const allSystemPolicies = new Set<string>();

    // 3. Seed Canonical Hierarchy (HIERARCHY_DATA)
    // 2. Always ensure Canonical Hierarchy (HIERARCHY_DATA) resources (P, P2, P3) are seeded
    for (const menu of HIERARCHY_DATA.menus) {
      const meta = `displayName:${menu.name}|route:${menu.route}|icon:${menu.icon}|order:${menu.order}`;
      // P: Menu (key, lob, page, meta)
      await client.query(
        `INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
         VALUES ('p', $1, 'hcp', $2, $3, null, null, null)
         ON CONFLICT DO NOTHING;`,
        [menu.key, menu.key, meta],
      );
      policyTypes.set(menu.key, 'p');
      allSystemPolicies.add(menu.key);

      for (const section of menu.sections) {
        // P2: Section (perm, lob, page, mod, sec, access)
        await client.query(
          `INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
           VALUES ('p2', $1, 'hcp', $2, $3, $4, $5, null)
           ON CONFLICT DO NOTHING;`,
          [section.policy, menu.key, section.key, section.key, section.access],
        );
        policyTypes.set(section.policy, 'p2');
        allSystemPolicies.add(section.policy);

        for (const field of section.fields) {
          // P3: Field (perm, lob, page, mod, sec, field, access)
          await client.query(
            `INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
             VALUES ('p3', $1, 'hcp', $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING;`,
            [field.policy, menu.key, section.key, section.key, field.key, field.access],
          );
          policyTypes.set(field.policy, 'p3');
          allSystemPolicies.add(field.policy);
        }
      }
    }

    // 3. Check if bundles and rules are already populated
    const ruleCountRes = await client.query(`SELECT COUNT(*)::int as count FROM casbin.casbin_rule;`);
    const bundleCountRes = await client.query(`SELECT COUNT(*)::int as count FROM casbin.policy_bundle;`);

    const ruleCount = ruleCountRes.rows[0]?.count ?? 0;
    const bundleCount = bundleCountRes.rows[0]?.count ?? 0;

    if (!force && ruleCount > 0 && bundleCount > 0) {
      log(`Casbin tables already populated (${ruleCount} rules, ${bundleCount} bundles). Canonical resources verified and synced.`);
      return;
    }

    log(`Casbin tables empty or force re-seed requested. Seeding policies, bundles, and role mappings...`);


    // 4. Parse and seed CSV policy files if available
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

            if (menuKey) {
              await client.query(
                `INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
                 VALUES ('p', $1, $2, $3, $4, null, null, null)
                 ON CONFLICT DO NOTHING;`,
                [menuKey, lob, parent, meta],
              );
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
              await client.query(
                `INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
                 VALUES ('p2', $1, $2, $3, $4, $5, $6, null)
                 ON CONFLICT DO NOTHING;`,
                [perm, lob, page, mod, sec, access],
              );
              policyTypes.set(perm, 'p2');
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
              await client.query(
                `INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
                 VALUES ('p2', $1, $2, $3, $4, $5, $6, null)
                 ON CONFLICT DO NOTHING;`,
                [perm, lob, page, mod, sec, access],
              );
              policyTypes.set(perm, 'p2');
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
              await client.query(
                `INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
                 VALUES ('p3', $1, $2, $3, $4, $5, $6, $7)
                 ON CONFLICT DO NOTHING;`,
                [perm, lob, page, mod, sec, field, access],
              );
              policyTypes.set(perm, 'p3');
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

    // 5. Seed Canonical Bundles
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
          'sales',
          'sec_orders', 'field_orders_order_id', 'field_orders_customer', 'field_orders_status', 'field_orders_created_date',
          'sec_customers', 'field_customers_name', 'field_customers_email', 'field_customers_phone', 'field_customers_segment',
        ],
      },
      {
        name: 'User Access Support Bundle',
        description: 'Access to Dashboard and User Management (Users, Roles, Permissions).',
        policies: [
          'dashboard', 'sec_dashboard_overview',
          'field_overview_welcome_banner', 'field_overview_quick_stats', 'field_overview_recent_activity',
          'user_management',
          'sec_user_directory', 'field_users_list', 'field_users_add', 'field_users_status',
          'userManagement-user-basicDetails', 'userManagement-user-basicDetails-firstName', 'userManagement-user-basicDetails-lastName', 'userManagement-user-basicDetails-employeeId',
          'userManagement-user-contactDetails', 'userManagement-user-contactDetails-email', 'userManagement-user-contactDetails-phone', 'userManagement-user-contactDetails-address',
          'userManagement-user-roleAccess', 'userManagement-user-roleAccess-role', 'userManagement-user-roleAccess-department',
          'userManagement-listUsers', 'userManagement-userList-employeeId', 'userManagement-userList-firstName', 'userManagement-userList-lastName', 'userManagement-userList-email', 'userManagement-userList-phone', 'userManagement-userList-role', 'userManagement-userList-department',
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
        await client.query(
          `INSERT INTO casbin.casbin_rule (ptype, v0, v1)
           VALUES ('g', $1, $2)
           ON CONFLICT DO NOTHING;`,
          [b.name, policyName],
        );
      }
    };

    // Insert canonical bundles
    for (const b of canonicalBundles) {
      await insertBundleWithPolicies(b);
    }

    // 6. Insert Role Bundles from CSV files
    for (const [role, targets] of rolePolicies.entries()) {
      const bundleName = `${role} Bundle`;
      const bundleDesc = `Access bundle for ${role}`;
      await insertBundleWithPolicies({
        name: bundleName,
        description: bundleDesc,
        policies: Array.from(targets),
      });

      // Link Role -> Bundle via g3: (g3, role, bundleName)
      await client.query(
        `INSERT INTO casbin.casbin_rule (ptype, v0, v1)
         VALUES ('g3', $1, $2)
         ON CONFLICT DO NOTHING;`,
        [role, bundleName],
      );
    }

    // 7. Assign Canonical Bundles to Key Roles (g3) and Landing Pages (g2)
    const roleMappings = [
      { role: 'System Admin', bundle: 'Full Administrator Bundle', landing: 'dashboard' },
      { role: 'Sales Manager', bundle: 'Sales Manager Bundle', landing: 'sales' },
      { role: 'Sales Agent', bundle: 'Sales Agent Bundle', landing: 'sales' },
      { role: 'User Access Support Initiator', bundle: 'User Access Support Bundle', landing: 'user_management' },
      { role: 'Auditor', bundle: 'Auditor Bundle', landing: 'reports' },
    ];

    for (const rm of roleMappings) {
      await client.query(
        `INSERT INTO casbin.casbin_rule (ptype, v0, v1)
         VALUES ('g3', $1, $2)
         ON CONFLICT DO NOTHING;`,
        [rm.role, rm.bundle],
      );

      await client.query(
        `INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2)
         VALUES ('g2', $1, 'hcp', $2)
         ON CONFLICT DO NOTHING;`,
        [rm.role, rm.landing],
      );
    }

    // Apply any CSV-defined landing pages
    for (const [role, info] of roleLandings.entries()) {
      await client.query(
        `INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2)
         VALUES ('g2', $1, $2, $3)
         ON CONFLICT DO NOTHING;`,
        [role, info.lob, info.landing],
      );
    }

    // 8. Ensure baseline roles exist in users.role_master if table exists
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

