/**
 * The public origin this deployment is served from.
 *
 * Every absolute link that leaves the process — tracking links, image sources in
 * email, the preference page, and the RFC 8058 one-click unsubscribe endpoint —
 * is built from here, so it must be defined exactly once. It previously existed
 * as two independent constants with different trailing-slash handling, which is
 * this repo's recurring "written twice, diverged" defect.
 */

const FALLBACK_ORIGIN = "https://hopeforstrays.org";

/** Normalised, no trailing slash. */
export const APP_BASE_URL = (process.env.NEXT_PUBLIC_APP_URL || FALLBACK_ORIGIN).replace(
  /\/+$/,
  ""
);

export const isAppUrlConfigured = Boolean(process.env.NEXT_PUBLIC_APP_URL);

/**
 * Joins a path onto the public origin.
 */
export function appUrl(path: string): string {
  return `${APP_BASE_URL}/${String(path).replace(/^\/+/, "")}`;
}

/**
 * Warns once, loudly, when we are about to send real mail containing links built
 * from a guessed origin.
 *
 * `NEXT_PUBLIC_APP_URL` is not set in this project's `.env.local` while
 * `RESEND_API_KEY` is, so on any host other than the hardcoded fallback the
 * one-click unsubscribe URL points somewhere this app does not answer — which is
 * precisely the bulk-sender requirement the feature exists to satisfy — and
 * relative image paths resolve to the wrong host.
 */
let warned = false;
export function warnIfAppUrlUnconfigured(context: string): void {
  if (isAppUrlConfigured || warned) return;
  warned = true;
  console.warn(
    `[App URL] NEXT_PUBLIC_APP_URL is not set; ${context} will use the fallback origin ` +
      `${FALLBACK_ORIGIN}. Unsubscribe and preference links will be dead on any other host.`
  );
}
