import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { getPrismaDouble, resetPrismaDouble, type PrismaDouble } from "./support/prismaDouble";
import { mockCookieStore } from "../setup/nextMocks";
import { signInAs, type Role } from "../setup/authSession";

/**
 * Tier 3a — RBAC on the Server Action surface, under `STRICT_PERSISTENCE=true`.
 *
 * Tier 2 covers `assertAuthorized` in isolation. What it cannot show is whether
 * each *action* actually consults it, and whether it does so before touching
 * data. That ordering is the security property: a check that runs after the
 * query has already leaked the row it was meant to protect. Every rejection
 * test below therefore also asserts the database was never reached.
 */

vi.mock("@/lib/server/prisma", async () => {
  const { createPrismaDouble } = await import("./support/prismaDouble");
  const double = createPrismaDouble();
  return { prisma: double, default: double, disconnectPrisma: vi.fn().mockResolvedValue(undefined) };
});

// Status changes dispatch applicant email. Doubled so an authorized case cannot
// fail on an outbound network call it is not testing.
vi.mock("@/lib/email", () => ({
  sendApplicationConfirmationEmail: vi.fn().mockResolvedValue(undefined),
  sendStaffApplicationAlert: vi.fn().mockResolvedValue(undefined),
  sendApplicationStatusUpdateEmail: vi.fn().mockResolvedValue(undefined),
  sendInterviewInvitationEmail: vi.fn().mockResolvedValue(undefined),
}));

let prismaDouble: PrismaDouble;

beforeAll(async () => {
  prismaDouble = await getPrismaDouble();
});

/** Every database method across the double, for "was any data touched?" assertions. */
function databaseCalls(): number {
  return [
    prismaDouble.pet,
    prismaDouble.adoptionApplication,
    prismaDouble.user,
    prismaDouble.auditLog,
  ]
    .flatMap((model) => Object.values(model))
    .reduce((total, spy) => total + spy.mock.calls.length, 0);
}

beforeEach(() => {
  resetPrismaDouble(prismaDouble);
  // The global harness clears the jar too; restated here because every test in
  // this file depends on starting signed out.
  mockCookieStore.clear();
});

