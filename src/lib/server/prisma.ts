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
 * DNS suffixes reserved for private use, so a name under one cannot be a public
 * record: RFC 6762 (`.local`, which covers Kubernetes' `*.svc.cluster.local`),
 * RFC 8375 (`home.arpa`), and `.internal`, which the cloud providers use for
 * in-VPC names and ICANN has permanently reserved.
 */
const INTERNAL_SUFFIXES = [".local", ".internal", ".localdomain", ".home.arpa"];

/**
 * True for a host only reachable from inside the deployment.
 *
 * A first version of this tested `startsWith("127.") || !includes(".")`, which
 * was wrong in both directions and was caught by review rather than by a test:
 *
 *  - **`[2001:db8::1]` was internal**, because an IPv6 literal contains no dot.
 *    A public IPv6 database therefore got no TLS at all — reintroducing exactly
 *    the plaintext defect this function exists to close, in the one address
 *    family nobody tested.
 *  - **`10.0.1.5`, `192.168.1.9` and `postgres.default.svc.cluster.local` were
 *    remote**, so every private-network Postgres was forced to present a
 *    publicly-trusted certificate and stopped connecting at handshake.
 *  - **`127.example.com` was internal**, because it starts with `127.`.
 *
 * So the address families are now told apart before anything is decided, and a
 * literal is matched against the private ranges rather than against a prefix.
 */
function isInternalHost(rawHost: string): boolean {
  const host = rawHost.toLowerCase().replace(/^\[/, "").replace(/\]$/, "");
  if (host === "") return true;

  if (host.includes(":")) {
    // IPv6 literal: loopback, unique-local (fc00::/7), link-local (fe80::/10).
    return (
      host === "::1" ||
      host === "::" ||
      /^f[cd][0-9a-f]{2}:/.test(host) ||
      /^fe[89ab][0-9a-f]:/.test(host)
    );
  }

  const octets = host.match(/^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (octets) {
    // IPv4 literal: 127/8, 10/8, 172.16/12, 192.168/16, 169.254/16.
    const first = Number(octets[1]);
    const second = Number(octets[2]);
    return (
      first === 127 ||
      first === 10 ||
      (first === 192 && second === 168) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 169 && second === 254)
    );
  }

  // A single-label name cannot be a public DNS record — `db` and `postgres` are
  // what Docker Compose resolves.
  if (!host.includes(".")) return true;

  return INTERNAL_SUFFIXES.some((suffix) => host.endsWith(suffix));
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

  // `sslmode=disable` is the operator saying so in libpq's own vocabulary, in a
  // string they wrote. Overriding it silently would strand a deployment with no
  // recourse and no log line explaining why the database stopped answering.
  // Honoured rather than obeyed blindly: it is the *only* opt-out, it has to be
  // spelled out per connection, and `sslmode=no-verify` is deliberately not one
  // — that is the unverified TLS this function exists to remove, so it is
  // stripped like any other and upgraded to a verified connection.
  if (url.searchParams.get("sslmode") === "disable") {
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
