import { cookies } from "next/headers";
import { getVerifiedSession } from "@/lib/security/dal";
import { hasAnyPermission, hasPermission, PERMISSIONS, type Permission } from "@/lib/security/rbac";

/**
 * True when the caller presents the shared `ADMIN_SECRET_KEY` token.
 *
 * Pre-existing break-glass path for scripted/administrative access. It bypasses
 * the role matrix entirely, so it is treated as full privilege and kept
 * separate from the session checks below.
 */
async function hasAdminSecretToken(): Promise<boolean> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;
    const adminSecret = process.env.ADMIN_SECRET_KEY || "hope_shelter_admin_secret_key_2026";
    return Boolean(token) && token === adminSecret;
  } catch {
    return false;
  }
}

/**
 * True when the current caller holds `permission`.
 *
 * Prefer this over `verifyAdminSession` for anything capability-specific: it is
 * what lets an ANIMAL_MANAGER edit pets without also granting them settings or
 * staff administration.
 */
export async function hasAdminPermission(permission: Permission): Promise<boolean> {
  try {
    const session = await getVerifiedSession();
    if (hasPermission(session, permission)) return true;
    return await hasAdminSecretToken();
  } catch {
    return false;
  }
}

/**
 * Verifies whether the incoming request is authorized for the admin console at
 * all, i.e. holds at least one write capability.
 *
 * Retained for callers that only need a coarse "is this an operator?" answer.
 * New code should call `hasAdminPermission` with the specific capability.
 */
export async function verifyAdminSession(): Promise<boolean> {
  try {
    const session = await getVerifiedSession();
    const isOperator = hasAnyPermission(session, [
      PERMISSIONS.MANAGE_MEMBERS,
      PERMISSIONS.MANAGE_PETS,
      PERMISSIONS.MANAGE_PET_MEDIA,
      PERMISSIONS.MANAGE_CONTENT,
      PERMISSIONS.MANAGE_SETTINGS,
      PERMISSIONS.REVIEW_APPLICATIONS,
    ]);
    if (isOperator) return true;

    return await hasAdminSecretToken();
  } catch {
    return false;
  }
}
