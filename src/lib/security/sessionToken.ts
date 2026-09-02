import { signPayload, verifySignature } from "./crypto";
import { type Role } from "./permissions";

/**
 * Pure session-token codec.
 *
 * Split out of `session.ts` because that module imports `next/headers`, which
 * is unavailable to `proxy.ts`. Keeping the seal/unseal logic here lets the
 * proxy verify a session with exactly the same code the application uses,
 * rather than a second implementation that could drift out of agreement with
 * it.
 *
 * Import this module for token work and `session.ts` for anything cookie-bound.
 */

export const SESSION_COOKIE_NAME = "hope_shelter_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24; // 24 hours

export interface SessionUser {
  id: string;
  email: string;
  name: string;
  /**
   * Accepts deprecated aliases so cookies issued before the RBAC migration
   * still deserialize. Reads via getCurrentSession() are normalised to a
   * canonical role; sealSession() stores whatever it is given verbatim.
   */
  role: Role;
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
