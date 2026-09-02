import { cookies } from "next/headers";
import { getVerifiedSession } from "@/lib/security/dal";
import { hasPermission, type Permission } from "@/lib/security/rbac";

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
 * The only admin authorization helper: asking for a specific capability is what
 * lets an ANIMAL_MANAGER edit pets and upload media without also reaching
 * shelter settings or staff administration. A coarse "is this an operator?"
 * predicate used to live here as `verifyAdminSession`; it was removed once
 * every call site had a capability to name, because a boolean that means
 * "somebody privileged" invites exactly the over-broad guard this module
 * exists to prevent.
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
