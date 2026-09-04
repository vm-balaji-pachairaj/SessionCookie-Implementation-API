-- Recreates casbin.casbin_rule with the v6 column (needed for p3 field-level
-- access policies: perm, lob, page, mod, sec, field, access -> v0..v6).
-- Run this manually against the target database (e.g. via psql, a DB client,
-- or api/prisma/recreate-casbin-rule.ts) AFTER backing up/dropping the old table.
-- The app reseeds this table from src/casbin/policies/*.csv on next startup
-- since it seeds automatically whenever casbin_rule is empty.

DROP TABLE IF EXISTS casbin.casbin_rule;

CREATE TABLE casbin.casbin_rule (
  id    SERIAL PRIMARY KEY,
  ptype VARCHAR(10) NOT NULL,
  v0    TEXT,
  v1    TEXT,
  v2    TEXT,
  v3    TEXT,
  v4    TEXT,
  v5    TEXT,
  v6    TEXT,
  CONSTRAINT casbin_policy_ptype_v0_v1_v2_v3_v4_v5_v6_key
    UNIQUE (ptype, v0, v1, v2, v3, v4, v5, v6)
);
