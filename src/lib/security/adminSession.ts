import { cookies } from "next/headers";
import { getCurrentSession, SessionUser } from "@/lib/security/session";
import { ROLES } from "@/lib/security/rbac";
import { timingSafeCompare } from "@/lib/security/crypto";
import { getAdminSecretKey } from "@/lib/security/secrets";

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

    // 2. Validate admin_session cookie token.
    // NOTE: this shared-secret branch is a static bearer token with no expiry,
    // subject, or revocation. Hardening the secret makes it harder to guess,
    // not sound; removing it in favour of the signed session is tracked as a
    // follow-on (docs/tasks/TARGET_SECRET_HARDENING.md §3.5).
    const cookieStore = await cookies();
    const token = cookieStore.get("admin_session")?.value;

    if (token && timingSafeCompare(token, getAdminSecretKey())) {
      return true;
    }

    return false;
  } catch {
    return false;
  }
}
