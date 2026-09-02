import { ROLES, Role, hasRole } from "@/lib/security/rbac";
import { SessionUser } from "@/lib/security/session";

/**
 * Who may change donation QR codes.
 *
 * The original request named `SUPER_ADMIN` and `ANIMAL_MANAGER`. Neither role
 * exists: this deployment's `Role` enum is ADMIN / COORDINATOR / STAFF /
 * VOLUNTEER, in the Prisma schema and in the live database alike. Adding enum
 * members would mean an `ALTER TYPE` on production plus a rewrite of every
 * authorization call site, which is well beyond a QR upload feature, so the
 * intent is mapped onto the roles that exist:
 *
 *   SUPER_ADMIN    -> ADMIN
 *   ANIMAL_MANAGER -> COORDINATOR
 *
 * The two scopes are deliberately not the same set. Shelter-wide QR codes
 * decide where every donation on the site is routed, and today only ADMIN can
 * write `ShelterSettings`; granting COORDINATOR that power would widen an
 * existing security boundary as a side effect of adding a feature. A per-animal
 * QR is scoped to one fund drive and matches the access COORDINATOR already has
 * over pet records, so it stays there.
 */

/** Roles permitted to change the shelter-wide donation QR codes. */
export const QR_GLOBAL_WRITE_ROLES: readonly Role[] = [ROLES.ADMIN];

/** Roles permitted to set a per-animal fund-drive QR code. */
export const QR_PET_WRITE_ROLES: readonly Role[] = [ROLES.ADMIN, ROLES.COORDINATOR];

export function canEditGlobalQr(user: SessionUser | null): boolean {
  return hasRole(user, [...QR_GLOBAL_WRITE_ROLES]);
}

export function canEditPetQr(user: SessionUser | null): boolean {
  return hasRole(user, [...QR_PET_WRITE_ROLES]);
}
