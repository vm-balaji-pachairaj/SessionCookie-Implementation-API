export interface MenuConfig {
  key: string;
  label: string;
  route: string;
}

export const MENU_CONFIG: MenuConfig[] = [
  {
    key: 'dashboard',
    label: 'Dashboard',
    route: '/dashboard',
  },
  {
    key: 'user_management',
    label: 'User Management',
    route: '/user-management',
  },
  {
    key: 'sales',
    label: 'Sales',
    route: '/sales',
  },
  {
    key: 'reports',
    label: 'Reports',
    route: '/reports',
  },
  {
    key: 'settings',
    label: 'Settings',
    route: '/settings',
  },
  {
    key: 'audit',
    label: 'Audit',
    route: '/audit',
  },
];
