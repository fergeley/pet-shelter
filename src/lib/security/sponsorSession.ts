import { cookies } from "next/headers";
import { signPayload, verifySignature } from "./crypto";

/**
 * Sponsor sessions are deliberately a *separate* namespace from the staff session in
 * `./session`.
 *
 * Two reasons this is not just a new role on `SessionUser`:
 *  1. Sharing `hope_shelter_session` would mean a donor cookie and a staff cookie can
 *     never coexist, so a caretaker who donates gets logged out of the admin console.
 *  2. `loginAction` in `@/actions/auth` accepts the literal password "1234" for any
 *     account. Reusing that cookie or that code path would extend a development
 *     backdoor to every sponsor account. `sponsorLoginAction` verifies hashes only.
 */
export const SPONSOR_SESSION_COOKIE_NAME = "hope_sponsor_session";
export const SPONSOR_SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 14; // 14 days

export interface SponsorSession {
  sponsorId: string;
  email: string;
  name: string;
  expiresAt: number;
}

/**
 * Seals a sponsor session into a signed base64url token.
 *
 * The token carries identity only — never the standing. Tier is re-derived from the
 * ledger on every request, so a stale or tampered cookie cannot grant Gold perks.
 */
export function sealSponsorSession(
  sponsor: Omit<SponsorSession, "expiresAt">,
  maxAgeSeconds: number = SPONSOR_SESSION_MAX_AGE_SECONDS
): string {
  const payload: SponsorSession = {
    ...sponsor,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };
  const base64Payload = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${base64Payload}.${signPayload(base64Payload)}`;
}

export function unsealSponsorSession(token: string): SponsorSession | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;

    const [base64Payload, signature] = parts;
    if (!verifySignature(base64Payload, signature)) return null;

    const session: SponsorSession = JSON.parse(
      Buffer.from(base64Payload, "base64url").toString("utf8")
    );

    if (
      typeof session.sponsorId !== "string" ||
      typeof session.email !== "string" ||
      typeof session.expiresAt !== "number"
    ) {
      return null;
    }

    if (Date.now() > session.expiresAt) return null;

    return session;
  } catch {
    return null;
  }
}

export async function setSponsorSessionCookie(
  sponsor: Omit<SponsorSession, "expiresAt">,
  maxAgeSeconds: number = SPONSOR_SESSION_MAX_AGE_SECONDS
): Promise<SponsorSession> {
  const token = sealSponsorSession(sponsor, maxAgeSeconds);
  const cookieStore = await cookies();

  cookieStore.set(SPONSOR_SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: maxAgeSeconds,
  });

  return { ...sponsor, expiresAt: Date.now() + maxAgeSeconds * 1000 };
}

export async function clearSponsorSessionCookie(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SPONSOR_SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getCurrentSponsorSession(): Promise<SponsorSession | null> {
  try {
    const cookieStore = await cookies();
    const cookie = cookieStore.get(SPONSOR_SESSION_COOKIE_NAME);
    if (!cookie?.value) return null;
    return unsealSponsorSession(cookie.value);
  } catch {
    return null;
  }
}
