import { signPayload, verifySignature } from "@/lib/security/crypto";

/**
 * Signed, self-contained tokens that let a donor manage their notification
 * preferences without an account.
 *
 * Donors are never authenticated users on this platform — the `User` model is
 * staff-only — so a bearer token in the email is the only workable mechanism.
 * The token is an HMAC-SHA256 signature (via the repo's existing
 * `signPayload` / `verifySignature`, which compare in constant time) over a
 * payload carrying the email, the purpose, and an expiry. It is deliberately
 * *not* a random opaque ID: there is no server-side token table to leak, revoke
 * or garbage-collect, and the signature makes the address unforgeable.
 *
 * The only capability a token grants is reading and writing the notification
 * flags for the single address it names.
 */

export type NotificationTokenPurpose = "manage" | "unsubscribe";

/** One year. Emails sit in inboxes for a long time; a link that dies in a week is a support burden. */
export const NOTIFICATION_TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000;

interface TokenPayload {
  /** email */
  e: string;
  /** purpose */
  p: NotificationTokenPurpose;
  /** expires at (epoch ms) */
  x: number;
}

function toBase64Url(input: string): string {
  return Buffer.from(input, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromBase64Url(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/**
 * Mints a signed preference token for the given address.
 */
export function createNotificationToken(
  email: string,
  purpose: NotificationTokenPurpose = "manage",
  ttlMs: number = NOTIFICATION_TOKEN_TTL_MS
): string {
  const payload: TokenPayload = {
    e: normalizeEmail(email),
    p: purpose,
    x: Date.now() + ttlMs,
  };

  const encoded = toBase64Url(JSON.stringify(payload));
  return `${encoded}.${signPayload(encoded)}`;
}

export type TokenVerification =
  | { valid: true; email: string; purpose: NotificationTokenPurpose }
  | { valid: false; reason: "malformed" | "bad_signature" | "expired" | "wrong_purpose" };

/**
 * Verifies a token. Signature is checked *before* the payload is trusted, and an
 * `expectedPurpose` mismatch is rejected so an unsubscribe link cannot be
 * replayed against a different capability.
 */
export function verifyNotificationToken(
  token: string | null | undefined,
  expectedPurpose?: NotificationTokenPurpose
): TokenVerification {
  if (!token || typeof token !== "string") {
    return { valid: false, reason: "malformed" };
  }

  const separator = token.lastIndexOf(".");
  if (separator <= 0 || separator === token.length - 1) {
    return { valid: false, reason: "malformed" };
  }

  const encoded = token.slice(0, separator);
  const signature = token.slice(separator + 1);

  if (!verifySignature(encoded, signature)) {
    return { valid: false, reason: "bad_signature" };
  }

  let payload: TokenPayload;
  try {
    payload = JSON.parse(fromBase64Url(encoded)) as TokenPayload;
  } catch {
    return { valid: false, reason: "malformed" };
  }

  if (!payload || typeof payload.e !== "string" || typeof payload.x !== "number") {
    return { valid: false, reason: "malformed" };
  }

  if (Date.now() > payload.x) {
    return { valid: false, reason: "expired" };
  }

  if (expectedPurpose && payload.p !== expectedPurpose) {
    return { valid: false, reason: "wrong_purpose" };
  }

  return { valid: true, email: normalizeEmail(payload.e), purpose: payload.p };
}
