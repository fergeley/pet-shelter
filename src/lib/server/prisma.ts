import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgrespassword@localhost:5432/pet_shelter?schema=public";

  try {
    const isSsl = connectionString.includes("sslmode=require") || connectionString.includes("neon.tech");
    
    // A test run against an unreachable host would otherwise sit on the
    // production 10s connect timeout for *every* query before the dual-layer
    // store gives up and serves fixtures, turning a 7-second suite into a
    // multi-minute one. Refused connections fail instantly either way; this
    // only bounds the filtered/blackholed case.
    //
    // Narrowed to the *deliberately offline* case: a configured DATABASE_URL
    // means someone intends to reach a real database, and a managed Postgres
    // like Neon can take several seconds to wake from idle. Capping that at 2s
    // would turn a cold start into a spurious failure — and under
    // STRICT_PERSISTENCE, into a red integration suite rather than a fallback.
    const isOfflineTestRun = process.env.NODE_ENV === "test" && !process.env.DATABASE_URL;
    const connectionTimeoutMillis = Number(
      process.env.DB_CONNECT_TIMEOUT_MS ?? (isOfflineTestRun ? 2000 : 10000)
    );

    // Reuse connection pool across Turbopack hot reloads in dev mode
    const pool =
      globalForPrisma.pgPool ??
      new Pool({
        connectionString,
        ssl: isSsl ? { rejectUnauthorized: false } : undefined,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis,
      });

    if (process.env.NODE_ENV !== "production") {
      globalForPrisma.pgPool = pool;
    }

    const adapter = new PrismaPg(pool);
    return new PrismaClient({
      adapter,
      log: process.env.PRISMA_LOG === "true" ? ["error", "warn"] : [],
    });
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Prisma] Pool initialization fallback:", err);
    }
    return new PrismaClient({
      log: process.env.PRISMA_LOG === "true" ? ["error", "warn"] : [],
    });
  }
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

/**
 * Closes the Prisma client and the underlying pg pool.
 *
 * Vitest keeps a worker alive while any handle is open, so an integration suite
 * that touched the database hangs at the end of the run without this. Call it
 * from an `afterAll` in the integration setup — never from unit tests, which
 * never establish a connection in the first place.
 *
 * Safe to call more than once, and safe to call when no connection was ever made.
 */
export async function disconnectPrisma(): Promise<void> {
  try {
    await prisma.$disconnect();
  } catch {
    // Already closed, or never connected. Teardown must not fail a green run.
  }

  const pool = globalForPrisma.pgPool;
  if (pool) {
    globalForPrisma.pgPool = undefined;
    try {
      await pool.end();
    } catch {
      // Same rationale as above.
    }
  }
}

export default prisma;
