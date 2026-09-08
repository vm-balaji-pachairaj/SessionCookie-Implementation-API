export interface ResourceField {
  key: string;
  name: string;
  policy: string;
  access: string;
}

export interface ResourceSection {
  key: string;
  name: string;
  policy: string;
  access: string;
  fields: ResourceField[];
}

export interface ResourceMenu {
  key: string;
  name: string;
  route: string;
  icon: string;
  order: number;
  sections: ResourceSection[];
}

export interface ResourceDefinition {
  menus: ResourceMenu[];
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

