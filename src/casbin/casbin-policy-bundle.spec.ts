import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { PrismaModule } from '../PrismaService/prismaservice.module';
import { CasbinService } from './casbin.service';
import { CasbinGuard } from './casbin.guard';
import { AdminService } from '../admin/admin.service';

jest.setTimeout(30000);

describe('Casbin RBAC Policy Bundle Architecture', () => {
  let app: INestApplication;
  let casbinService: CasbinService;
  let adminService: AdminService;

  const TEST_ROLE = 'Test Automated Role';
  const TEST_ROLE_2 = 'Test Secondary Role';
  const TEST_BUNDLE_1 = 'Test Claims Bundle';
  const TEST_BUNDLE_2 = 'Test Analytics Bundle';

  const TEST_POLICY_P = 'test_analytics_menu';
  const TEST_POLICY_P2 = 'test-claim-process';
  const TEST_POLICY_P3 = 'test-claim-amount';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        PrismaModule,
      ],
      providers: [CasbinService, AdminService],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    casbinService = app.get(CasbinService);
    adminService = app.get(AdminService);

    // Setup dummy policy definitions for testing P (Menu), P2 (Section), P3 (Field)
    const enforcer = casbinService.getEnforcer();
    // p (Menu): key, lob, page, meta
    await enforcer.addPolicy(TEST_POLICY_P, 'hcp', 'test', 'displayName:Test Analytics|route:/test|icon:/test.svg|order:99');
    // p2 (Section): perm, lob, page, mod, sec, access
    await enforcer.addNamedPolicy('p2', TEST_POLICY_P2, 'hcp', 'claim', 'process', 'main', 'edit');
    // p3 (Field): perm, lob, page, mod, sec, field, access
    await enforcer.addNamedPolicy('p3', TEST_POLICY_P3, 'hcp', 'claim', 'amount', 'details', 'amount', 'edit');

    // Clean up any test artifacts from previous runs
    await enforcer.removeNamedGroupingPolicy('g3', TEST_ROLE, TEST_BUNDLE_1);
    await enforcer.removeNamedGroupingPolicy('g3', TEST_ROLE, TEST_BUNDLE_2);
    await enforcer.removeNamedGroupingPolicy('g3', TEST_ROLE_2, TEST_BUNDLE_1);
    await enforcer.removeGroupingPolicy(TEST_BUNDLE_1, TEST_POLICY_P);
    await enforcer.removeGroupingPolicy(TEST_BUNDLE_1, TEST_POLICY_P2);
    await enforcer.removeGroupingPolicy(TEST_BUNDLE_1, TEST_POLICY_P3);
    await enforcer.removeGroupingPolicy(TEST_BUNDLE_2, TEST_POLICY_P);

    await casbinService.reloadPolicy();
  });

  afterAll(async () => {
    // Teardown test rules
    const enforcer = casbinService.getEnforcer();
    await enforcer.removePolicy(TEST_POLICY_P, 'hcp', 'test', 'displayName:Test Analytics|route:/test|icon:/test.svg|order:99');
    await enforcer.removeNamedPolicy('p2', TEST_POLICY_P2, 'hcp', 'claim', 'process', 'main', 'edit');
    await enforcer.removeNamedPolicy('p3', TEST_POLICY_P3, 'hcp', 'claim', 'amount', 'details', 'amount', 'edit');

    await enforcer.removeNamedGroupingPolicy('g3', TEST_ROLE, TEST_BUNDLE_1);
    await enforcer.removeNamedGroupingPolicy('g3', TEST_ROLE, TEST_BUNDLE_2);
    await enforcer.removeNamedGroupingPolicy('g3', TEST_ROLE_2, TEST_BUNDLE_1);
    await enforcer.removeGroupingPolicy(TEST_BUNDLE_1, TEST_POLICY_P);
    await enforcer.removeGroupingPolicy(TEST_BUNDLE_1, TEST_POLICY_P2);
    await enforcer.removeGroupingPolicy(TEST_BUNDLE_1, TEST_POLICY_P3);
    await enforcer.removeGroupingPolicy(TEST_BUNDLE_2, TEST_POLICY_P);

    await casbinService.reloadPolicy();
    await app.close();
  });

  // ==========================================================================
  // 1. Role -> Bundle Tests
  // ==========================================================================
  describe('Role → Bundle Management (via g3)', () => {
    it('should assign a Policy Bundle to a Role', async () => {
      await casbinService.assignBundleToRole(TEST_ROLE, TEST_BUNDLE_1);
      const bundles = await casbinService.getBundlesForRole(TEST_ROLE);

      expect(bundles).toContain(TEST_BUNDLE_1);
    });

    it('should assign multiple Bundles to a Role', async () => {
      await casbinService.assignBundleToRole(TEST_ROLE, TEST_BUNDLE_2);
      const bundles = await casbinService.getBundlesForRole(TEST_ROLE);

      expect(bundles).toContain(TEST_BUNDLE_1);
      expect(bundles).toContain(TEST_BUNDLE_2);
    });

    it('should handle duplicate Bundle assignment gracefully', async () => {
      await casbinService.assignBundleToRole(TEST_ROLE, TEST_BUNDLE_1);
      const bundles = await casbinService.getBundlesForRole(TEST_ROLE);

      const occurrences = bundles.filter((b) => b === TEST_BUNDLE_1).length;
      expect(occurrences).toBe(1);
    });

    it('should remove a Bundle from a Role without deleting the Bundle', async () => {
      await casbinService.removeBundleFromRole(TEST_ROLE, TEST_BUNDLE_2);
      const bundles = await casbinService.getBundlesForRole(TEST_ROLE);

      expect(bundles).toContain(TEST_BUNDLE_1);
      expect(bundles).not.toContain(TEST_BUNDLE_2);
    });
  });

  // ==========================================================================
  // 2. Bundle -> Policy Tests
  // ==========================================================================
  describe('Bundle → Policy Management (via g)', () => {
    it('should add P, P2, and P3 policies to a Policy Bundle', async () => {
      await casbinService.addPolicyToBundle(TEST_BUNDLE_1, TEST_POLICY_P);
      await casbinService.addPolicyToBundle(TEST_BUNDLE_1, TEST_POLICY_P2);
      await casbinService.addPolicyToBundle(TEST_BUNDLE_1, TEST_POLICY_P3);

      const policies = await casbinService.getPoliciesForBundle(TEST_BUNDLE_1);
      expect(policies).toContain(TEST_POLICY_P);
      expect(policies).toContain(TEST_POLICY_P2);
      expect(policies).toContain(TEST_POLICY_P3);
    });

    it('should allow the same policy to be referenced by multiple Bundles', async () => {
      await casbinService.addPolicyToBundle(TEST_BUNDLE_2, TEST_POLICY_P);

      const bundle1Policies = await casbinService.getPoliciesForBundle(TEST_BUNDLE_1);
      const bundle2Policies = await casbinService.getPoliciesForBundle(TEST_BUNDLE_2);

      expect(bundle1Policies).toContain(TEST_POLICY_P);
      expect(bundle2Policies).toContain(TEST_POLICY_P);
    });

    it('should handle duplicate policy addition to a Bundle gracefully', async () => {
      await casbinService.addPolicyToBundle(TEST_BUNDLE_1, TEST_POLICY_P);

      const policies = await casbinService.getPoliciesForBundle(TEST_BUNDLE_1);
      const occurrences = policies.filter((p) => p === TEST_POLICY_P).length;
      expect(occurrences).toBe(1);
    });

    it('should remove a policy from a Bundle without deleting it globally or from other bundles', async () => {
      await casbinService.removePolicyFromBundle(TEST_BUNDLE_2, TEST_POLICY_P);

      const bundle2Policies = await casbinService.getPoliciesForBundle(TEST_BUNDLE_2);
      const bundle1Policies = await casbinService.getPoliciesForBundle(TEST_BUNDLE_1);

      expect(bundle2Policies).not.toContain(TEST_POLICY_P);
      expect(bundle1Policies).toContain(TEST_POLICY_P);
    });
  });

  // ==========================================================================
  // 3. Centralized Enforcement Tests (Role -> g3 -> Bundle -> g -> Policy)
  // ==========================================================================
  describe('Centralized Casbin Enforcement', () => {
    it('should ALLOW access to P (menu policy) when Role has Bundle containing the policy', async () => {
      const allowed = await casbinService.enforce(TEST_ROLE, TEST_POLICY_P);
      expect(allowed).toBe(true);
    });

    it('should ALLOW access to P2 (section policy) when Role has Bundle containing the policy', async () => {
      const allowed = await casbinService.enforce(
        TEST_ROLE,
        'hcp',
        'claim',
        'process',
        'main',
        'edit',
      );
      expect(allowed).toBe(true);
    });

    it('should ALLOW access to P3 (field policy) when Role has Bundle containing the policy', async () => {
      const allowed = await casbinService.enforce(
        TEST_ROLE,
        'hcp',
        'claim',
        'amount',
        'details',
        'amount',
        'edit',
      );
      expect(allowed).toBe(true);
    });

    it('should DENY access when Role does NOT have the relevant Bundle', async () => {
      const allowedP = await casbinService.enforce(TEST_ROLE_2, TEST_POLICY_P);
      expect(allowedP).toBe(false);

      const allowedP2 = await casbinService.enforce(
        TEST_ROLE_2,
        'hcp',
        'claim',
        'process',
        'main',
        'edit',
      );
      expect(allowedP2).toBe(false);

      const allowedP3 = await casbinService.enforce(
        TEST_ROLE_2,
        'hcp',
        'claim',
        'amount',
        'details',
        'amount',
        'edit',
      );
      expect(allowedP3).toBe(false);
    });

    it('should DENY access when Role has a Bundle, but the requested policy is not in that Bundle', async () => {
      const allowedP = await casbinService.enforce(TEST_ROLE, 'non_existent_menu');
      expect(allowedP).toBe(false);

      const allowedP2 = await casbinService.enforce(
        TEST_ROLE,
        'hcp',
        'claim',
        'unassigned_section',
        'unassigned',
        'edit',
      );
      expect(allowedP2).toBe(false);

      const allowedP3 = await casbinService.enforce(
        TEST_ROLE,
        'hcp',
        'claim',
        'amount',
        'details',
        'secret_field',
        'edit',
      );
      expect(allowedP3).toBe(false);
    });

    it('should support object options parameter in centralized enforce', async () => {
      const allowedMenu = await casbinService.enforce({
        sub: TEST_ROLE,
        key: TEST_POLICY_P,
        ptype: 'p',
      });
      expect(allowedMenu).toBe(true);

      const allowedSection = await casbinService.enforce({
        sub: TEST_ROLE,
        lob: 'hcp',
        page: 'claim',
        module: 'process',
        section: 'main',
        access: 'edit',
      });
      expect(allowedSection).toBe(true);

      const allowedField = await casbinService.enforce({
        sub: TEST_ROLE,
        lob: 'hcp',
        page: 'claim',
        module: 'amount',
        section: 'details',
        field: 'amount',
        access: 'edit',
        ptype: 'p3',
      });
      expect(allowedField).toBe(true);
    });
  });

  describe('Resource Hierarchy & Cascading Logic', () => {
    it('should return coherent Menu -> Section -> Field hierarchy from getResourceHierarchy', async () => {
      const res = await adminService.getResourceHierarchy();
      const hierarchy = res.menus;
      expect(Array.isArray(hierarchy)).toBe(true);
      expect(hierarchy.length).toBeGreaterThan(0);

      const salesMenu = hierarchy.find(
        (m) => m.key.toLowerCase().includes('sales')
      );
      if (salesMenu) {
        expect(salesMenu.policyName).toBeDefined();
        expect(salesMenu.key).toBeDefined();
        expect(salesMenu.displayName).toBeDefined();
        expect(Array.isArray(salesMenu.sections)).toBe(true);
        if (salesMenu.sections.length > 0) {
          const section = salesMenu.sections[0];
          expect(section.key).toBeDefined();
          expect(section.policyName).toBeDefined();
          expect(Array.isArray(section.fields)).toBe(true);
        }
      }
    });

    it('should cascade deletion of child sections and fields when a menu policy is removed from a bundle', async () => {
      const cascadeBundle = await adminService.createPolicyBundle({
        name: 'Cascade Test Bundle',
        description: 'Testing cascading deletion',
        policyNames: [],
      });

      try {
        const res = await adminService.getResourceHierarchy();
        const hierarchy = res.menus;
        const menuWithChildren = hierarchy.find(
          (m) => m.sections.length > 0 && m.sections.some((s) => s.fields.length > 0)
        );

        if (menuWithChildren) {
          const section = menuWithChildren.sections.find((s) => s.fields.length > 0)!;
          const field = section.fields[0];

          await adminService.addPolicyToBundle(cascadeBundle.id, menuWithChildren.policyName, 'p');
          await adminService.addPolicyToBundle(cascadeBundle.id, section.policyName, 'p2');
          await adminService.addPolicyToBundle(cascadeBundle.id, field.policyName, 'p3');

          let bundlePolicies = await adminService.getBundlePolicies(cascadeBundle.id);
          const perms = bundlePolicies.map((p) => p.permission);
          expect(perms).toContain(menuWithChildren.policyName);
          expect(perms).toContain(section.policyName);
          expect(perms).toContain(field.policyName);

          await adminService.removePolicyFromBundle(cascadeBundle.id, menuWithChildren.policyName);

          bundlePolicies = await adminService.getBundlePolicies(cascadeBundle.id);
          const permsAfter = bundlePolicies.map((p) => p.permission);
          expect(permsAfter).not.toContain(menuWithChildren.policyName);
          expect(permsAfter).not.toContain(section.policyName);
          expect(permsAfter).not.toContain(field.policyName);
        }
      } finally {
        await adminService.deletePolicyBundle(cascadeBundle.id);
      }
    });

    it('should sync bundle policies with atomic setBundlePolicies (parent auto-inclusion & cascading deselect)', async () => {
      const syncBundle = await adminService.createPolicyBundle({
        name: 'Test Atomic Sync Bundle',
        description: 'For testing setBundlePolicies',
      });

      try {
        const hierarchy = await adminService.getResourceHierarchy();
        const menu = hierarchy.menus.find((m) => m.sections.length > 0 && m.sections[0].fields.length > 0);
        if (menu) {
          const section = menu.sections[0];
          const field = section.fields[0];

          // 1. Setting only the field should auto-include parent section and menu
          await adminService.setBundlePolicies(syncBundle.id, [field.policyName]);

          let bundlePolicies = await adminService.getBundlePolicies(syncBundle.id);
          let perms = bundlePolicies.map((p) => p.permission);
          expect(perms).toContain(field.policyName);
          expect(perms).toContain(section.policyName);
          expect(perms).toContain(menu.policyName);

          // 2. Updating with empty array should remove everything
          await adminService.setBundlePolicies(syncBundle.id, []);
          bundlePolicies = await adminService.getBundlePolicies(syncBundle.id);
          expect(bundlePolicies.length).toBe(0);
        }
      } finally {
        await adminService.deletePolicyBundle(syncBundle.id);
      }
    });
  });

  describe('CasbinGuard & @usePolicyNeeded Integration', () => {
    let reflector: Reflector;
    let guard: CasbinGuard;

    beforeAll(() => {
      reflector = app.get(Reflector);
      guard = new CasbinGuard(reflector, casbinService);
    });

    it('should allow access when role has the required section policy', async () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userDetails: { role_name: TEST_ROLE } },
          }),
        }),
      } as any;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        lob: 'hcp',
        page: 'claim',
        mod: 'process',
        sec: 'main',
        access: 'edit',
      });

      const allowed = await guard.canActivate(mockContext);
      expect(allowed).toBe(true);
    });

    it('should throw ForbiddenException when role lacks the required policy', async () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: { userDetails: { role_name: TEST_ROLE_2 } },
          }),
        }),
      } as any;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        lob: 'hcp',
        page: 'claim',
        mod: 'process',
        sec: 'main',
        access: 'edit',
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow();
    });

    it('should throw ForbiddenException when token role information is missing', async () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({
            user: undefined,
          }),
        }),
      } as any;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue({
        lob: 'hcp',
        page: 'claim',
        mod: 'process',
        sec: 'main',
        access: 'edit',
      });

      await expect(guard.canActivate(mockContext)).rejects.toThrow('Role information missing from token');
    });

    it('should allow through unconditionally when no @usePolicyNeeded metadata exists', async () => {
      const mockContext = {
        getHandler: () => ({}),
        getClass: () => ({}),
        switchToHttp: () => ({
          getRequest: () => ({}),
        }),
      } as any;

      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);

      const allowed = await guard.canActivate(mockContext);
      expect(allowed).toBe(true);
    });
  });
});
