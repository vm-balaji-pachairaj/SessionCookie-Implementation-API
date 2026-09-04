import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { CasbinService } from '../src/casbin/casbin.service';
import { AdminService } from '../src/admin/admin.service';

describe('Casbin RBAC Policy Bundle Architecture', () => {
  let app: INestApplication;
  let casbinService: CasbinService;
  let adminService: AdminService;

  const TEST_ROLE = 'Test Automated Role';
  const TEST_ROLE_2 = 'Test Secondary Role';
  const TEST_BUNDLE_1 = 'Test Claims Bundle';
  const TEST_BUNDLE_2 = 'Test Analytics Bundle';

  const TEST_POLICY_P = 'test-claim-process';
  const TEST_POLICY_P2 = 'test_analytics_menu';
  const TEST_POLICY_P3 = 'test-claim-amount';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    casbinService = app.get(CasbinService);
    adminService = app.get(AdminService);

    // Setup dummy policy definitions for testing P, P2, P3
    const enforcer = casbinService.getEnforcer();
    // p: perm, lob, page, mod, sec, access
    await enforcer.addPolicy(TEST_POLICY_P, 'hcp', 'claim', 'process', 'main', 'edit');
    // p2: key, lob, parent, meta
    await enforcer.addNamedPolicy('p2', TEST_POLICY_P2, 'hcp', '_', 'displayName:Test Analytics|route:/test|icon:/test.svg|order:99');
    // p3: perm, lob, page, mod, sec, field, access
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
    await enforcer.removePolicy(TEST_POLICY_P, 'hcp', 'claim', 'process', 'main', 'edit');
    await enforcer.removeNamedPolicy('p2', TEST_POLICY_P2, 'hcp', '_', 'displayName:Test Analytics|route:/test|icon:/test.svg|order:99');
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
      expect(bundle1Policies).toContain(TEST_POLICY_P); // still in bundle 1
    });
  });

  // ==========================================================================
  // 3. Centralized Enforcement Tests (Role -> g3 -> Bundle -> g -> Policy)
  // ==========================================================================
  describe('Centralized Casbin Enforcement', () => {
    // Current state:
    // TEST_ROLE has TEST_BUNDLE_1
    // TEST_BUNDLE_1 has TEST_POLICY_P, TEST_POLICY_P2, TEST_POLICY_P3

    it('should ALLOW access to P (section policy) when Role has Bundle containing the policy', async () => {
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

    it('should ALLOW access to P2 (menu policy) when Role has Bundle containing the policy', async () => {
      const allowed = await casbinService.enforce(TEST_ROLE, TEST_POLICY_P2);
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
      // TEST_ROLE_2 has no bundles assigned
      const allowedP = await casbinService.enforce(
        TEST_ROLE_2,
        'hcp',
        'claim',
        'process',
        'main',
        'edit',
      );
      expect(allowedP).toBe(false);

      const allowedP2 = await casbinService.enforce(TEST_ROLE_2, TEST_POLICY_P2);
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
      // Requesting an ungranted section permission
      const allowedP = await casbinService.enforce(
        TEST_ROLE,
        'hcp',
        'claim',
        'unassigned_section',
        'unassigned',
        'edit',
      );
      expect(allowedP).toBe(false);

      // Requesting an ungranted menu key
      const allowedP2 = await casbinService.enforce(TEST_ROLE, 'non_existent_menu');
      expect(allowedP2).toBe(false);

      // Requesting an ungranted field permission
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
      const allowed = await casbinService.enforce({
        sub: TEST_ROLE,
        lob: 'hcp',
        page: 'claim',
        module: 'process',
        section: 'main',
        access: 'edit',
      });
      expect(allowed).toBe(true);

      const allowedMenu = await casbinService.enforce({
        sub: TEST_ROLE,
        key: TEST_POLICY_P2,
        ptype: 'p2',
      });
      expect(allowedMenu).toBe(true);

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
});

