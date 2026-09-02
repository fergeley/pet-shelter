/**
 * One place for the scripts' database connection.
 *
 * Previously each of the five scripts built its own `new Pool(...)` with
 * `ssl: { rejectUnauthorized: false }` hardcoded and no localhost default. That
 * diverged from prisma/seed.ts and src/lib/prisma.ts, which both gate SSL on
 * the connection string: forcing SSL breaks a plain local Postgres, which
 * answers "server does not support SSL connections", and requiring
 * DATABASE_URL broke the local default those two files fall back to.
 */
import dotenv from "dotenv";
import { Pool } from "pg";

dotenv.config({ path: ".env.local" });
dotenv.config();

/** Same default as prisma/seed.ts and src/lib/prisma.ts. */
export const LOCAL_FALLBACK_URL =
  "postgresql://postgres:postgrespassword@localhost:5432/pet_shelter?schema=public";

export function resolveConnectionString() {
  return process.env.DATABASE_URL || LOCAL_FALLBACK_URL;
}

/** True when the target is Neon or otherwise demands TLS. */
export function requiresSsl(connectionString = resolveConnectionString()) {
  return (
    connectionString.includes("sslmode=require") || connectionString.includes("neon.tech")
  );
}

/** Reports whether the script is about to touch the production branch. */
export function isProductionTarget() {
  return (
    (process.env.NEON_BRANCH || "").toLowerCase() === "production" ||
    resolveConnectionString().includes("neon.tech")
  );
}

export function createPool(overrides = {}) {
  const connectionString = resolveConnectionString();
  return new Pool({
    connectionString,
    ssl: requiresSsl(connectionString) ? { rejectUnauthorized: false } : undefined,
    connectionTimeoutMillis: 20000,
    ...overrides,
  });
}

/**
 * Runs `sql` on a dedicated connection, rolling back before returning it to the
 * pool. Without the rollback a batch that fails mid-transaction goes back
 * "idle in failed transaction", and the next borrower of that connection gets
 * "current transaction is aborted" for every query — including cleanup.
 */
export async function runOnOwnConnection(pool, sql) {
  const client = await pool.connect();
  try {
    await client.query(sql);
    return { ok: true };
  } catch (e) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // Nothing to roll back, or the connection is gone; release either way.
    }
    return { ok: false, error: e.message };
  } finally {
    client.release();
  }
}
