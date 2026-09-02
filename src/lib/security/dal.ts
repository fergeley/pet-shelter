import { prisma } from "@/lib/prisma";
import { getCurrentSession, type SessionUser } from "./session";
import {
  ForbiddenError,
  UnauthorizedError,
  assertHasPermission,
  type Permission,
} from "./rbac";
import { USER_STATUSES, normalizeRole } from "./permissions";

/**
 * Server-side Data Access Layer for authorization.
 *
 * The session cookie is stateless and lives for 24 hours, so a role change or
 * a suspension made in /admin/members would otherwise not take effect until
 * the victim's cookie expired. Every guarded entry point resolves the session
 * through here, which re-reads the member's live role and status.
 */

/**
 * Returns the current session with role refreshed from the database, or null
 * when unauthenticated, suspended, or still pending invitation.
 *
 * Failure mode is deliberate: an explicit SUSPENDED/INVITED row denies access,
 * but an *unreachable* database falls back to the cookie's own claims. The rest
 * of this codebase (userStore, auditLog) is built to degrade to in-memory
 * operation when Postgres is offline, and failing every admin request closed on
 * a transient outage would be a worse trade than a suspension taking effect one
 * session late. Revisit if the in-memory fallback is ever removed.
 */
export async function getVerifiedSession(): Promise<SessionUser | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  try {
    const member = await prisma.user.findUnique({
      where: { id: session.id },
      select: { role: true, status: true, name: true, email: true },
    });

    // No row: either a demo/in-memory account or a deleted user. Fall through
    // to the cookie rather than locking out the seeded demo logins.
    if (!member) return session;

    if (member.status !== USER_STATUSES.ACTIVE) return null;

    return {
      ...session,
      name: member.name,
      email: member.email,
      role: normalizeRole(member.role),
    };
  } catch {
    return session;
  }
}

/**
 * Resolves a verified session or throws `UnauthorizedError` (401).
 */
export async function requireSession(): Promise<SessionUser> {
  const session = await getVerifiedSession();
  if (!session) throw new UnauthorizedError();
  return session;
}

/**
 * Resolves a verified session holding `permission`, or throws.
 *
 * Throws `UnauthorizedError` (401) when signed out and `ForbiddenError` (403)
 * when signed in without the capability.
 */
export async function requirePermission(permission: Permission): Promise<SessionUser> {
  const session = await getVerifiedSession();
  assertHasPermission(session, permission);
  return session;
}

/**
 * Non-throwing variant for render-path gating (e.g. hiding a nav tab).
 */
export async function canCurrentUser(permission: Permission): Promise<boolean> {
  try {
    await requirePermission(permission);
    return true;
  } catch (error) {
    if (error instanceof ForbiddenError || error instanceof UnauthorizedError) {
      return false;
    }
    throw error;
  }
}
