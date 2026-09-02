import { cookies } from "next/headers";
import { SessionUser } from "@/lib/security/session";
import { getVerifiedSession } from "@/lib/security/dal";
import {
  hasAnyPermission,
  hasPermission,
  PERMISSIONS,
  ROLES,
  type Permission,
} from "@/lib/security/rbac";
import { timingSafeCompare } from "@/lib/security/crypto";
import { getAdminSecretKey } from "@/lib/security/secrets";

/**
 * How a request proved it was allowed to perform an Admin operation.
 *
 * Only `session` is backed by a signed, expiring, per-user cookie.
 * `legacy-shared-secret` authorizes a request without identifying a human, and
 * every audit row it produces needs to be readable as such.
 *
 * There was a third member, `dev-bypass`, recording that nothing authenticated
 * at all and a non-production build allowed the write anyway. It is gone with
 * the bypass itself -- see docs/tasks/URGENT_NONPRODUCTION_ADMIN_BYPASS.md.
 */
export type AdminAuthMethod = "session" | "legacy-shared-secret";

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
 * Since the non-production bypass was removed, this is the only principal that
 * authorizes a mutation without naming a person.
 *
 * Removing this branch outright is tracked as
 * `docs/tasks/TARGET_SECRET_HARDENING.md` §3.5.
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
 * The capabilities that make a session "an operator" when no specific
 * permission is named. Mirrors what ADMIN or COORDINATOR could reach before the
 * capability model, so a no-argument call keeps its original meaning.
 */
const ADMIN_WRITE_PERMISSIONS: Permission[] = [
  PERMISSIONS.MANAGE_MEMBERS,
  PERMISSIONS.MANAGE_PETS,
  PERMISSIONS.MANAGE_PET_MEDIA,
  PERMISSIONS.MANAGE_CONTENT,
  PERMISSIONS.MANAGE_SETTINGS,
  PERMISSIONS.REVIEW_APPLICATIONS,
];

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
export async function verifyAdminSession(
  permission?: Permission
): Promise<AdminPrincipal | null> {
  try {
    // 1. Validate signed session cookie.
    //
    // Resolved through the DAL, which re-reads the member's live role and
    // status, so a suspension or demotion applies on the next request rather
    // than whenever the 24-hour cookie happens to expire.
    //
    // The test here used to be `role === ADMIN || role === COORDINATOR`. That
    // predates the capability model and would now reject an ANIMAL_MANAGER
    // outright, so it asks for the capability the caller actually needs.
    // Omitting `permission` preserves the original coarse meaning — "holds some
    // admin write capability" — for callers that only need to know the request
    // came from an operator.
    const session: SessionUser | null = await getVerifiedSession();
    const authorized = permission
      ? hasPermission(session, permission)
      : hasAnyPermission(session, ADMIN_WRITE_PERMISSIONS);

    if (session && authorized) {
      return { ...session, authMethod: "session" };
    }

    // 2. Validate admin_session cookie token.
    // NOTE: this shared-secret branch is a static bearer token with no expiry,
    // subject, or revocation. Hardening the secret makes it harder to guess,
    // not sound; removing it in favour of the signed session is tracked as a
    // follow-on (docs/tasks/TARGET_SECRET_HARDENING.md §3.5).
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
