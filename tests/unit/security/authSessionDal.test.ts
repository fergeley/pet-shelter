import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Client } from "pg";
import { mockRequestHeaders } from "../../setup/nextMocks";

/**
 * The four security fixes on this branch, pinned together.
 *
 * They share a file because they share a failure mode rather than a subject:
 * every one of them is a guard that was *present in the source and inert at
 * runtime*, so none of them broke a test when it stopped working. Splitting
 * them across four files would put that shared property nowhere.
 *
 * Two suites below are written to fail against a specific wrong fix, because a
 * rate-limit or TLS assertion that passes either way documents an intention
 * instead of enforcing a behaviour:
 *
 *   - "an address budget the email cannot reset" fails against
 *     `register:${ip}:${email}`, which is the composite key that looks like a
 *     fix and is not one.
 *   - "survives pg's own connection-string merge" fails if the `sslmode` strip
 *     is removed, which is what makes the explicit `ssl` option take effect at
 *     all.
 */

vi.mock("@/lib/server/memberStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/memberStore")>()),
  findMemberAuthStateById: vi.fn(),
}));

vi.mock("@/lib/server/userStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/userStore")>()),
  findUserById: vi.fn(),
}));

vi.mock("next/server", () => ({ after: vi.fn() }));

const NEON_HOST = "ep-example-123.eu-central-1.aws.neon.tech";

// ---------------------------------------------------------------------------
// 1. Strict TLS
// ---------------------------------------------------------------------------

