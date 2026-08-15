import { cookies } from "next/headers";
import { signPayload, verifySignature } from "./crypto";

export const SESSION_COOKIE_NAME = "hope_shelter_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: "ADMIN" | "COORDINATOR" | "STAFF" | "VOLUNTEER";
  expiresAt: number;
}

/**
 * Seals user session payload into a signed base64 string.
 */
export function sealSession(
  user: Omit<SessionUser, "expiresAt">,
  maxAgeSeconds: number = SESSION_MAX_AGE_SECONDS
): string {
  const expiresAt = Date.now() + maxAgeSeconds * 1000;
  const payloadData: SessionUser = { ...user, expiresAt };
  const jsonString = JSON.stringify(payloadData);
  const base64Payload = Buffer.from(jsonString, "utf8").toString("base64url");
  const signature = signPayload(base64Payload);

  return `${base64Payload}.${signature}`;
}

/**
 * Unseals and cryptographically validates a signed session string.
 */
export function unsealSession(token: string): SessionUser | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [base64Payload, signature] = parts;
    const isValidSignature = verifySignature(base64Payload, signature);
    if (!isValidSignature) return null;

    const jsonString = Buffer.from(base64Payload, "base64url").toString("utf8");
    const session: SessionUser = JSON.parse(jsonString);

    if (Date.now() > session.expiresAt) {
      return null; // Session expired
    }

    return session;
  } catch {
    return null;
  }
}

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
