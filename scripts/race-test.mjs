/**
 * Proves the migration is safe to run from several worktrees at once.
 *
 * Two parts:
 *  1. Two concurrent runs of the real migration against the live `public`
 *     schema, where every object already exists. Exercises the advisory lock
 *     and the duplicate_object exception. Purely idempotent — creates nothing.
 *  2. A from-scratch race inside a throwaway schema, which is the case that
 *     actually breaks a naive `IF NOT EXISTS (SELECT FROM pg_type)` pre-check.
 *     It also runs the OLD pre-check pattern side by side to show the
 *     difference. The temp schema is dropped in a finally block; nothing in
 *     `public` is touched.
 */
import "dotenv/config";
import dotenv from "dotenv";
import fs from "node:fs";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });

const TEST_SCHEMA = "faq_race_test";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,
});

let passed = 0;
let failed = 0;
const check = (label, ok, detail = "") => {
  if (ok) {
    passed++;
    console.log(`  PASS  ${label}`);
  } else {
    failed++;
    console.log(`  FAIL  ${label}${detail ? "  -- " + detail : ""}`);
  }
};

/** Runs one statement batch on its own dedicated connection. */
async function onOwnConnection(sql) {
  const client = await pool.connect();
  try {
    await client.query(sql);
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  } finally {
    client.release();
  }
}

const migration = fs.readFileSync(
  "prisma/migrations/manual/20260902_add_faq/migration.sql",
  "utf8"
);

// The hardened pattern, parameterised by schema so it can run in the sandbox.
const hardened = (schema) => `
BEGIN;
SELECT pg_advisory_xact_lock(4210771002);
DO $$
BEGIN
  CREATE TYPE "${schema}"."RaceEnum" AS ENUM ('A','B');
EXCEPTION WHEN duplicate_object THEN NULL;
END
$$;
CREATE TABLE IF NOT EXISTS "${schema}"."race_table" (
  "id" TEXT NOT NULL,
  "kind" "${schema}"."RaceEnum" NOT NULL,
  CONSTRAINT "race_table_pkey" PRIMARY KEY ("id")
);
COMMIT;
`;

// The naive pattern this migration used to have: check-then-create, no lock.
const naive = (schema) => `
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'NaiveEnum' AND n.nspname = '${schema}'
  ) THEN
    CREATE TYPE "${schema}"."NaiveEnum" AS ENUM ('A','B');
  END IF;
END
$$;
COMMIT;
`;

try {
  console.log("\n1. Two concurrent runs against the live schema (everything already exists)");
  {
    const [a, b] = await Promise.all([
      onOwnConnection(migration),
      onOwnConnection(migration),
    ]);
    check("first concurrent run succeeded", a.ok, a.error);
    check("second concurrent run succeeded", b.ok, b.error);

    const rows = await pool.query('select count(*)::int n from "faqs"');
    check(`faqs still holds 15 rows (got ${rows.rows[0].n})`, rows.rows[0].n === 15);
  }

  console.log("\n2. From-scratch race in an isolated throwaway schema");
  await pool.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`);
  await pool.query(`CREATE SCHEMA "${TEST_SCHEMA}"`);
  {
    const N = 6;
    const results = await Promise.all(
      Array.from({ length: N }, () => onOwnConnection(hardened(TEST_SCHEMA)))
    );
    const ok = results.filter((r) => r.ok).length;
    check(
      `all ${N} concurrent hardened runs succeeded (${ok}/${N})`,
      ok === N,
      results.find((r) => !r.ok)?.error
    );

    const t = await pool.query(
      `select count(*)::int n from information_schema.tables where table_schema=$1 and table_name='race_table'`,
      [TEST_SCHEMA]
    );
    check("exactly one race_table was created", t.rows[0].n === 1);
  }

  console.log("\n3. The naive check-then-create pattern, same race, for contrast");
  {
    const N = 6;
    const results = await Promise.all(
      Array.from({ length: N }, () => onOwnConnection(naive(TEST_SCHEMA)))
    );
    const failures = results.filter((r) => !r.ok);
    console.log(
      `     ${results.length - failures.length}/${N} succeeded, ${failures.length} lost the race`
    );
    if (failures.length > 0) {
      console.log(`     example error: ${failures[0].error}`);
      console.log("     ^ this is what the hardened pattern avoids");
    } else {
      console.log("     (no failure observed this run — the race is timing-dependent)");
    }
  }
} catch (e) {
  failed++;
  console.error("UNEXPECTED ERROR:", e.message);
} finally {
  await pool.query(`DROP SCHEMA IF EXISTS "${TEST_SCHEMA}" CASCADE`).catch(() => {});
  const left = await pool
    .query(`select count(*)::int n from information_schema.schemata where schema_name=$1`, [
      TEST_SCHEMA,
    ])
    .catch(() => ({ rows: [{ n: -1 }] }));
  console.log(`\ncleanup: throwaway schema removed (remaining: ${left.rows[0].n})`);
  await pool.end();
}

console.log(`\n================  ${passed} passed, ${failed} failed  ================`);
process.exit(failed === 0 ? 0 : 1);
