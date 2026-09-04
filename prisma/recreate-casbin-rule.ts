/**
 * Raw-SQL executor to drop + recreate casbin.casbin_rule with the new v6
 * column (p3 field-level policies need a 7th value slot: v0..v6).
 *
 * Run with: npm run casbin:recreate-table
 * (or: node -r ts-node/register -r tsconfig-paths/register prisma/recreate-casbin-rule.ts)
 *
 * Uses `pg` directly rather than the generated Prisma client — that client's
 * ESM-style ".js" imports only resolve after a full build, not under ts-node.
 *
 * The table is left empty afterwards — CasbinService reseeds it from
 * src/casbin/policies/*.csv automatically the next time the API starts,
 * since it seeds whenever casbin_rule is empty.
 */
import * as fs from 'fs';
import * as path from 'path';
import { config as loadEnv } from 'dotenv';
import { Client } from 'pg';

loadEnv({ path: path.join(__dirname, '..', '.env') });

async function main(): Promise<void> {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is not set');
  }

  const client = new Client({ connectionString: databaseUrl });
  await client.connect();

  const sqlPath = path.join(__dirname, 'recreate-casbin-rule.sql');
  const sql = fs.readFileSync(sqlPath, 'utf-8');

  const statements = sql
    .split(';')
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0 && !statement.startsWith('--'));

  try {
    for (const statement of statements) {
      // eslint-disable-next-line no-console
      console.log(`Executing: ${statement.split('\n')[0]}...`);
      await client.query(statement);
    }

    // eslint-disable-next-line no-console
    console.log('casbin.casbin_rule recreated with v0..v6 columns.');
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('Failed to recreate casbin_rule table:', error);
  process.exit(1);
});

