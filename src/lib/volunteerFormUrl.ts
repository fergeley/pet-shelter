/**
 * Volunteer form URL constants and guards, kept free of any zod import.
 *
 * `validations/settings.ts` builds `shelterSettingsSchema` and
 * `DEFAULT_SHELTER_SETTINGS` at module scope — a side effect bundlers will not
 * tree-shake — and that default object carries the shelter's private
 * `shelterNotificationEmail`. `VolunteerLanding` is a client component on the public
 * `/get-involved` page, so importing these helpers from there would ship zod and that
 * address to every anonymous visitor. They live here instead, and both sides import
 * from this file. Same reasoning as master's `domain/shelterSettingsKeys.ts`.
 */

/**
 * Shipped defaults for the external volunteer Google Form links. These are valid
 * URLs so validation passes out of the box, but they carry a REPLACE_WITH_ marker so
 * `isPlaceholderFormUrl` can keep the public CTA off a dead link until a coordinator
 * configures the real form in /admin/settings.
 *
 * These literals are duplicated as `@default(...)` in prisma/schema.prisma and as
 * SQL `DEFAULT`s in prisma/sql/2026-09-02-add-volunteer-form-urls.sql. All three must
 * agree: `isPlaceholderFormUrl` matches on the REPLACE_WITH_ marker, so a typo in one
 * copy yields a stored value that is not recognised as a placeholder and the public
 * page renders a dead Google Forms link as its primary CTA.
 */
export const DEFAULT_VOLUNTEER_FORM_URL =
  "https://docs.google.com/forms/d/e/REPLACE_WITH_YOUR_FORM_ID/viewform";
export const DEFAULT_VOLUNTEER_FORM_RESPONSES_URL =
  "https://docs.google.com/spreadsheets/d/REPLACE_WITH_YOUR_SHEET_ID/edit";

/** True when a URL is blank or still the unconfigured shipped placeholder. */
export function isPlaceholderFormUrl(url: string | undefined | null): boolean {
  if (!url || !url.trim()) return true;
  return url.includes("REPLACE_WITH_YOUR_FORM_ID") || url.includes("REPLACE_WITH_YOUR_SHEET_ID");
}

/**
 * Only http(s) URLs may reach an `href`. Zod's `z.url()` accepts `javascript:` and
 * `data:` URLs, so admin-supplied links are checked on save and again at render.
 */
export function isSafeExternalUrl(url: string | undefined | null): boolean {
  if (!url || !url.trim()) return false;
  try {
    const protocol = new URL(url.trim()).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * The single predicate for "this URL may be rendered as a link". Every call site —
 * the public page, the admin header shortcut, and the server-side public getter —
 * must use this rather than re-spelling the two clauses, so a future tightening
 * lands everywhere at once.
 */
export function isUsableFormUrl(url: string | undefined | null): boolean {
  return !isPlaceholderFormUrl(url) && isSafeExternalUrl(url);
}