describe("resolveDatabaseSsl - certificate verification is not optional", () => {
  it("demands a verified certificate for a Neon URL carrying sslmode=require", async () => {
    const { resolveDatabaseSsl } = await import("@/lib/server/prisma");

    const policy = resolveDatabaseSsl(`postgresql://u:p@${NEON_HOST}/neondb?sslmode=require`);

    expect(policy.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("demands a verified certificate for a hosted URL with no sslmode at all", async () => {
    const { resolveDatabaseSsl } = await import("@/lib/server/prisma");

    // The case the replaced substring sniff got *most* wrong. `neon.tech`
    // matched, `sslmode=require` did not, so this URL reached `pg` with
    // `rejectUnauthorized: false` genuinely in force.
    const policy = resolveDatabaseSsl(`postgresql://u:p@${NEON_HOST}/neondb`);

    expect(policy.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("encrypts a non-Neon hosted database, which the old sniff left in plaintext", async () => {
    const { resolveDatabaseSsl } = await import("@/lib/server/prisma");

    // `includes("sslmode=require") || includes("neon.tech")` was false here, so
    // `ssl` was `undefined` and the connection crossed the public internet
    // unencrypted. Worse than unverified TLS, and completely silent.
    const policy = resolveDatabaseSsl("postgresql://u:p@db.managed-postgres.example.com:5432/app");

    expect(policy.ssl).toEqual({ rejectUnauthorized: true });
  });

  it("survives pg's own connection-string merge, which overrides the explicit ssl option", async () => {
    const { resolveDatabaseSsl } = await import("@/lib/server/prisma");

    const policy = resolveDatabaseSsl(`postgresql://u:p@${NEON_HOST}/neondb?sslmode=require&schema=public`);

    // Asked of `pg` itself rather than simulated. `pg` merges the *parsed*
    // connection string over the explicit config
    // (connection-parameters.js:60), and `pg-connection-string` emits `ssl: {}`
    // for sslmode=require, so without the strip the object below is discarded
    // and this reads `{}`. Constructing a Client resolves that merge without
    // opening a socket.
    const client = new Client({ connectionString: policy.connectionString, ssl: policy.ssl });
    // `connectionParameters` is where pg parks the resolved merge. Real at
    // runtime, absent from pg's published types, hence the cast.
    const resolved = (client as unknown as { connectionParameters: { ssl?: unknown } })
      .connectionParameters.ssl;

    expect(resolved).toEqual({ rejectUnauthorized: true });
    expect(policy.connectionString).not.toContain("sslmode");
    // Everything else about the URL is left alone.
    expect(policy.connectionString).toContain("schema=public");
    expect(policy.connectionString).toContain(NEON_HOST);
  });

  it("leaves a loopback connection exactly as configured", async () => {
    const { resolveDatabaseSsl } = await import("@/lib/server/prisma");

    const local = "postgresql://postgres:postgrespassword@localhost:5432/pet_shelter?schema=public";
    const policy = resolveDatabaseSsl(local);

    // Byte-identical, so a local Postgres deliberately serving TLS keeps
    // whatever `pg` would have negotiated before this change.
    expect(policy.connectionString).toBe(local);
    expect(policy.ssl).toBeUndefined();
  });

  it("treats a Docker Compose service name as internal", async () => {
    const { resolveDatabaseSsl } = await import("@/lib/server/prisma");

    // `postgresql://ci:ci@db:5432/ci_db` is the CI shape. A single-label host
    // cannot be a public DNS record, so demanding a public CA there would
    // break CI for no gain.
    expect(resolveDatabaseSsl("postgresql://ci:ci@db:5432/ci_db").ssl).toBeUndefined();
    expect(resolveDatabaseSsl("postgresql://u:p@127.0.0.1:5432/app").ssl).toBeUndefined();
  });

  // The first version of isInternalHost tested `startsWith("127.") ||
  // !includes(".")`. Every case below was wrong under it, and no test caught
  // any of them — review did.
  it.each([
    ["[2001:db8::1]", "a public IPv6 literal, which has no dot and was read as internal"],
    ["127.example.com", "a public name that merely starts with 127."],
    ["[64:ff9b::1]", "an IPv4-mapped public IPv6 address"],
  ])("demands verified TLS for %s — %s", async (host) => {
    const { resolveDatabaseSsl } = await import("@/lib/server/prisma");

    expect(resolveDatabaseSsl(`postgresql://u:p@${host}:5432/app`).ssl).toEqual({
      rejectUnauthorized: true,
    });
  });

  it.each([
    ["10.0.1.5", "RFC 1918 /8"],
    ["192.168.1.9", "RFC 1918 /16"],
    ["172.20.0.5", "RFC 1918 /12"],
    ["169.254.10.2", "link-local"],
    ["[::1]", "IPv6 loopback"],
    ["[fd12:3456::1]", "IPv6 unique-local"],
    ["[fe80::1]", "IPv6 link-local"],
    ["postgres.default.svc.cluster.local", "a Kubernetes service name"],
    ["db.internal", "a reserved private suffix"],
  ])("leaves %s alone — %s", async (host) => {
    const { resolveDatabaseSsl } = await import("@/lib/server/prisma");

    // Forcing a publicly-trusted certificate onto a private network breaks
    // every one of these at handshake, for connections that worked before.
    expect(resolveDatabaseSsl(`postgresql://u:p@${host}:5432/app`).ssl).toBeUndefined();
  });

  it("honours an explicit sslmode=disable rather than overriding it silently", async () => {
    const { resolveDatabaseSsl } = await import("@/lib/server/prisma");

    const explicit = "postgresql://u:p@db.managed-postgres.example.com:5432/app?sslmode=disable";
    const policy = resolveDatabaseSsl(explicit);

    expect(policy.ssl).toBeUndefined();
    expect(policy.connectionString).toBe(explicit);
  });

  it("does not honour sslmode=no-verify, which is the defect being removed", async () => {
    const { resolveDatabaseSsl } = await import("@/lib/server/prisma");

    const policy = resolveDatabaseSsl(`postgresql://u:p@${NEON_HOST}/neondb?sslmode=no-verify`);

    expect(policy.ssl).toEqual({ rejectUnauthorized: true });
    expect(policy.connectionString).not.toContain("sslmode");
  });

  it("fails closed on a connection string it cannot parse", async () => {
    const { resolveDatabaseSsl } = await import("@/lib/server/prisma");

    expect(resolveDatabaseSsl("not a url").ssl).toEqual({ rejectUnauthorized: true });
  });
});

// ---------------------------------------------------------------------------
// 2. Session revocation in the DAL
// ---------------------------------------------------------------------------

describe("getVerifiedSession - an account that no longer exists is not authenticated", () => {
  const DELETED = {
    id: "usr-deleted-01",
    email: "gone@hopeforstrays.org",
    name: "Former Staffer",
    role: "SUPER_ADMIN" as const,
  };

  async function signIn(user: { id: string; email: string; name: string; role: "SUPER_ADMIN" }) {
    const { setSessionCookie } = await import("@/lib/security/session");
    await setSessionCookie(user);
  }

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("rejects a session whose staff row was deleted from a reachable database", async () => {
    const { findMemberAuthStateById } = await import("@/lib/server/memberStore");
    const { findUserById } = await import("@/lib/server/userStore");
    const { getVerifiedSession } = await import("@/lib/security/dal");

    await signIn(DELETED);
    // Reachable database, no row, and no in-memory account either: the member
    // was deleted. Previously this returned the cookie's own claims, so a
    // deleted SUPER_ADMIN kept every capability for the cookie's full 24 hours.
    vi.mocked(findMemberAuthStateById).mockResolvedValue(null);
    vi.mocked(findUserById).mockResolvedValue(null);

    await expect(getVerifiedSession()).resolves.toBeNull();
  });

  it("denies the deleted administrator every permission, not merely the session", async () => {
    const { findMemberAuthStateById } = await import("@/lib/server/memberStore");
    const { findUserById } = await import("@/lib/server/userStore");
    const { canCurrentUser, requirePermission } = await import("@/lib/security/dal");
    const { PERMISSIONS } = await import("@/lib/security/permissions");
    const { UnauthorizedError } = await import("@/lib/security/rbac");

    await signIn(DELETED);
    vi.mocked(findMemberAuthStateById).mockResolvedValue(null);
    vi.mocked(findUserById).mockResolvedValue(null);

    await expect(canCurrentUser(PERMISSIONS.MANAGE_MEMBERS)).resolves.toBe(false);
    await expect(requirePermission(PERMISSIONS.MANAGE_MEMBERS)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it("keeps a seeded demo login working when the database has no row for it", async () => {
    const { findMemberAuthStateById } = await import("@/lib/server/memberStore");
    const { findUserById } = await import("@/lib/server/userStore");
    const { getVerifiedSession } = await import("@/lib/security/dal");

    await signIn({ ...DELETED, id: "usr-admin-01", email: "admin@hopeforstrays.org" });
    // Reachable but unseeded database. The in-memory store still vouches for
    // this id, which is the whole reason the null-row fallback existed and the
    // reason it was narrowed rather than deleted.
    vi.mocked(findMemberAuthStateById).mockResolvedValue(null);
    vi.mocked(findUserById).mockResolvedValue({
      id: "usr-admin-01",
      email: "admin@hopeforstrays.org",
      name: "Dr. Sarah Tan",
      passwordHash: "scrypt:unused",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    const session = await getVerifiedSession();

    expect(session?.id).toBe("usr-admin-01");
    expect(session?.role).toBe("SUPER_ADMIN");
  });

  it("rejects a fallback account that is suspended rather than merely absent", async () => {
    const { findMemberAuthStateById } = await import("@/lib/server/memberStore");
    const { findUserById } = await import("@/lib/server/userStore");
    const { getVerifiedSession } = await import("@/lib/security/dal");

    await signIn(DELETED);
    vi.mocked(findMemberAuthStateById).mockResolvedValue(null);
    vi.mocked(findUserById).mockResolvedValue({
      id: DELETED.id,
      email: DELETED.email,
      name: DELETED.name,
      passwordHash: "scrypt:unused",
      role: "SUPER_ADMIN",
      status: "SUSPENDED",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(getVerifiedSession()).resolves.toBeNull();
  });

  it("still rejects a suspended row, which was already correct and must stay so", async () => {
    const { findMemberAuthStateById } = await import("@/lib/server/memberStore");
    const { getVerifiedSession } = await import("@/lib/security/dal");

    await signIn(DELETED);
    vi.mocked(findMemberAuthStateById).mockResolvedValue({
      role: "SUPER_ADMIN",
      status: "SUSPENDED",
      name: DELETED.name,
      email: DELETED.email,
    });

    await expect(getVerifiedSession()).resolves.toBeNull();
  });

  it("revokes a deleted seeded administrator in production, where the in-memory seed still vouches for it", async () => {
    const { findMemberAuthStateById } = await import("@/lib/server/memberStore");
    const { findUserById } = await import("@/lib/server/userStore");
    const { getVerifiedSession } = await import("@/lib/security/dal");

    vi.stubEnv("NODE_ENV", "production");
    await signIn({ ...DELETED, id: "usr-admin-01", email: "admin@hopeforstrays.org" });
    vi.mocked(findMemberAuthStateById).mockResolvedValue(null);
    // The real userStore answers this from its hardcoded seed, so the first
    // version of the fix returned a full SUPER_ADMIN session for an account
    // deleted from production — closing the hole everywhere except the five
    // ids that matter most. Mocked to the seed's own answer to prove the
    // production guard, not the mock, is what refuses.
    vi.mocked(findUserById).mockResolvedValue({
      id: "usr-admin-01",
      email: "admin@hopeforstrays.org",
      name: "Dr. Sarah Tan",
      passwordHash: "scrypt:seeded",
      role: "SUPER_ADMIN",
      status: "ACTIVE",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-01T00:00:00.000Z",
    });

    await expect(getVerifiedSession()).resolves.toBeNull();
    // The seed is never even consulted in production.
    expect(vi.mocked(findUserById)).not.toHaveBeenCalled();
  });

  it("still falls back to the cookie when the database is unreachable", async () => {
    const { findMemberAuthStateById } = await import("@/lib/server/memberStore");
    const { getVerifiedSession } = await import("@/lib/security/dal");

    await signIn(DELETED);
    // The deliberate trade documented on readVerifiedSession: a transient
    // outage must not sign every administrator out. Pinned so that hardening
    // the deleted-row case above cannot quietly convert this into fail-closed
    // without someone choosing to.
    vi.mocked(findMemberAuthStateById).mockRejectedValue(new Error("ECONNREFUSED"));

    const session = await getVerifiedSession();

    expect(session?.id).toBe(DELETED.id);
  });
});

// ---------------------------------------------------------------------------
// 3. Registration rate limiting, per address
// ---------------------------------------------------------------------------

describe("registerAction - an address budget the email cannot reset", () => {
  const WRONG_CODE = "definitely-not-the-invite-secret";

  beforeEach(() => {
    // The operator asserting that their proxy overwrites this header. Without
    // it the address is untrusted and the budget deliberately does not run —
    // see `getClientAddress`. Set here rather than assumed, because the header
    // being believed is a configuration decision, not a default.
    vi.stubEnv("TRUSTED_PROXY_HEADER", "x-real-ip");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function register(email: string) {
    return import("@/actions/auth").then(({ registerAction }) =>
      registerAction({
        name: "Brute Forcer",
        email,
        password: "correct-horse-battery",
        staffInviteCode: WRONG_CODE,
      })
    );
  }

  it("does not run at all when no proxy header is trusted", async () => {
    vi.unstubAllEnvs();
    mockRequestHeaders().set("x-real-ip", "203.0.113.9");

    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const result = await register(`guess-${attempt}@example.com`);
      outcomes.push(result.error ?? "SUCCESS");
    }

    // An untrusted header is attacker-supplied input, and a budget keyed on
    // attacker-supplied input is the defect this suite exists to prevent. The
    // honest answer is no address budget, not a guessed one — and above all not
    // the shared "unknown" bucket an earlier version used, which capped the
    // whole shelter at ten registrations a minute.
    expect(outcomes.every((message) => message.includes("invite code"))).toBe(true);
  });

  it("stops a caller who varies the email on every invite-code guess", async () => {
    mockRequestHeaders().set("x-real-ip", "203.0.113.9");

    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const result = await register(`guess-${attempt}@example.com`);
      outcomes.push(result.error ?? "SUCCESS");
    }

    // The discriminating assertion. Keyed on the email — or on the composite
    // `register:${ip}:${email}` — every one of these twelve requests carries a
    // brand-new key and draws a brand-new budget, so all twelve reach the
    // invite comparison and the limiter never fires. Only a key with no
    // attacker-supplied component stops this.
    const throttled = outcomes.filter((message) => message.startsWith("Too many registration attempts"));

    expect(throttled.length).toBeGreaterThan(0);
    expect(outcomes.slice(0, 10).every((message) => message.includes("invite code"))).toBe(true);
    expect(outcomes[11]).toMatch(/^Too many registration attempts/);
  });

  it("gives a different address its own budget", async () => {
    mockRequestHeaders().set("x-real-ip", "203.0.113.9");
    for (let attempt = 0; attempt < 12; attempt += 1) {
      await register(`guess-${attempt}@example.com`);
    }

    mockRequestHeaders().set("x-real-ip", "198.51.100.4");
    const fromElsewhere = await register("someone@example.com");

    // A limiter that throttled every address once any address misbehaved would
    // be a denial-of-service handed to the attacker.
    expect(fromElsewhere.error).toContain("invite code");
  });

  it("keeps the per-email budget, so one address cannot be hammered from many", async () => {
    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      // A different source address each time, so only the email budget can fire.
      mockRequestHeaders().set("x-real-ip", `198.51.100.${attempt}`);
      const result = await register("victim@hopeforstrays.org");
      outcomes.push(result.error ?? "SUCCESS");
    }

    expect(outcomes[6]).toMatch(/^Too many registration attempts/);
  });

  it("reads only the configured header, ignoring one the client also sent", async () => {
    // `x-forwarded-for` is appended to by each hop, so a client that sends its
    // own puts an attacker-chosen value leftmost. Only the header the operator
    // vouched for is read, so varying that one buys the caller nothing.
    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      mockRequestHeaders().set("x-real-ip", "203.0.113.9");
      mockRequestHeaders().set("x-forwarded-for", `192.0.2.${attempt}, 203.0.113.9`);
      const result = await register(`guess-${attempt}@example.com`);
      outcomes.push(result.error ?? "SUCCESS");
    }

    expect(outcomes[11]).toMatch(/^Too many registration attempts/);
  });

  it("takes the leftmost entry, which the trusted hop wrote", async () => {
    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      mockRequestHeaders().set("x-real-ip", `203.0.113.77, 10.0.0.${attempt}`);
      const result = await register(`guess-${attempt}@example.com`);
      outcomes.push(result.error ?? "SUCCESS");
    }

    expect(outcomes[11]).toMatch(/^Too many registration attempts/);
  });

  it("refuses a header value that is not an address, rather than keying on it", async () => {
    // Unvalidated, this becomes a limiter Map key. A caller sending a different
    // multi-kilobyte value per request would grow that Map without bound, which
    // is a cheap memory vector rather than a rate limit.
    const junk = "x".repeat(8192);

    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 12; attempt += 1) {
      mockRequestHeaders().set("x-real-ip", `${junk}${attempt}`);
      const result = await register(`guess-${attempt}@example.com`);
      outcomes.push(result.error ?? "SUCCESS");
    }

    // Not an address, so no address budget — and, critically, no key either.
    expect(outcomes.every((message) => message.includes("invite code"))).toBe(true);
  });
});

describe("loginAction - the same address budget, against password spraying", () => {
  beforeEach(() => {
    vi.stubEnv("TRUSTED_PROXY_HEADER", "x-real-ip");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  function login(email: string) {
    return import("@/actions/auth").then(({ loginAction }) =>
      loginAction({ email, password: "not-the-password" })
    );
  }

  it("stops one address trying a password against many accounts in turn", async () => {
    mockRequestHeaders().set("x-real-ip", "203.0.113.42");

    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 22; attempt += 1) {
      // A different account each time, so `login:${email}` never sees a second
      // attempt and never fires. This is the spray the email key cannot see.
      const result = await login(`victim-${attempt}@hopeforstrays.org`);
      outcomes.push(result.error ?? "SUCCESS");
    }

    expect(outcomes.slice(0, 20).every((message) => message.includes("Invalid staff email"))).toBe(true);
    expect(outcomes[21]).toMatch(/^Too many login attempts/);
  });

  it("keeps the per-account budget for a single account attacked from many addresses", async () => {
    const outcomes: string[] = [];
    for (let attempt = 0; attempt < 7; attempt += 1) {
      mockRequestHeaders().set("x-real-ip", `198.51.100.${attempt}`);
      const result = await login("victim@hopeforstrays.org");
      outcomes.push(result.error ?? "SUCCESS");
    }

    expect(outcomes[6]).toMatch(/^Too many login attempts/);
  });

  it("gives a different address its own budget", async () => {
    mockRequestHeaders().set("x-real-ip", "203.0.113.42");
    for (let attempt = 0; attempt < 22; attempt += 1) {
      await login(`victim-${attempt}@hopeforstrays.org`);
    }

    mockRequestHeaders().set("x-real-ip", "198.51.100.7");
    const fromElsewhere = await login("someone@hopeforstrays.org");

    expect(fromElsewhere.error).toContain("Invalid staff email");
  });
});

// ---------------------------------------------------------------------------
// 4. Audit writes survive a serverless freeze
// ---------------------------------------------------------------------------

describe("recordAuditLog - the write is registered with the request lifetime", () => {
  const ENTRY = {
    actorId: "usr-admin-01",
    actorEmail: "admin@hopeforstrays.org",
    actorRole: "SUPER_ADMIN",
    action: "AUTH_LOGIN_SUCCESS",
    entity: "Auth",
    entityId: "usr-admin-01",
  };

  it("hands the pending write to after(), which is what keeps the invocation alive", async () => {
    const { after } = await import("next/server");
    const { recordAuditLog, flushAuditLogWrites } = await import("@/lib/domain/auditLog");

    vi.mocked(after).mockClear();
    recordAuditLog(ENTRY);

    // Without this the promise is owned by nobody. A serverless host freezes
    // the invocation as soon as the response is sent, and the audit row is
    // lost in production only — where no test runs.
    expect(vi.mocked(after)).toHaveBeenCalledTimes(1);
    expect(vi.mocked(after).mock.calls[0][0]).toBeInstanceOf(Promise);

    await flushAuditLogWrites();
  });

  it("records the entry anyway when there is no request scope to extend", async () => {
    const { after } = await import("next/server");
    const { recordAuditLog, getAuditLogs, flushAuditLogWrites } = await import("@/lib/domain/auditLog");

    vi.mocked(after).mockImplementationOnce(() => {
      throw new Error("`after` was called outside a request scope.");
    });

    // recordAuditLog runs in unit tests, seed scripts and module init as well
    // as in request handlers. An unguarded after() would turn every one of
    // those call sites into a throw.
    expect(() => recordAuditLog(ENTRY)).not.toThrow();
    expect(getAuditLogs(1)[0]?.action).toBe("AUTH_LOGIN_SUCCESS");

    await flushAuditLogWrites();
  });

  it("really does throw outside a request scope, which is why the guard exists", async () => {
    // Measured against the real implementation rather than the mock above, so
    // this stays honest if Next ever makes after() a no-op out of scope. If it
    // does, this test fails and the guard can be simplified on evidence.
    const actual = await vi.importActual<typeof import("next/server")>("next/server");

    expect(() => actual.after(() => {})).toThrow(/outside a request scope/);
  });
});
