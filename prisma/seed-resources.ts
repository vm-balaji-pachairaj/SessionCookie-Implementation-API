import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv({ path: path.join(__dirname, '..', '.env') });

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

export async function seedResources(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    console.log('--- Starting Resource & Casbin Policy Seeding (MENU -> SECTION -> FIELD) ---');

    // 1. Ensure schemas and tables exist
    await client.query(`CREATE SCHEMA IF NOT EXISTS casbin;`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS users;`);

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

    // Clean out old casbin_rule, policy_bundle, policy_bundle_policy to ensure clean, coherent state
    await client.query(`DELETE FROM casbin.policy_bundle_policy;`);
    await client.query(`DELETE FROM casbin.policy_bundle;`);
    await client.query(`DELETE FROM casbin.casbin_rule;`);

    console.log('Cleaned existing Casbin tables for fresh coherent seed.');

    // 2. Insert P (Menu), P2 (Section), P3 (Field)
    for (const menu of HIERARCHY_DATA.menus) {
      // Level 1: MENU -> P policy (key, lob, page, meta)
      const meta = `displayName:${menu.name}|route:${menu.route}|icon:${menu.icon}|order:${menu.order}`;
      await client.query(
        `
        INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
        VALUES ('p', $1, 'hcp', $2, $3, null, null, null)
        ON CONFLICT DO NOTHING;
      `,
        [menu.key, menu.key, meta],
      );

      for (const section of menu.sections) {
        // Level 2: SECTION -> P2 policy (perm, lob, page, mod, sec, access)
        await client.query(
          `
          INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
          VALUES ('p2', $1, 'hcp', $2, $3, $4, $5, null)
          ON CONFLICT DO NOTHING;
        `,
          [section.policy, menu.key, section.key, section.key, section.access],
        );

        for (const field of section.fields) {
          // Level 3: FIELD -> P3 policy (perm, lob, page, mod, sec, field, access)
          await client.query(
            `
            INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
            VALUES ('p3', $1, 'hcp', $2, $3, $4, $5, $6)
            ON CONFLICT DO NOTHING;
          `,
            [
              field.policy,
              menu.key,
              section.key,
              section.key,
              field.key,
              field.access,
            ],
          );
        }
      }
    }

    console.log('Inserted all P (Menus), P2 (Sections), and P3 (Fields) policies.');

    // 3. Create Real Bundles
    const bundlesToCreate = [
      {
        name: 'Full Administrator Bundle',
        description: 'Complete system access across all Menus, Sections, and Fields.',
        menus: ['dashboard', 'user_management', 'sales', 'reports', 'settings', 'audit'],
        restrictedSections: [] as string[],
        restrictedFields: [] as string[],
      },
      {
        name: 'Sales Manager Bundle',
        description: 'Comprehensive access to Dashboard, Sales, and Reports.',
        menus: ['dashboard', 'sales', 'reports'],
        restrictedSections: [] as string[],
        restrictedFields: [] as string[],
      },
      {
        name: 'Sales Agent Bundle',
        description: 'Operational sales access (Orders and Customers without Amount or Action edit).',
        menus: ['dashboard', 'sales'],
        restrictedSections: ['summary'],
        restrictedFields: ['field_orders_amount', 'field_orders_actions', 'field_customers_actions'],
      },
      {
        name: 'User Access Support Bundle',
        description: 'Access to Dashboard and User Management (Users, Roles, Permissions).',
        menus: ['dashboard', 'user_management'],
        restrictedSections: [] as string[],
        restrictedFields: [] as string[],
      },
      {
        name: 'Auditor Bundle',
        description: 'Read-only access to Overview, Audit Reports, and Audit Logs.',
        menus: ['dashboard', 'reports', 'audit'],
        restrictedSections: ['sales_report', 'user_activity'],
        restrictedFields: [] as string[],
      },
    ];

    for (const bDef of bundlesToCreate) {
      const bRes = await client.query(
        `
        INSERT INTO casbin.policy_bundle (name, description, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        RETURNING id;
      `,
        [bDef.name, bDef.description],
      );
      const bundleId = bRes.rows[0].id;

      const policiesToAttach: { name: string; ptype: string }[] = [];

      for (const menuKey of bDef.menus) {
        const menu = HIERARCHY_DATA.menus.find((m) => m.key === menuKey);
        if (!menu) continue;

        // Add Menu policy (P)
        policiesToAttach.push({ name: menu.key, ptype: 'p' });

        for (const section of menu.sections) {
          if (bDef.restrictedSections.includes(section.key)) {
            continue;
          }
          // Add Section policy (P2)
          policiesToAttach.push({ name: section.policy, ptype: 'p2' });

          for (const field of section.fields) {
            if (bDef.restrictedFields.includes(field.policy)) {
              continue;
            }
            // Add Field policy (P3)
            policiesToAttach.push({ name: field.policy, ptype: 'p3' });
          }
        }
      }

      for (const item of policiesToAttach) {
        await client.query(
          `
          INSERT INTO casbin.policy_bundle_policy (bundle_id, policy_name, ptype, created_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT DO NOTHING;
        `,
          [bundleId, item.name, item.ptype],
        );

        // Add (g, bundle_name, policy_name)
        await client.query(
          `
          INSERT INTO casbin.casbin_rule (ptype, v0, v1)
          VALUES ('g', $1, $2)
          ON CONFLICT DO NOTHING;
        `,
          [bDef.name, item.name],
        );
      }

      console.log(`Created bundle "${bDef.name}" with ${policiesToAttach.length} policies.`);
    }

    // 4. Create Roles and Assign Bundles (g3)
    const roleAssignments = [
      { role: 'System Admin', bundle: 'Full Administrator Bundle', landing: 'dashboard' },
      { role: 'Sales Manager', bundle: 'Sales Manager Bundle', landing: 'sales' },
      { role: 'Sales Agent', bundle: 'Sales Agent Bundle', landing: 'sales' },
      { role: 'User Access Support Initiator', bundle: 'User Access Support Bundle', landing: 'user_management' },
      { role: 'Auditor', bundle: 'Auditor Bundle', landing: 'reports' },
    ];

    for (const ra of roleAssignments) {
      // Ensure role exists in users.role_master if table exists
      try {
        await client.query(
          `
          INSERT INTO users.role_master (role_name, is_active)
          VALUES ($1, true)
          ON CONFLICT (role_name) DO NOTHING;
        `,
          [ra.role],
        );
      } catch {
        // Ignore if role_master table structure differs
      }

      // Assign bundle to role (g3)
      await client.query(
        `
        INSERT INTO casbin.casbin_rule (ptype, v0, v1)
        VALUES ('g3', $1, $2)
        ON CONFLICT DO NOTHING;
      `,
        [ra.role, ra.bundle],
      );

      // Assign landing page (g2)
      await client.query(
        `
        INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2)
        VALUES ('g2', $1, 'hcp', $2)
        ON CONFLICT DO NOTHING;
      `,
        [ra.role, ra.landing],
      );

      console.log(`Linked role "${ra.role}" -> Bundle "${ra.bundle}" (g3) & Landing "${ra.landing}" (g2).`);
    }

    const counts = await client.query(`
      SELECT ptype, count(*) FROM casbin.casbin_rule GROUP BY ptype ORDER BY ptype;
    `);
    console.log('Casbin rule counts after seeding:');
    console.table(counts.rows);

    console.log('--- Resource & Casbin Policy Seeding Completed Successfully ---');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  seedResources().catch((err) => {
    console.error('Failed to seed resources:', err);
    process.exit(1);
  });
}
