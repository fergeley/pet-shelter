import { cookies } from "next/headers";
import {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sealSession,
  unsealSession,
  type SessionUser,
} from "./sessionToken";

// The token codec lives in ./sessionToken so that proxy.ts, which cannot import
// next/headers, can verify a session with the same code. Re-exported here to
// keep every existing `from "@/lib/security/session"` import working.
export {
  SESSION_COOKIE_NAME,
  SESSION_MAX_AGE_SECONDS,
  sealSession,
  unsealSession,
} from "./sessionToken";
export type { SessionUser } from "./sessionToken";

/**
 * Sets a secure, HTTP-only signed session cookie in Next.js Server Action / Route.
 * Returns the fully formed SessionUser with computed expiresAt timestamp.
 */
export async function setSessionCookie(
  user: Omit<SessionUser, "expiresAt">,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS
): Promise<SessionUser> {
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  const sessionUser: SessionUser = { ...user, expiresAt };
  const token = sealSession(user, maxAgeSeconds);
  const cookieStore = await cookies();

  cookieStore.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  return sessionUser;
}

/**
 * Clears the session cookie.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

/**
 * Retrieves and validates the current user session from cookies.
 *
 * The role is returned exactly as the cookie carries it. Normalising here was
 * tried and was a privilege escalation: `normalizeRole` folds VOLUNTEER onto
 * STAFF because that is the nearest canonical *identity*, but STAFF holds
 * VIEW_APPLICATIONS and a VOLUNTEER never could read applications — they carry
 * applicant PII under PDPA 2010. Rewriting the role before the permission check
 * handed every existing volunteer that grant.
 *
 * Deprecated aliases still authorize correctly, because `permissionsForRole`
 * resolves them itself and fails closed on anything it does not recognise. The
 * migration to canonical roles happens where a session is *minted* —
 * `loginAction` normalises before sealing — not where one is read.
 */
export async function getCurrentSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie || !sessionCookie.value) return null;

    return unsealSession(sessionCookie.value);
  } catch {
    return null;
  }
}
