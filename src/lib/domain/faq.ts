import { FaqItem } from "@/types/faq";

/**
 * Pure FAQ logic: searching, filtering, ordering and reorder planning.
 *
 * Directive-free and free of Prisma, so both the repository and the client
 * components may import it. The FAQ *content* lives in `src/data/faqs.json`
 * and the category *labels* in `@/lib/presentation/categoryTabs`; neither is
 * restated here.
 */

/**
 * Locale-independent string comparison.
 *
 * `localeCompare` without an explicit locale collates using the runtime's
 * default, which differs between the server and the visitor's browser
 * (plausibly ms-MY for this audience). FAQ lists are ordered on the server for
 * the initial HTML and again on the client while filtering, so a
 * locale-sensitive tiebreak could order two tied entries differently on each
 * side and desync the rendered list. Code-unit order is arbitrary but identical
 * everywhere, which is what "stable" has to mean here.
 */
function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** The minimum an entry needs to be ordered. */
export interface FaqOrderable {
  id: string;
  displayOrder: number;
  question: string;
}

/** `displayOrder` ascending, ties broken deterministically on question text. */
export function sortFaqRecords<T extends FaqOrderable>(records: readonly T[]): T[] {
  return [...records].sort(
    (a, b) => a.displayOrder - b.displayOrder || compareText(a.question, b.question)
  );
}

function normalise(value: string): string {
  return value.toLowerCase().trim();
}

/**
 * True when every whitespace-separated term appears somewhere in the entry.
 *
 * Both languages are searched regardless of the active UI language: a visitor
 * reading the English page who types a Malay term still finds the entry. Terms
 * are ANDed so "adoption fee" narrows the list instead of matching either word.
 */
export function faqMatchesQuery(item: FaqItem, query: string): boolean {
  const q = normalise(query);
  if (!q) return true;

  const haystack = [item.question, item.answer, item.questionMs, item.answerMs]
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map(normalise);

  return q
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => haystack.some((text) => text.includes(term)));
}

export interface FaqFilterOptions {
  /** A category slug, or the "all" sentinel, or nothing. */
  category?: string;
  search?: string;
}

/** Applies the category and search filters. Input order is preserved. */
export function filterFaqItems(
  items: readonly FaqItem[],
  { category, search }: FaqFilterOptions = {}
): FaqItem[] {
  let result = [...items];

  const trimmedCategory = category?.trim();
  if (trimmedCategory && trimmedCategory.toLowerCase() !== "all") {
    const norm = trimmedCategory.toLowerCase();
    result = result.filter((f) => f.category.toLowerCase() === norm);
  }

  if (search && search.trim() !== "") {
    result = result.filter((f) => faqMatchesQuery(f, search));
  }

  return result;
}

/** Per-category counts for filter pills, including the "all" total. */
export function countFaqsByCategory(items: readonly FaqItem[]): Record<string, number> {
  const counts: Record<string, number> = { all: items.length };
  for (const item of items) {
    counts[item.category] = (counts[item.category] ?? 0) + 1;
  }
  return counts;
}

/**
 * Plans moving one entry a single slot up or down among its siblings, returning
 * the rows whose `displayOrder` must change. `null` means it is already at the
 * boundary, or is not in the list.
 *
 * Callers pass one category's entries; this does no filtering of its own so it
 * can be given a narrow projection rather than whole rows.
 *
 * The result renumbers the span contiguously from 0 rather than swapping two
 * values. A swap cannot express a move between two rows that already share a
 * `displayOrder`: nudging the moved row to `neighbour - 1` produces -1 whenever
 * two entries sit at 0, and `faqFormSchema` rejects a negative `displayOrder`,
 * so that row could never be saved from the edit dialog again. Renumbering also
 * heals any pre-existing ties and gaps.
 */
export function planFaqRenumber(
  siblings: readonly FaqOrderable[],
  id: string,
  direction: "up" | "down"
): { id: string; displayOrder: number }[] | null {
  const ordered = sortFaqRecords(siblings);

  const index = ordered.findIndex((e) => e.id === id);
  if (index === -1) return null;

  const neighbourIndex = direction === "up" ? index - 1 : index + 1;
  if (neighbourIndex < 0 || neighbourIndex >= ordered.length) return null;

  [ordered[index], ordered[neighbourIndex]] = [ordered[neighbourIndex], ordered[index]];

  return ordered
    .map((entry, position) => ({ id: entry.id, displayOrder: position }))
    .filter((row, position) => ordered[position].displayOrder !== row.displayOrder);
}
