export interface RolePermissionUpdateItemDto {
  lob: string;
  page: string;
  module: string;
  section: string;
  access: 'edit' | 'view';
  assigned: boolean;
}

export interface UpdateRolePermissionsDto {
  permissions: RolePermissionUpdateItemDto[];
}
