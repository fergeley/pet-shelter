/**
 * The bulletin feed's ordering, as pure logic.
 *
 * It lives in the domain layer rather than inside the repository for the reason
 * `planFaqRenumber` does: the repository's database path delegates ordering to
 * Postgres, so the only way to exercise this rule directly is to have it
 * somewhere a test can call with rows of its own choosing. Ties are the case
 * that matters, and the committed fixture has no two notices on one day.
 *
 * It must stay in step with the `orderBy` in `getPublicBulletins` and
 * `listBulletinRecords`. Where they disagree, an outage silently reorders the
 * feed — which is a worse failure than an outage, because nothing reports it.
 */

export interface BulletinOrderable {
  id: string;
  isPinned: boolean;
  /** `YYYY-MM-DD`. */
  publishedAt: string;
  createdAt: string;
}

/**
 * Descending string compare.
 *
 * Plain `>` rather than `localeCompare`: the query orders by the column's
 * Postgres collation, while `localeCompare` uses Node's ICU locale, which
 * treats punctuation as ignorable at the primary level. For lowercase cuids the
 * two agree, but the whole point of this function is to answer the same
 * question the query answers, so it should not depend on that agreement.
 */
function desc(a: string, b: string): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

/**
 * Pinned first, then newest.
 *
 * Every tiebreaker is DESCENDING, and that is the load-bearing detail.
 * `publishedAt` is a calendar day, so two notices posted the same day are
 * ordinary rather than exceptional. An ascending tiebreaker resolves a tied day
 * to the OLDEST notice, so a feed limited to two items would deterministically
 * drop the one written most recently that day — the exact failure a tiebreaker
 * is added to prevent, made permanent instead of intermittent.
 *
 * `createdAt` before `id` because it says what is meant. `id` is last only to
 * make the order total: two rows can share a millisecond.
 */
export function sortBulletinsForFeed<T extends BulletinOrderable>(items: T[]): T[] {
  return [...items].sort((a, b) => {
    if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
    const byDate = desc(a.publishedAt, b.publishedAt);
    if (byDate !== 0) return byDate;
    const byCreated = desc(a.createdAt, b.createdAt);
    if (byCreated !== 0) return byCreated;
    return desc(a.id, b.id);
  });
}

/**
 * The `orderBy` the Prisma reads use, as one declaration.
 *
 * Exported so the repository cannot spell it differently in two places, and so
 * a test can assert the query and `sortBulletinsForFeed` agree rather than
 * checking each against a hand-copied literal.
 */
export const BULLETIN_FEED_ORDER_BY = [
  { isPinned: "desc" },
  { publishedAt: "desc" },
  { createdAt: "desc" },
  { id: "desc" },
] as const;
