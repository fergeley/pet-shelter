import { cookies } from "next/headers";
import { getCurrentSession, SessionUser } from "@/lib/security/session";
import { ROLES } from "@/lib/security/rbac";

/**
 * Verifies whether the incoming request is authorized for Admin operations.
 * Evaluates both cryptographic user sessions (ADMIN or COORDINATOR) and
 * secure admin session tokens / secret keys.
 */
export async function verifyAdminSession(): Promise<boolean> {
  try {
    // 1. Validate signed session cookie
    const session: SessionUser | null = await getCurrentSession();
    if (session && (session.role === ROLES.ADMIN || session.role === ROLES.COORDINATOR)) {
      return true;
    }

    // 2. Validate admin_session cookie token
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;
    const adminSecret = process.env.ADMIN_SECRET_KEY || "hope_shelter_admin_secret_key_2026";

    if (token && token === adminSecret) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
