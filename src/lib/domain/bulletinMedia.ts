/**
 * Host allow-lists for bulletin media.
 *
 * A bulletin carries two caller-supplied URLs, and before this module neither
 * was checked. `videoEmbedUrl` is interpolated straight into an `<iframe src>`
 * on `/`, `/pets` and `/bulletins`, so an arbitrary value there is an arbitrary
 * third-party frame on every public page — running its own script, in the
 * shelter's frame, under the shelter's name. `mediaUrl` goes to `next/image`,
 * which refuses any host missing from `next.config.ts` `images.remotePatterns`
 * and answers 400, so an unchecked value is a broken card rather than a hazard.
 *
 * Both are validated on the way in (`bulletinFormSchema`) and again on the way
 * out (`toPublicMediaUrl` / `toPublicEmbedUrl`). The second check is the
 * enforcing one, and it is not redundant: rows reach this table without passing
 * the action. `prisma/seed.ts` inserts fixtures, and
 * `prisma/migrations/manual/20260922_community_bulletins` is applied by hand
 * against a branch this code never sees. A write-time check alone would be a
 * guard on the one path that is already trusted.
 */

/**
 * Hosts `next/image` will load, held in step with the `images.remotePatterns`
 * list in `next.config.ts` by `tests/unit/bulletins.test.ts`. A `*.` prefix
 * matches exactly one label, mirroring how Next reads `**.supabase.co`.
 *
 * Deliberately a copy rather than an import: `next.config.ts` is loaded by the
 * Next build, not by application code, and importing it into `src/` would pull
 * build configuration into the runtime bundle. The test is what keeps the two
 * honest — see "Boundaries and duplication" in AGENTS.md, which asks for a
 * guard when two copies must agree.
 */
export const BULLETIN_IMAGE_HOSTS = [
  "images.unsplash.com",
  "plus.unsplash.com",
  "img.youtube.com",
  "i.ytimg.com",
  "*.supabase.co",
  "utfs.io",
  "res.cloudinary.com",
] as const;

/**
 * Hosts allowed in an `<iframe src>`.
 *
 * Narrower than the image list on purpose: an image host can at worst serve the
 * wrong picture, whereas an embed host runs code. `youtube-nocookie` is first
 * because it is what the shipped fixture uses and what staff should prefer — it
 * does not set tracking cookies on a visitor who never plays the video.
 */
export const BULLETIN_EMBED_HOSTS = [
  "www.youtube-nocookie.com",
  "youtube-nocookie.com",
  "www.youtube.com",
  "youtube.com",
  "player.vimeo.com",
] as const;

function hostMatches(host: string, pattern: string): boolean {
  if (pattern.startsWith("*.")) {
    const suffix = pattern.slice(1); // ".supabase.co"
    if (!host.endsWith(suffix)) return false;
    // Exactly one label in front, so "evil.com/x.supabase.co" and a bare
    // "supabase.co" both fail rather than inheriting the allowance.
    const label = host.slice(0, -suffix.length);
    return label.length > 0 && !label.includes(".");
  }
  return host === pattern;
}

function isAllowed(url: string, patterns: readonly string[]): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Not an absolute URL. A relative path would be same-origin and therefore
    // safe, but `next/image` and `<iframe>` resolve them differently and no
    // fixture uses one, so the narrow answer is the right one.
    return false;
  }

  // `https:` only. `http:` would be a mixed-content block in the browser, and
  // `javascript:`/`data:` are the reason this function exists at all.
  if (parsed.protocol !== "https:") return false;

  // Credentials in a URL are never legitimate here and confuse host parsing in
  // anything that re-parses the string later.
  if (parsed.username || parsed.password) return false;

  return patterns.some((pattern) => hostMatches(parsed.hostname, pattern));
}

/** True when `next/image` will actually load this URL. */
export function isAllowedBulletinImageUrl(url: string): boolean {
  return isAllowed(url, BULLETIN_IMAGE_HOSTS);
}

/** True when this URL may be placed in an `<iframe src>`. */
export function isAllowedBulletinEmbedUrl(url: string): boolean {
  return isAllowed(url, BULLETIN_EMBED_HOSTS);
}

/**
 * The image URL a public card may render, or `undefined`.
 *
 * Returning `undefined` rather than throwing is deliberate: a bulletin whose
 * picture is on an unknown host should still publish its words. A throw here
 * would take down the whole feed — every page that renders it — over one bad
 * row that an editor could not then reach the admin screen to fix.
 */
export function toPublicMediaUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return isAllowedBulletinImageUrl(url) ? url : undefined;
}

/** The embed URL a public card may frame, or `undefined`. Same reasoning. */
export function toPublicEmbedUrl(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return isAllowedBulletinEmbedUrl(url) ? url : undefined;
}
