import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv({ path: path.join(__dirname, '..', '.env') });

export async function createPolicyBundleTables(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  try {
    // 1. Ensure casbin schema exists
    await client.query(`CREATE SCHEMA IF NOT EXISTS casbin;`);

    // 2. Ensure casbin.casbin_rule exists
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

    // 3. Ensure casbin.policy_bundle exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS casbin.policy_bundle (
        id SERIAL PRIMARY KEY,
        name VARCHAR(100) UNIQUE NOT NULL,
        description TEXT,
        created_at TIMESTAMP(0) NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP(0) NOT NULL DEFAULT NOW()
      );
    `);

    // 4. Ensure casbin.policy_bundle_policy exists
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

    console.log('Casbin Policy Bundle tables initialized successfully.');
  } finally {
    await client.end();
  }
}

if (require.main === module) {
  createPolicyBundleTables().catch((err) => {
    console.error('Failed to initialize policy bundle tables:', err);
    process.exit(1);
  });
}

