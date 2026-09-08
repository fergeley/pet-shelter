import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  pgPool: Pool | undefined;
};

/**
 * The TLS decision for a connection string, as `pg` will actually apply it.
 *
 * `ssl: undefined` hands the decision back to `pg`, which is what an internal
 * host gets; anything else is a demand for a verified certificate.
 */
export interface DatabaseSslPolicy {
  connectionString: string;
  ssl: { rejectUnauthorized: true } | undefined;
}

/**
 * True for a host only reachable from inside the deployment.
 *
 * Loopback, plus any single-label name — `db` and `postgres` are what Docker
 * Compose resolves, and a name with no dot cannot be a public DNS record. The
 * inverse is the part that matters: every dotted host is treated as remote and
 * therefore must present a certificate we can verify.
 */
function isInternalHost(host: string): boolean {
  const h = host.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  return h.startsWith("127.") || !h.includes(".");
}

/**
 * Decides TLS from the *host*, not from how the URL happens to be spelled.
 *
 * Two defects made the old `connectionString.includes("sslmode=require") ||
 * includes("neon.tech")` sniff unsafe, and the second is the dangerous one:
 *
 *  1. A hosted URL written `sslmode=verify-full`, or any non-Neon managed
 *     Postgres with no `sslmode` at all, matched neither substring and so got
 *     `ssl: undefined` — an **unencrypted** connection over the public
 *     internet. Unverified TLS is bad; no TLS is worse.
 *  2. `rejectUnauthorized: false` was passed alongside `connectionString`, and
 *     `pg` merges the *parsed* string over the explicit config
 *     (`connection-parameters.js:60`). `pg-connection-string` emits `ssl: {}`
 *     for `sslmode=require`, so the explicit object was silently discarded.
 *     The setting was inert exactly where it was written to apply, which is
 *     why nothing ever failed to reveal it.
 *
 * So the enforcing path strips `sslmode` before handing the URL to `pg`: with
 * no `ssl` key in the parsed result, the explicit object survives the merge and
 * this module's policy is the one that runs. That also pins behaviour across
 * the semantics change `pg-connection-string` warns about, where `require`
 * stops meaning `verify-full`.
 *
 * ceiling: `sslrootcert`/`sslcert`/`sslkey` in the URL are left in place and
 * still override this policy via the same merge. They are unused here, and the
 * override only ever tightens verification (a custom CA, still verified), so
 * it is left rather than special-cased.
 */
export function resolveDatabaseSsl(rawConnectionString: string): DatabaseSslPolicy {
  let url: URL;
  try {
    url = new URL(rawConnectionString);
  } catch {
    // Unparseable: we cannot prove the host is internal, so demand a
    // verified certificate rather than guess in the permissive direction.
    return { connectionString: rawConnectionString, ssl: { rejectUnauthorized: true } };
  }

  // Internal hosts keep the string byte-identical and let `pg` decide, so a
  // local Postgres deliberately configured for TLS keeps working unchanged.
  if (isInternalHost(url.hostname)) {
    return { connectionString: rawConnectionString, ssl: undefined };
  }

  url.searchParams.delete("sslmode");
  url.searchParams.delete("ssl");
  url.searchParams.delete("uselibpqcompat");

  return { connectionString: url.toString(), ssl: { rejectUnauthorized: true } };
}

function createPrismaClient(): PrismaClient {
  const connectionString =
    process.env.DATABASE_URL ||
    "postgresql://postgres:postgrespassword@localhost:5432/pet_shelter?schema=public";

  try {
    const sslPolicy = resolveDatabaseSsl(connectionString);

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
        connectionString: sslPolicy.connectionString,
        ssl: sslPolicy.ssl,
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
