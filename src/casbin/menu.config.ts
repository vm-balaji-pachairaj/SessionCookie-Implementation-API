export interface MenuConfig {
  key: string;
  label: string;
  route: string;
}

export const MENU_CONFIG: MenuConfig[] = [
  {
    key: "dashboard",
    label: "Dashboard",
    route: "/dashboard",
  },
  {
    key: "search",
    label: "Search",
    route: "/search",
  },
  {
    key: "userManagement",
    label: "User Management",
    route: "/user-management",
  },
  {
    key: "reports",
    label: "Reports",
    route: "/reports",
  },
];