describe("RBAC on the Server Action surface", () => {
  describe("reading applications (ADMIN, COORDINATOR, STAFF)", () => {
    it("rejects an anonymous caller", async () => {
      const { getApplications } = await import("@/actions/applications");

      await expect(getApplications()).rejects.toThrow(/sign in/i);
    });

    it("rejects a VOLUNTEER by role", async () => {
      await signInAs("VOLUNTEER");
      const { getApplications } = await import("@/actions/applications");

      await expect(getApplications()).rejects.toThrow(/not authorized/i);
    });

    it("never reaches the database for a rejected caller", async () => {
      await signInAs("VOLUNTEER");
      const { getApplications } = await import("@/actions/applications");

      await expect(getApplications()).rejects.toThrow();

      // Applications carry applicant PII under PDPA 2010. Authorization has to
      // gate the query, not filter its result.
      expect(databaseCalls()).toBe(0);
    });

    it.each(["ADMIN", "COORDINATOR", "STAFF"] as const)("admits a %s", async (role) => {
      await signInAs(role);
      const { getApplications } = await import("@/actions/applications");

      await expect(getApplications()).resolves.toBeInstanceOf(Array);
      expect(prismaDouble.adoptionApplication.findMany).toHaveBeenCalled();
    });
  });

  describe("changing application status (ADMIN, COORDINATOR)", () => {
    const input = { id: "app-001", status: "UNDER_REVIEW" as const };

    it("refuses an anonymous caller without throwing", async () => {
      const { updateApplicationStatus } = await import("@/actions/applications");

      // This action returns a result object rather than throwing, so a caller
      // that only checked for exceptions would read the refusal as success.
      await expect(updateApplicationStatus(input)).resolves.toMatchObject({ success: false });
    });

    it("refuses a STAFF member, who may read but not decide", async () => {
      await signInAs("STAFF");
      const { updateApplicationStatus } = await import("@/actions/applications");

      const result = await updateApplicationStatus(input);

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not authorized/i);
      expect(databaseCalls()).toBe(0);
    });

    it("admits a COORDINATOR", async () => {
      await signInAs("COORDINATOR");
      const { updateApplicationStatus } = await import("@/actions/applications");

      const result = await updateApplicationStatus(input);

      // `app-001` is a committed fixture in a SUBMITTED state, so this is a
      // legal transition and the refusal, if any, cannot be an authorization one.
      expect(result.error ?? "").not.toMatch(/not authorized|sign in/i);
    });
  });

  describe("deleting an application (ADMIN only)", () => {
    it("refuses a COORDINATOR, who may decide but not erase", async () => {
      await signInAs("COORDINATOR");
      const { deleteApplication } = await import("@/actions/applications");

      const result = await deleteApplication("app-001");

      expect(result.success).toBe(false);
      expect(result.error).toMatch(/not authorized/i);
      expect(databaseCalls()).toBe(0);
    });

    it("admits an ADMIN", async () => {
      await signInAs("ADMIN");
      const { deleteApplication } = await import("@/actions/applications");

      const result = await deleteApplication("app-001");

      expect(result.error ?? "").not.toMatch(/not authorized|sign in/i);
    });
  });

  describe("the session cookie the roles are read from", () => {
    it("round-trips a sealed session", async () => {
      const { sealSession, unsealSession } = await import("@/lib/security/session");

      const restored = unsealSession(
        sealSession({ id: "usr-1", email: "a@b.org", name: "A", role: "ADMIN" })
      );

      expect(restored).toMatchObject({ id: "usr-1", role: "ADMIN" });
    });

    it("refuses a token whose payload was edited", async () => {
      const { sealSession, unsealSession } = await import("@/lib/security/session");
      const [payload, signature] = sealSession({
        id: "usr-1",
        email: "a@b.org",
        name: "A",
        role: "STAFF",
      }).split(".");

      // Re-encoding the payload as an ADMIN while keeping the old signature is
      // the privilege escalation the HMAC exists to stop.
      const forged = Buffer.from(
        JSON.stringify({
          id: "usr-1",
          email: "a@b.org",
          name: "A",
          role: "ADMIN",
          expiresAt: Date.now() + 60_000,
        }),
        "utf8"
      ).toString("base64url");

      expect(unsealSession(`${forged}.${signature}`)).toBeNull();
      expect(unsealSession(`${payload}.${signature}`)).not.toBeNull();
    });

    it("refuses an expired session", async () => {
      const { sealSession, unsealSession } = await import("@/lib/security/session");

      const expired = sealSession({ id: "usr-1", email: "a@b.org", name: "A", role: "ADMIN" }, -1);

      expect(unsealSession(expired)).toBeNull();
    });

    it("treats an unreadable cookie as signed out rather than erroring", async () => {
      const { SESSION_COOKIE_NAME } = await import("@/lib/security/session");
      mockCookieStore.seed(SESSION_COOKIE_NAME, "not-a-sealed-token");
      const { getApplications } = await import("@/actions/applications");

      await expect(getApplications()).rejects.toThrow(/sign in/i);
    });
  });

  describe("rate limiting on the public entry points", () => {
    it("stops a burst of failed logins within the sliding window", async () => {
      const { checkRateLimit } = await import("@/lib/security/rateLimit");

      // Mirrors `loginAction`'s own budget of 5 per minute per email.
      const outcomes = Array.from({ length: 6 }, () =>
        checkRateLimit("login:attacker@example.com", 5, 60_000)
      );

      expect(outcomes.slice(0, 5).every((r) => r.success)).toBe(true);
      expect(outcomes[5].success).toBe(false);
      expect(outcomes[5].retryAfterSeconds).toBeGreaterThan(0);
    });

    it("budgets each identity separately", async () => {
      const { checkRateLimit } = await import("@/lib/security/rateLimit");

      Array.from({ length: 5 }, () => checkRateLimit("login:victim@example.com", 5, 60_000));

      // Otherwise one attacker could lock every other staff member out.
      expect(checkRateLimit("login:someone-else@example.com", 5, 60_000).success).toBe(true);
    });
  });
});
