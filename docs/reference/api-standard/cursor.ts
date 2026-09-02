/**
 * Opaque, tamper-evident pagination cursors.
 *
 * The v1 standard said "cursor, never offset" and stopped there, which is not a
 * specification — it is a preference. This is the specification.
 *
 * Why keyset over offset: `OFFSET 10000` makes the database walk 10,000 rows it will
 * discard, so page 200 is 200x the cost of page 1, and a row inserted mid-scan shifts
 * every subsequent page by one — B2B integrators doing a nightly full sync silently
 * skip records. Keyset pagination is O(page size) at any depth and is stable under
 * concurrent inserts.
 *
 * Three properties the cursor must have, none of which are free:
 *
 *  1. **Opaque.** Base64url of a signed payload. If integrators can read it they will
 *     construct it, and then its internals are public API forever.
 *  2. **Signed.** Without a MAC the cursor is an injection vector straight into a
 *     WHERE clause, and a hand-edited cursor can page through another tenant's rows.
 *  3. **Sort-bound.** The cursor records the sort spec it was minted under. Changing
 *     `sort` mid-pagination is then a clean 400 instead of silently corrupt pages —
 *     the failure mode that makes keyset pagination look flaky in production.
 *
 * WebCrypto rather than `node:crypto` so the same code runs on the Node and Edge
 * runtimes; `crypto.subtle.verify` also avoids hand-rolling a constant-time compare.
 */

/** Bumped if the payload shape ever changes; old cursors then fail closed. */
const CURSOR_VERSION = 1;

export interface CursorPayload {
  /** Schema version. */
  v: number;
  /** Sort key values of the last row of the previous page, in sort order. */
  k: (string | number | null)[];
  /** Unique tiebreaker — the opaque id of that last row. */
  id: string;
  /** Fingerprint of the sort spec this cursor was minted under. */
  s: string;
}

export type CursorFailure = "malformed" | "bad_signature" | "wrong_version";

export type CursorResult =
  | { ok: true; value: CursorPayload }
  | { ok: false; reason: CursorFailure };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64UrlToBytes(value: string): Uint8Array | null {
  try {
    const padded = value.replace(/-/g, "+").replace(/_/g, "/");
    const binary = atob(padded + "=".repeat((4 - (padded.length % 4)) % 4));
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

async function hmacKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret) as unknown as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

/**
 * Stable fingerprint of a sort spec. Two requests with the same ordering produce the
 * same fingerprint, so a cursor is portable across identical queries but not across
 * a re-sorted one.
 */
export function sortFingerprint(terms: readonly { field: string; dir: string }[]): string {
  return terms.map((t) => `${t.field}:${t.dir}`).join(",");
}

/** Mints a signed cursor for the last row of a page. */
export async function encodeCursor(
  payload: Omit<CursorPayload, "v">,
  secret: string
): Promise<string> {
  const body = bytesToBase64Url(
    encoder.encode(JSON.stringify({ v: CURSOR_VERSION, ...payload }))
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret),
    encoder.encode(body) as unknown as ArrayBuffer
  );
  return `${body}.${bytesToBase64Url(new Uint8Array(signature))}`;
}

/**
 * Verifies and decodes a cursor. Fails closed on every anomaly — the caller turns any
 * failure into a 400 `cursor_invalid` and never falls back to "just start from page 1",
 * which would silently restart a customer's sync loop.
 */
export async function decodeCursor(token: string, secret: string): Promise<CursorResult> {
  const separator = token.lastIndexOf(".");
  if (separator <= 0 || separator === token.length - 1) {
    return { ok: false, reason: "malformed" };
  }

  const body = token.slice(0, separator);
  const signatureBytes = base64UrlToBytes(token.slice(separator + 1));
  if (!signatureBytes) return { ok: false, reason: "malformed" };

  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(secret),
    signatureBytes as unknown as ArrayBuffer,
    encoder.encode(body) as unknown as ArrayBuffer
  );
  if (!valid) return { ok: false, reason: "bad_signature" };

  const bodyBytes = base64UrlToBytes(body);
  if (!bodyBytes) return { ok: false, reason: "malformed" };

  let parsed: unknown;
  try {
    parsed = JSON.parse(decoder.decode(bodyBytes));
  } catch {
    return { ok: false, reason: "malformed" };
  }

  if (!isCursorPayload(parsed)) return { ok: false, reason: "malformed" };
  if (parsed.v !== CURSOR_VERSION) return { ok: false, reason: "wrong_version" };

  return { ok: true, value: parsed };
}

function isCursorPayload(value: unknown): value is CursorPayload {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.v === "number" &&
    Array.isArray(candidate.k) &&
    typeof candidate.id === "string" &&
    typeof candidate.s === "string"
  );
}
