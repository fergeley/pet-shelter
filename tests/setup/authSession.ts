import {
  setSessionCookie,
  clearSessionCookie,
  SessionUser,
} from "@/lib/security/session";
import { ROLES, type Role } from "@/lib/security/rbac";

/** Re-exported so a suite needs one import for the whole sign-in ceremony. */
export type { Role };

/**
 * Signing a test in, in one line.
 *
 * Admin mutations refuse every unauthenticated caller in every environment --
 * `getAdminActorOrThrow()` in `src/actions/pets.ts` used to make an exception for
 * any build that was not production, and no longer does
 * (`docs/tasks/URGENT_NONPRODUCTION_ADMIN_BYPASS.md`). So a suite that drives one
 * has to hold a real session.
 *
 * Three files had each grown their own copy of that ceremony before this module
 * existed. Centralising it is not tidiness: the alternative to a one-liner that
 * works is an author who reaches for `vi.mock("@/lib/security/adminSession")` and
 * relocates the authentication hole into the test suite.
 *
 * Nothing here is a stub. `signInAs` goes through the real `setSessionCookie()`,
 * so a test authenticates exactly as the login action does -- a signed, expiring
 * cookie that `verifyAdminSession()` then validates for real. A test that forgets
 * to call it is refused by the same code path a browser would be.
 *
 * ## Call it from the suite's own `beforeEach`
 *
 * The harness in `nextMocks.ts` clears the cookie jar before every test, and
 * setup-file hooks run ahead of a test file's own, so signing in at module or
 * `describe` scope is wiped before the test body runs.
 *
 * ## It is inert under a local `next/headers` mock
 *
 * A file that declares its own `vi.mock("next/headers", ...)` replaces the
 * harness for that file, and these cookies land in a jar nothing reads. Delete
 * the local mock and use the harness — that is what the two suites migrated
 * alongside this module did.
 */

/** A session identity before it is sealed; `expiresAt` is set by the real seal. */
export type TestIdentity = Omit<SessionUser, "expiresAt">;

/** The administrator an admin-mutation suite acts as unless it needs another. */
export const TEST_ADMIN: TestIdentity = {
  id: "usr-admin-01",
  email: "admin@hopeforstrays.org",
  name: "Dr. Sarah Tan",
  role: ROLES.ADMIN,
};

/**
 * `TEST_ADMIN` as a complete `SessionUser`, for repository calls that take an
 * `actor` argument directly (`insertServerPet(pet, actor)`) rather than reading a
 * cookie. Same identity as the signed-in one on purpose, so a suite that seeds
 * fixtures and then mutates through the actions produces one coherent audit trail.
 */
export const TEST_ADMIN_ACTOR: SessionUser = {
  ...TEST_ADMIN,
  expiresAt: Date.now() + 24 * 60 * 60 * 1000,
};

/** A conventional identity per role, for tests that only care which role acted. */
export function identityForRole(role: Role): TestIdentity {
  return {
    id: `usr-${role.toLowerCase()}`,
    email: `${role.toLowerCase()}@hopeforstrays.org`,
    name: `Test ${role}`,
    role,
  };
}

/**
 * Seals a real session cookie for `who` and returns the sealed user, including
 * the `expiresAt` the seal computed.
 */
export async function signInAs(who: Role | TestIdentity): Promise<SessionUser> {
  const user = typeof who === "string" ? identityForRole(who) : who;
  return setSessionCookie(user);
}

/** Signs in as `TEST_ADMIN`. The one line an admin-mutation suite needs. */
export async function signInAsAdmin(): Promise<SessionUser> {
  return signInAs(TEST_ADMIN);
}

/** Clears the session cookie, for a test that asserts an unauthenticated refusal. */
export async function signOut(): Promise<void> {
  return clearSessionCookie();
}
