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
}

export interface PolicyRequirement {
  lob: string;
  page: string;
  mod: string;
  sec: string;
  access: string;
  menu?: string;
  field?: string;
  policy?: string;
}

/**
 * Universal Casbin policy authorization decorator.
 *
 * Supports:
 * - Full 5-tuple: @usePolicyNeeded('hcp', 'userManagement', 'user', 'list', 'view')
 * - Section-level: @usePolicyNeeded('sales', 'read')
 * - Menu-level: @usePolicyNeeded({ menu: 'orders' })
 * - Field-level: @usePolicyNeeded({ section: 'sales', menu: 'orders', field: 'amount', access: 'read' })
 * - Object config: @usePolicyNeeded({ section: 'sales', access: 'read' })
 */
export function usePolicyNeeded(
  arg1: string | PolicyRequirementOptions,
  arg2?: string,
  arg3?: string,
  arg4?: string,
  arg5?: string,
) {
  if (typeof arg1 === 'object') {
    const opts = arg1;
    const lob = opts.lob || 'hcp';
    const section = opts.section || opts.sec || '';
    const menu = opts.menu || '';
    const page = opts.page || section || 'main';
    const mod = opts.mod || opts.module || menu || 'main';
    const sec = opts.sec || opts.section || menu || 'main';
    const access = opts.access || 'read';

    const req: PolicyRequirement = {
      lob,
      page,
      mod,
      sec,
      access,
      menu: opts.menu,
      field: opts.field,
      policy: opts.policy,
    };
    return SetMetadata(CHECK_POLICY_KEY, req);
  }

  // 5 string args: (lob, page, mod, sec, access)
  if (arg5 !== undefined) {
    const req: PolicyRequirement = {
      lob: arg1,
      page: arg2 || '',
      mod: arg3 || '',
      sec: arg4 || '',
      access: arg5,
    };
    return SetMetadata(CHECK_POLICY_KEY, req);
  }

  // 2 string args: (section, access)
  if (arg2 !== undefined && arg3 === undefined) {
    const section = arg1;
    const access = arg2;
    const req: PolicyRequirement = {
      lob: 'hcp',
      page: section,
      mod: 'main',
      sec: section,
      access,
    };
    return SetMetadata(CHECK_POLICY_KEY, req);
  }

  // 3 string args: (section, menu, access)
  if (arg3 !== undefined && arg4 === undefined) {
    const section = arg1;
    const menu = arg2 || '';
    const access = arg3;
    const req: PolicyRequirement = {
      lob: 'hcp',
      page: section,
      mod: menu,
      sec: menu,
      menu,
      access,
    };
    return SetMetadata(CHECK_POLICY_KEY, req);
  }

  // 4 string args: (section, menu, field, access)
  if (arg4 !== undefined) {
    const section = arg1;
    const menu = arg2 || '';
    const field = arg3 || '';
    const access = arg4;
    const req: PolicyRequirement = {
      lob: 'hcp',
      page: section,
      mod: menu,
      sec: menu,
      menu,
      field,
      access,
    };
    return SetMetadata(CHECK_POLICY_KEY, req);
  }

  // Fallback 1 string arg: (policyName or menuKey)
  const req: PolicyRequirement = {
    lob: 'hcp',
    page: arg1,
    mod: 'main',
    sec: arg1,
    access: 'read',
    policy: arg1,
  };
  return SetMetadata(CHECK_POLICY_KEY, req);
}

/**
 * Backward compatibility alias for existing code.
 */
export const CheckPolicy = usePolicyNeeded;

