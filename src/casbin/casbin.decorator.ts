import { SetMetadata } from '@nestjs/common';

export const CHECK_POLICY_KEY = 'check_policy';

export interface PolicyRequirementOptions {
  lob?: string;
  page?: string;
  mod?: string;
  module?: string;
  sec?: string;
  section?: string;
  menu?: string;
  field?: string;
  access?: string;
  policy?: string;
  type?: 'menu' | 'section' | 'field';
}

export interface PolicyRequirement {
  lob?: string;
  page?: string;
  mod?: string;
  sec?: string;
  section?: string;
  access?: string;
  menu?: string;
  field?: string;
  policy?: string;
  type?: 'menu' | 'section' | 'field' | 'custom';
}

/**
 * Universal Casbin policy authorization decorator.
 *
 * Resource Hierarchy:
 * MENU (P) -> PAGE (Container) -> SECTION (P2) -> FIELD (P3)
 *
 * Supports:
 * - Menu-level (P):
 *     @usePolicyNeeded('sales')
 *     @usePolicyNeeded({ menu: 'sales' })
 * - Section-level (P2):
 *     @usePolicyNeeded('sales', 'orders', 'read')
 *     @usePolicyNeeded({ menu: 'sales', section: 'orders', access: 'read' })
 *     @usePolicyNeeded({ page: 'sales', sec: 'orders', access: 'read' })
 *     @usePolicyNeeded('hcp', 'sales', 'orders', 'orders', 'read')
 * - Field-level (P3):
 *     @usePolicyNeeded('sales', 'orders', 'amount', 'read')
 *     @usePolicyNeeded({ menu: 'sales', section: 'orders', field: 'amount', access: 'read' })
 *     @usePolicyNeeded('hcp', 'sales', 'orders', 'orders', 'amount', 'read')
 */
export function usePolicyNeeded(
  arg1: string | PolicyRequirementOptions,
  arg2?: string,
  arg3?: string,
  arg4?: string,
  arg5?: string,
  arg6?: string,
) {
  if (typeof arg1 === 'object') {
    const opts = arg1;
    const lob = opts.lob || 'hcp';
    const menu = opts.menu || '';
    const section = opts.section || opts.sec || '';
    const page = opts.page || menu || section || 'main';
    const mod = opts.mod || opts.module || section || 'main';
    const sec = opts.sec || opts.section || section || 'main';
    const access = opts.access || 'read';

    const req: PolicyRequirement = {
      type: opts.type || (opts.field ? 'field' : (section ? 'section' : (menu ? 'menu' : undefined))),
      lob,
      page,
      mod,
      sec,
      section,
      access,
      menu: opts.menu,
      field: opts.field,
      policy: opts.policy,
    };
    return SetMetadata(CHECK_POLICY_KEY, req);
  }

  // 6 string args: (lob, page, mod, sec, field, access) -> Field (P3)
  if (arg6 !== undefined) {
    const req: PolicyRequirement = {
      type: 'field',
      lob: arg1,
      page: arg2 || '',
      mod: arg3 || '',
      sec: arg4 || '',
      section: arg4 || '',
      field: arg5,
      access: arg6,
    };
    return SetMetadata(CHECK_POLICY_KEY, req);
  }

  // 5 string args: (lob, page, mod, sec, access) -> Section (P2)
  if (arg5 !== undefined) {
    const req: PolicyRequirement = {
      type: 'section',
      lob: arg1,
      page: arg2 || '',
      mod: arg3 || '',
      sec: arg4 || '',
      section: arg4 || '',
      access: arg5,
    };
    return SetMetadata(CHECK_POLICY_KEY, req);
  }

  // 4 string args: (menuOrPage, section, field, access) -> Field (P3)
  if (arg4 !== undefined) {
    const menuOrPage = arg1;
    const section = arg2 || '';
    const field = arg3 || '';
    const access = arg4;
    const req: PolicyRequirement = {
      type: 'field',
      lob: 'hcp',
      page: menuOrPage,
      menu: menuOrPage,
      mod: section,
      sec: section,
      section,
      field,
      access,
    };
    return SetMetadata(CHECK_POLICY_KEY, req);
  }

  // 3 string args: (menuOrPage, section, access) -> Section (P2)
  if (arg3 !== undefined) {
    const menuOrPage = arg1;
    const section = arg2 || '';
    const access = arg3;
    const req: PolicyRequirement = {
      type: 'section',
      lob: 'hcp',
      page: menuOrPage,
      menu: menuOrPage,
      mod: section,
      sec: section,
      section,
      access,
    };
    return SetMetadata(CHECK_POLICY_KEY, req);
  }

  // 2 string args: (target, access) -> Section (P2)
  if (arg2 !== undefined) {
    const target = arg1;
    const access = arg2;
    const req: PolicyRequirement = {
      type: 'section',
      lob: 'hcp',
      page: target,
      menu: target,
      mod: target,
      sec: target,
      section: target,
      access,
    };
    return SetMetadata(CHECK_POLICY_KEY, req);
  }

  // 1 string arg: Menu (P) or named policy
  const req: PolicyRequirement = {
    type: 'menu',
    lob: 'hcp',
    page: arg1,
    menu: arg1,
    mod: 'main',
    sec: 'main',
    access: 'read',
    policy: arg1,
  };
  return SetMetadata(CHECK_POLICY_KEY, req);
}

/**
 * Backward compatibility alias for existing code.
 */
export const CheckPolicy = usePolicyNeeded;
