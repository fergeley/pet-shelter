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
 * list in `next.config.ts` by `tests/unit/bulletins.test.ts`. The patterns are
 * written exactly as Next writes them, `**.` included, because the two lists
 * have to mean the same thing and the cheapest way to guarantee that is to
 * spell them the same.
 *
 * `**.` matches one or more leading labels, which is Next's reading. An earlier
 * revision used `*.` and matched exactly one, which was stricter than the
 * config: `abc.storage.supabase.co` was refused by the form while `next/image`
 * would have served it, and the refusal pointed the editor at a config file
 * that did allow it.
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
  "**.supabase.co",
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
export const BULLETIN_EMBED_RULES = [
  { host: "www.youtube-nocookie.com", prefix: "/embed/" },
  { host: "youtube-nocookie.com", prefix: "/embed/" },
  { host: "www.youtube.com", prefix: "/embed/" },
  { host: "youtube.com", prefix: "/embed/" },
  { host: "player.vimeo.com", prefix: "/video/" },
] as const satisfies ReadonlyArray<{ host: string; prefix: string }>;

/**
 * Host names only, for the messages that tell staff what is accepted.
 *
 * `readonly`, because this module is imported by `BulletinFormDialog`, which is
 * a `"use client"` component: a mutable array here ships to the browser bundle
 * where anything could push onto it and change what the form claims is allowed.
 * The enforcing check reads `BULLETIN_EMBED_RULES`, so that would mislead
 * rather than bypass — but a list that is only ever read should say so.
 */
export const BULLETIN_EMBED_HOSTS: readonly string[] = BULLETIN_EMBED_RULES.map(
  (r) => r.host
);

/**
 * Matches a hostname against one `remotePatterns`-style pattern.
 *
 * Both wildcard forms are handled, because `next.config.ts` accepts both and a
 * pattern this function does not recognise would fall through to an exact
 * string comparison that no real hostname can satisfy — refusing every URL on
 * that host, silently, while the config allowed them.
 *
 *   `**.` one or more leading labels  (`a.b.supabase.co` matches)
 *   `*.`  exactly one leading label   (`a.b.supabase.co` does not)
 *
 * In both cases the suffix carries its dot, so the match lands on a label
 * boundary: a bare `supabase.co` and an `evilsupabase.co` both fail.
 */
function hostMatches(host: string, pattern: string): boolean {
  for (const [marker, multi] of [
    ["**.", true],
    ["*.", false],
  ] as const) {
    if (!pattern.startsWith(marker)) continue;
    const suffix = pattern.slice(marker.length - 1); // ".supabase.co"
    if (!host.endsWith(suffix)) return false;
    const head = host.slice(0, -suffix.length);
    if (head.length === 0) return false;
    return multi ? true : !head.includes(".");
  }
  return host === pattern;
}

/** Shared gate: absolute, https, no credentials. Host and path are the caller's. */
function parseSafeUrl(url: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Not an absolute URL. A relative path would be same-origin and therefore
    // safe, but `next/image` and `<iframe>` resolve them differently and no
    // fixture uses one, so the narrow answer is the right one.
    return null;
  }

  // `https:` only. `http:` would be a mixed-content block in the browser, and
  // `javascript:`/`data:` are the reason this function exists at all.
  if (parsed.protocol !== "https:") return null;

  // Credentials in a URL are never legitimate here and confuse host parsing in
  // anything that re-parses the string later.
  if (parsed.username || parsed.password) return null;

  return parsed;
}

/** True when `next/image` will actually load this URL. */
export function isAllowedBulletinImageUrl(url: string): boolean {
  const parsed = parseSafeUrl(url);
  if (!parsed) return false;
  return BULLETIN_IMAGE_HOSTS.some((pattern) => hostMatches(parsed.hostname, pattern));
}

/**
 * True when this URL may be placed in an `<iframe src>`.
 *
 * The **path** is checked as well as the host, which the image list does not
 * need to do. `https://www.youtube.com/watch?v=…` is on an allowed host and is
 * not embeddable: YouTube serves `/watch` with `X-Frame-Options: SAMEORIGIN`,
 * so it validates cleanly and then renders as an unexplained black box on `/`,
 * `/pets` and `/bulletins`. The form already tells staff to use the embed link
 * rather than the page link; this is that sentence enforced.
 */
export function isAllowedBulletinEmbedUrl(url: string): boolean {
  const parsed = parseSafeUrl(url);
  if (!parsed) return false;
  return BULLETIN_EMBED_RULES.some(
    // Through `hostMatches`, not `===`, so an embed host may carry a wildcard
    // on the same terms as an image host if one is ever added.
    (rule) => hostMatches(parsed.hostname, rule.host) && parsed.pathname.startsWith(rule.prefix)
  );
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
