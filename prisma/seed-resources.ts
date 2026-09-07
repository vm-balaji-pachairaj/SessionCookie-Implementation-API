import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv({ path: path.join(__dirname, '..', '.env') });

export interface ResourceDefinition {
  sections: {
    key: string;
    name: string;
    policy: string;
    access: string;
    menus: {
      key: string;
      name: string;
      policy: string;
      route: string;
      icon: string;
      order: number;
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
  sections: [
    {
      key: 'dashboard',
      name: 'Dashboard',
      policy: 'sec_dashboard',
      access: 'read',
      menus: [
        {
          key: 'overview',
          name: 'Overview',
          policy: 'overview',
          route: '/dashboard',
          icon: 'dashboard',
          order: 1,
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
      policy: 'sec_sales',
      access: 'read',
      menus: [
        {
          key: 'sales_dashboard',
          name: 'Sales Dashboard',
          policy: 'sales_dashboard',
          route: '/sales/dashboard',
          icon: 'chart-bar',
          order: 1,
          fields: [
            { key: 'sales_summary', name: 'Sales Summary', policy: 'field_sales_summary', access: 'view' },
            { key: 'revenue', name: 'Revenue', policy: 'field_revenue', access: 'view' },
            { key: 'customer_count', name: 'Customer Count', policy: 'field_customer_count', access: 'view' },
          ],
        },
        {
          key: 'orders',
          name: 'Orders',
          policy: 'orders',
          route: '/sales/orders',
          icon: 'shopping-cart',
          order: 2,
          fields: [
            { key: 'order_id', name: 'Order ID', policy: 'field_orders_order_id', access: 'read' },
            { key: 'customer', name: 'Customer', policy: 'field_orders_customer', access: 'read' },
            { key: 'amount', name: 'Amount', policy: 'field_orders_amount', access: 'read' },
            { key: 'status', name: 'Status', policy: 'field_orders_status', access: 'read' },
            { key: 'created_date', name: 'Created Date', policy: 'field_orders_created_date', access: 'read' },
            { key: 'actions', name: 'Actions', policy: 'field_orders_actions', access: 'edit' },
          ],
        },
      ],
    },
    {
      key: 'customers',
      name: 'Customers',
      policy: 'sec_customers',
      access: 'read',
      menus: [
        {
          key: 'customer_list',
          name: 'Customer Directory',
          policy: 'customer_list',
          route: '/customers',
          icon: 'users',
          order: 1,
          fields: [
            { key: 'customer_name', name: 'Customer Name', policy: 'field_customers_name', access: 'read' },
            { key: 'email', name: 'Email', policy: 'field_customers_email', access: 'read' },
            { key: 'phone', name: 'Phone', policy: 'field_customers_phone', access: 'read' },
            { key: 'status', name: 'Status', policy: 'field_customers_status', access: 'read' },
            { key: 'actions', name: 'Actions', policy: 'field_customers_actions', access: 'edit' },
          ],
        },
        {
          key: 'customer_feedback',
          name: 'Feedback',
          policy: 'customer_feedback',
          route: '/customers/feedback',
          icon: 'chat',
          order: 2,
          fields: [
            { key: 'feedback_text', name: 'Feedback Comments', policy: 'field_feedback_comments', access: 'read' },
            { key: 'rating', name: 'Rating Score', policy: 'field_feedback_rating', access: 'read' },
          ],
        },
      ],
    },
    {
      key: 'user_management',
      name: 'User Management',
      policy: 'sec_user_management',
      access: 'read',
      menus: [
        {
          key: 'users',
          name: 'Users',
          policy: 'users',
          route: '/user-management',
          icon: 'user',
          order: 1,
          fields: [
            { key: 'user_name', name: 'Name', policy: 'field_users_name', access: 'read' },
            { key: 'user_email', name: 'Email', policy: 'field_users_email', access: 'read' },
            { key: 'user_role', name: 'Role', policy: 'field_users_role', access: 'read' },
            { key: 'user_status', name: 'Status', policy: 'field_users_status', access: 'read' },
            { key: 'user_created_date', name: 'Created Date', policy: 'field_users_created_date', access: 'read' },
            { key: 'user_actions', name: 'Actions', policy: 'field_users_actions', access: 'edit' },
          ],
        },
        {
          key: 'roles',
          name: 'Roles',
          policy: 'roles',
          route: '/admin',
          icon: 'shield',
          order: 2,
          fields: [
            { key: 'role_name', name: 'Role Name', policy: 'field_roles_role_name', access: 'read' },
            { key: 'bundle_count', name: 'Bundle Count', policy: 'field_roles_bundle_count', access: 'read' },
          ],
        },
        {
          key: 'permissions',
          name: 'Permissions',
          policy: 'permissions',
          route: '/admin',
          icon: 'key',
          order: 3,
          fields: [
            { key: 'permission_rule', name: 'Rule Identifier', policy: 'field_permissions_rule', access: 'read' },
            { key: 'permission_type', name: 'Policy Type', policy: 'field_permissions_type', access: 'read' },
          ],
        },
      ],
    },
    {
      key: 'reports',
      name: 'Reports',
      policy: 'sec_reports',
      access: 'read',
      menus: [
        {
          key: 'sales_report',
          name: 'Sales Report',
          policy: 'sales_report',
          route: '/reports/sales',
          icon: 'document-report',
          order: 1,
          fields: [
            { key: 'report_metric', name: 'Key Metrics', policy: 'field_report_metric', access: 'view' },
            { key: 'report_chart', name: 'Chart Visual', policy: 'field_report_chart', access: 'view' },
            { key: 'report_export', name: 'Export Data', policy: 'field_report_export', access: 'export' },
          ],
        },
        {
          key: 'user_activity',
          name: 'User Activity',
          policy: 'user_activity',
          route: '/reports/activity',
          icon: 'clock',
          order: 2,
          fields: [
            { key: 'activity_log', name: 'Activity Log', policy: 'field_activity_log', access: 'view' },
            { key: 'session_duration', name: 'Session Duration', policy: 'field_session_duration', access: 'view' },
          ],
        },
        {
          key: 'audit_report',
          name: 'Audit Report',
          policy: 'audit_report',
          route: '/reports/audit',
          icon: 'clipboard-check',
          order: 3,
          fields: [
            { key: 'audit_timestamp', name: 'Timestamp', policy: 'field_audit_timestamp', access: 'view' },
            { key: 'audit_action', name: 'Action', policy: 'field_audit_action', access: 'view' },
          ],
        },
      ],
    },
    {
      key: 'settings',
      name: 'Settings',
      policy: 'sec_settings',
      access: 'read',
      menus: [
        {
          key: 'general_settings',
          name: 'General Settings',
          policy: 'general_settings',
          route: '/settings/general',
          icon: 'cog',
          order: 1,
          fields: [
            { key: 'site_name', name: 'Site Name', policy: 'field_settings_site_name', access: 'read' },
            { key: 'timezone', name: 'Timezone', policy: 'field_settings_timezone', access: 'read' },
          ],
        },
        {
          key: 'access_control',
          name: 'Access Control',
          policy: 'access_control',
          route: '/admin',
          icon: 'lock-closed',
          order: 2,
          fields: [
            { key: 'session_timeout', name: 'Session Timeout', policy: 'field_settings_session_timeout', access: 'read' },
            { key: 'mfa_enforced', name: 'MFA Enforced', policy: 'field_settings_mfa_enforced', access: 'read' },
          ],
        },
        {
          key: 'notifications',
          name: 'Notifications',
          policy: 'notifications',
          route: '/settings/notifications',
          icon: 'bell',
          order: 3,
          fields: [
            { key: 'email_alerts', name: 'Email Alerts', policy: 'field_settings_email_alerts', access: 'read' },
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
    console.log('--- Starting Resource & Casbin Policy Seeding ---');

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

    // 2. Insert P (Sections), P2 (Menus), P3 (Fields)
    for (const section of HIERARCHY_DATA.sections) {
      // P policy: perm, lob, page, mod, sec, access
      await client.query(`
        INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
        VALUES ('p', $1, 'hcp', $2, 'main', $2, $3, null)
        ON CONFLICT DO NOTHING;
      `, [section.policy, section.key, section.access]);

      for (const menu of section.menus) {
        // P2 policy: key, lob, parent, meta
        const meta = `displayName:${menu.name}|route:${menu.route}|icon:${menu.icon}|order:${menu.order}`;
        await client.query(`
          INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
          VALUES ('p2', $1, 'hcp', $2, $3, null, null, null)
          ON CONFLICT DO NOTHING;
        `, [menu.policy, section.key, meta]);

        for (const field of menu.fields) {
          // P3 policy: perm, lob, page, mod, sec, field, access
          await client.query(`
            INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2, v3, v4, v5, v6)
            VALUES ('p3', $1, 'hcp', $2, $3, $3, $4, $5)
            ON CONFLICT DO NOTHING;
          `, [field.policy, section.key, menu.key, field.key, field.access]);
        }
      }
    }

    console.log('Inserted all P (Sections), P2 (Menus), and P3 (Fields) policies.');

    // 3. Create Real Bundles
    const bundlesToCreate = [
      {
        name: 'Full Administrator Bundle',
        description: 'Complete system access across all Sections, Menus, and Fields.',
        sections: ['dashboard', 'sales', 'customers', 'user_management', 'reports', 'settings'],
        restrictedFields: [] as string[],
      },
      {
        name: 'Sales Manager Bundle',
        description: 'Comprehensive access to Dashboard, Sales, Customers, and Reports.',
        sections: ['dashboard', 'sales', 'customers', 'reports'],
        restrictedFields: [] as string[],
      },
      {
        name: 'Sales Agent Bundle',
        description: 'Operational sales access (Orders and Customer directory without Amount access).',
        sections: ['dashboard', 'sales'],
        // Restrict Amount and Actions in Orders
        restrictedFields: ['field_orders_amount', 'field_orders_actions'],
      },
      {
        name: 'User Access Support Bundle',
        description: 'Access to User Management directory and Roles.',
        sections: ['dashboard', 'user_management'],
        restrictedFields: [] as string[],
      },
      {
        name: 'Auditor Bundle',
        description: 'Read-only access to Overview and Audit Reports.',
        sections: ['dashboard', 'reports'],
        restrictedMenus: ['sales_report', 'user_activity'],
        restrictedFields: [] as string[],
      },
    ];

    for (const bDef of bundlesToCreate) {
      const bRes = await client.query(`
        INSERT INTO casbin.policy_bundle (name, description, created_at, updated_at)
        VALUES ($1, $2, NOW(), NOW())
        RETURNING id;
      `, [bDef.name, bDef.description]);
      const bundleId = bRes.rows[0].id;

      const policiesToAttach: { name: string; ptype: string }[] = [];

      for (const sectionKey of bDef.sections) {
        const sec = HIERARCHY_DATA.sections.find((s) => s.key === sectionKey);
        if (!sec) continue;

        // Add section policy (P)
        policiesToAttach.push({ name: sec.policy, ptype: 'p' });

        for (const menu of sec.menus) {
          if ('restrictedMenus' in bDef && (bDef as any).restrictedMenus?.includes(menu.key)) {
            continue;
          }
          // Add menu policy (P2)
          policiesToAttach.push({ name: menu.policy, ptype: 'p2' });

          for (const field of menu.fields) {
            if (bDef.restrictedFields.includes(field.policy)) {
              continue;
            }
            // Add field policy (P3)
            policiesToAttach.push({ name: field.policy, ptype: 'p3' });
          }
        }
      }

      for (const item of policiesToAttach) {
        await client.query(`
          INSERT INTO casbin.policy_bundle_policy (bundle_id, policy_name, ptype, created_at)
          VALUES ($1, $2, $3, NOW())
          ON CONFLICT DO NOTHING;
        `, [bundleId, item.name, item.ptype]);

        // Add (g, bundle_name, policy_name)
        await client.query(`
          INSERT INTO casbin.casbin_rule (ptype, v0, v1)
          VALUES ('g', $1, $2)
          ON CONFLICT DO NOTHING;
        `, [bDef.name, item.name]);
      }

      console.log(`Created bundle "${bDef.name}" with ${policiesToAttach.length} policies.`);
    }

    // 4. Create Roles and Assign Bundles (g3)
    const roleAssignments = [
      { role: 'System Admin', bundle: 'Full Administrator Bundle', landing: 'overview' },
      { role: 'Sales Manager', bundle: 'Sales Manager Bundle', landing: 'sales_dashboard' },
      { role: 'Sales Agent', bundle: 'Sales Agent Bundle', landing: 'orders' },
      { role: 'User Access Support Initiator', bundle: 'User Access Support Bundle', landing: 'users' },
      { role: 'Auditor', bundle: 'Auditor Bundle', landing: 'overview' },
    ];

    for (const ra of roleAssignments) {
      // Ensure role exists in users.role_master if table exists
      try {
        await client.query(`
          INSERT INTO users.role_master (role_name, is_active)
          VALUES ($1, true)
          ON CONFLICT (role_name) DO NOTHING;
        `, [ra.role]);
      } catch {
        // Ignore if role_master table structure differs
      }

      // Assign bundle to role (g3)
      await client.query(`
        INSERT INTO casbin.casbin_rule (ptype, v0, v1)
        VALUES ('g3', $1, $2)
        ON CONFLICT DO NOTHING;
      `, [ra.role, ra.bundle]);

      // Assign landing page (g2)
      await client.query(`
        INSERT INTO casbin.casbin_rule (ptype, v0, v1, v2)
        VALUES ('g2', $1, 'hcp', $2)
        ON CONFLICT DO NOTHING;
      `, [ra.role, ra.landing]);

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

