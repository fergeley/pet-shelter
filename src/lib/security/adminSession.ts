import { cookies } from "next/headers";
import { getCurrentSession, SessionUser } from "@/lib/security/session";
import { ROLES } from "@/lib/security/rbac";
import { timingSafeCompare } from "@/lib/security/crypto";
import { getAdminSecretKey } from "@/lib/security/secrets";

/**
 * How a request proved it was allowed to perform an Admin operation.
 *
 * Only `session` is backed by a signed, expiring, per-user cookie. The other
 * two authorize a request without identifying a human, and every audit row they
 * produce needs to be readable as such.
 */
export type AdminAuthMethod = "session" | "legacy-shared-secret" | "dev-bypass";

/**
 * The actor behind an authorized Admin operation.
 *
 * Intersects `SessionUser` rather than wrapping it, so a principal can be handed
 * straight to the repositories that already take `actor: SessionUser`
 * (`insertServerPet`, `archiveServerPet`, ...) without touching their signatures.
 */
export type AdminPrincipal = SessionUser & { authMethod: AdminAuthMethod };

/**
 * Recorded when the legacy `admin_session` shared secret -- and nothing else --
 * authorized the request.
 *
 * The role is genuinely `ADMIN`, because that is what this branch grants;
 * claiming anything lesser would understate the privilege in the audit trail.
 * What must never be ambiguous is that no *person* was identified, so this
 * identity is unmistakable in three independent ways:
 *
 * 1. `id` is not a user id and matches no row in the user store.
 * 2. `email` sits under `.invalid`, the RFC 2606 reserved TLD, so it cannot
 *    collide with a real staff mailbox and is greppable in an audit export.
 *    This is the concrete fix: the identity previously fabricated for this case
 *    was `admin@hopeforstrays.org`, which is the pattern real admins use.
 * 3. `expiresAt` is 0, which is the honest answer -- a static bearer token has
 *    no expiry. A real session always carries a future timestamp.
 *
 * Removing this branch outright is tracked as
 * `docs/archives/tasks/TARGET_SECRET_HARDENING.md` §3.5.
 */
export const LEGACY_ADMIN_TOKEN_PRINCIPAL: AdminPrincipal = {
  id: "legacy-admin-token",
  email: "shared-secret@admin-token.invalid",
  name: "Legacy admin token (shared secret)",
  role: ROLES.ADMIN,
  expiresAt: 0,
  authMethod: "legacy-shared-secret",
};

/**
 * Recorded when authentication was not satisfied at all and a non-production
 * build let the mutation through anyway.
 *
 * This constant does not create that bypass -- `src/actions/pets.ts` has always
 * had it -- it names it. Previously one fabricated `admin@hopeforstrays.org`
 * identity served both this case and the shared-secret case above, so an audit
 * row could not distinguish "a token holder acted" from "nobody authenticated
 * and the build was not production".
 *
 * The bypass itself is a separate weakness, deliberately left in place here.
 */
export const DEV_BYPASS_PRINCIPAL: AdminPrincipal = {
  id: "dev-unauthenticated",
  email: "unauthenticated@dev-bypass.invalid",
  name: "Unauthenticated (development bypass)",
  role: ROLES.ADMIN,
  expiresAt: 0,
  authMethod: "dev-bypass",
};

/**
 * Resolves the principal authorized for Admin operations, or `null`.
 *
 * Returns the actor rather than a bare boolean so callers can name *who* acted
 * in `recordAuditLog`, which `docs/architecture/LAYERS.md` §9 rule 5 requires of
 * every privileged mutation. `null` is the only unauthorized value, so
 * `if (!principal)` reads exactly as the old `if (!isAuthorized)` did.
 *
 * Order is unchanged and deliberate: the signed session is tried first, the
 * shared secret only as a fallback, and any throw fails closed.
 */
export async function verifyAdminSession(): Promise<AdminPrincipal | null> {
  try {
    // 1. Validate signed session cookie
    const session: SessionUser | null = await getCurrentSession();
    if (session && (session.role === ROLES.ADMIN || session.role === ROLES.COORDINATOR)) {
      return { ...session, authMethod: "session" };
    }

    // 2. Validate admin_session cookie token.
    // NOTE: this shared-secret branch is a static bearer token with no expiry,
    // subject, or revocation. Hardening the secret makes it harder to guess,
    // not sound; removing it in favour of the signed session is tracked as a
    // follow-on (docs/archives/tasks/TARGET_SECRET_HARDENING.md §3.5).
    //
    // Reached only when the session branch did not authorize, so it can never
    // mask a real admin -- but it CAN be reached while a lower-privileged
    // session (a VOLUNTEER, say) is present. The token authorized the request,
    // not that user, so the token is what gets named.
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;

    if (token && timingSafeCompare(token, getAdminSecretKey())) {
      return LEGACY_ADMIN_TOKEN_PRINCIPAL;
    }

    return null;
  } catch {
    return null;
  }
}
