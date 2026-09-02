import { PERMISSIONS, roleHasPermission } from "@/lib/security/permissions";

/**
 * Who may change donation QR codes.
 *
 * The original request for this feature named `SUPER_ADMIN` and
 * `ANIMAL_MANAGER`, and at the time neither existed — the enum was
 * ADMIN / COORDINATOR / STAFF / VOLUNTEER, so the intent had to be mapped onto
 * those. The RBAC work has since landed both roles, and `Role.ANIMAL_MANAGER`
 * is documented in the schema as owning "Pet profiles, gallery photos, QR
 * codes". The request was right, just early.
 *
 * Rather than name roles directly, this asks the permission layer, which is
 * where that mapping now lives:
 *
 * - **Shelter-wide codes** route every donation on the site, so they sit behind
 *   `MANAGE_SETTINGS` alongside the rest of `ShelterSettings`.
 * - **A per-animal code** is scoped to one fund drive and belongs with the
 *   animal's other media, so it sits behind `MANAGE_PET_MEDIA` — which is
 *   exactly the permission `ANIMAL_MANAGER` holds.
 *
 * These gate UI affordances. The server actions re-check the session
 * themselves, which is what actually enforces the boundary.
 */

/** True when this role may change the shelter-wide donation QR codes. */
export function roleCanEditGlobalQr(role: string | null | undefined): boolean {
  return roleHasPermission(role, PERMISSIONS.MANAGE_SETTINGS);
}

/** True when this role may set a per-animal fund-drive QR code. */
export function roleCanEditPetQr(role: string | null | undefined): boolean {
  return roleHasPermission(role, PERMISSIONS.MANAGE_PET_MEDIA);
}
