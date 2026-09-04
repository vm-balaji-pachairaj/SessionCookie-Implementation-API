import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv({ path: path.join(__dirname, '..', '.env') });

export async function migrateToPolicyBundles(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    console.log('Starting migration to Policy Bundle architecture...');

    // 1. Fetch distinct policy types for mapping
    const pPolicies = await client.query(
      `SELECT DISTINCT v0 as name FROM casbin.casbin_rule WHERE ptype = 'p' AND v0 IS NOT NULL;`
    );
    const p2Policies = await client.query(
      `SELECT DISTINCT v0 as name FROM casbin.casbin_rule WHERE ptype = 'p2' AND v0 IS NOT NULL;`
    );
    const p3Policies = await client.query(
      `SELECT DISTINCT v0 as name FROM casbin.casbin_rule WHERE ptype = 'p3' AND v0 IS NOT NULL;`
    );

    const pSet = new Set(pPolicies.rows.map((r) => r.name));
    const p2Set = new Set(p2Policies.rows.map((r) => r.name));
    const p3Set = new Set(p3Policies.rows.map((r) => r.name));

    // 2. Fetch all existing 'g' rules (direct Role -> Policy assignments)
    // In the old architecture, v0 was the role name, v1 was the permission / menu / field policy name.
    const gRows = await client.query(
      `SELECT id, v0 as role, v1 as target FROM casbin.casbin_rule WHERE ptype = 'g' AND v0 IS NOT NULL AND v1 IS NOT NULL;`
    );

    console.log(`Found ${gRows.rows.length} direct 'g' rule(s) in casbin_rule.`);

    // Group targets by role
    const rolePoliciesMap = new Map<string, Set<string>>();
    for (const row of gRows.rows) {
      const role = row.role;
      const target = row.target;
      if (!rolePoliciesMap.has(role)) {
        rolePoliciesMap.set(role, new Set());
      }
      rolePoliciesMap.get(role)!.add(target);
    }

    console.log(`Found ${rolePoliciesMap.size} role(s) with direct policy assignments.`);

    // 3. For each role, create a corresponding Policy Bundle and attach policies
    for (const [role, targets] of rolePoliciesMap.entries()) {
      const bundleName = `${role} Bundle`;
      const bundleDesc = `Default bundle migrated for ${role}`;

      // Insert bundle into policy_bundle
      const bundleRes = await client.query(
        `INSERT INTO casbin.policy_bundle (name, description, created_at, updated_at)
         VALUES ($1, $2, NOW(), NOW())
         ON CONFLICT (name) DO UPDATE SET updated_at = NOW()
         RETURNING id;`,
        [bundleName, bundleDesc]
      );
      const bundleId = bundleRes.rows[0].id;

      // For each target policy, insert into policy_bundle_policy and casbin_rule (ptype = 'g', v0 = bundle, v1 = target)
      for (const target of targets) {
        let ptype = 'p';
        if (p2Set.has(target)) {
          ptype = 'p2';
        } else if (p3Set.has(target)) {
          ptype = 'p3';
        }

        // Add to policy_bundle_policy
        await client.query(
          `INSERT INTO casbin.policy_bundle_policy (bundle_id, policy_name, ptype, created_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT ON CONSTRAINT uq_bundle_policy_ptype DO NOTHING;`,
          [bundleId, target, ptype]
        );

        // Add to casbin.casbin_rule as (g, bundleName, target)
        await client.query(
          `INSERT INTO casbin.casbin_rule (ptype, v0, v1)
           VALUES ('g', $1, $2)
           ON CONFLICT DO NOTHING;`,
          [bundleName, target]
        );
      }

      // 4. Assign bundle to role via g3: (g3, role, bundleName)
      await client.query(
        `INSERT INTO casbin.casbin_rule (ptype, v0, v1)
         VALUES ('g3', $1, $2)
         ON CONFLICT DO NOTHING;`,
        [role, bundleName]
      );

      console.log(
        `Created bundle "${bundleName}" (id: ${bundleId}) with ${targets.size} policies and linked to role "${role}" via g3.`
      );
    }

    // 5. Remove obsolete direct Role -> Policy 'g' rules (where v0 is a role)
    const roleNames = Array.from(rolePoliciesMap.keys());
    if (roleNames.length > 0) {
      const deleteResult = await client.query(
        `DELETE FROM casbin.casbin_rule WHERE ptype = 'g' AND v0 = ANY($1::text[]);`,
        [roleNames]
      );
      console.log(`Deleted ${deleteResult.rowCount} obsolete direct role-policy 'g' rules.`);
    }

    // 6. Verify final state
    const ruleCounts = await client.query(
      `SELECT ptype, count(*) FROM casbin.casbin_rule GROUP BY ptype ORDER BY ptype;`
    );
    console.log('Casbin rule counts after migration:', ruleCounts.rows);

    const bundleCount = await client.query(`SELECT count(*) FROM casbin.policy_bundle;`);
    console.log(`Total Policy Bundles in database: ${bundleCount.rows[0].count}`);

    const bundlePolicyCount = await client.query(`SELECT count(*) FROM casbin.policy_bundle_policy;`);
    console.log(`Total Bundle Policies in database: ${bundlePolicyCount.rows[0].count}`);

    console.log('Migration to Policy Bundle architecture completed successfully!');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  migrateToPolicyBundles().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
  });
}

