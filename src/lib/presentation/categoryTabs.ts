/**
 * Category tab strips, shared by the FAQ and rehabilitation-needs filters.
 *
 * The list is derived on the server — `getServerFaqCategories()` and
 * `getServerRehabCategories()` return only the categories a fixture actually
 * populates — and handed down as a prop. The consuming components are
 * `"use client"` and cannot import those readers to borrow their return type:
 * `tests/unit/layerBoundaries.test.ts` matches import *specifiers*, so even an
 * `import type ... from "@/lib/server/..."` registers as a violation. The shape
 * therefore lives here, in a layer both sides may reach.
 *
 * Both strips used to hardcode their own copy of the list, and both had drifted
 * from the fixture labels they were meant to mirror. That is why this is a
 * module and not a second inline literal.
 */

/**
 * The tab value meaning "no category filter", matching the sentinel the
 * catalogs already accept (`getServerFaqs("all")`) and `faqFilterSchema` /
 * `rehabFilterSchema` already validate.
 */
export const ALL_CATEGORY_VALUE = "all";

/** One entry in a category tab strip. */
export interface CategoryTab {
  value: string;
  labelEn: string;
  labelMs: string;
}

/**
 * A derived category in the shape the server catalogs return it. Declared
 * structurally so both readers' narrower unions — `FaqCategory` and
 * `RehabNeedCategory` — satisfy it without this module importing either.
 */
export interface DerivedCategory {
  category: string;
  labelEn: string;
  labelMs: string;
}

/**
 * Fixture-derived categories as a tab strip, led by the caller's "all" tab.
 *
 * "All" has no fixture row, so no reader can ever produce it and each strip
 * supplies its own. The two are deliberately not interchangeable: the FAQ reads
 * "All Topics" and the wishlist "All Wishlist Items".
 *
 * Defaults to the lone "all" tab when a caller passes nothing, so a page that
 * forgets the prop degrades to a working unfiltered strip rather than an empty
 * row of controls.
 */
export function withAllTab(
  allTab: CategoryTab,
  categories: DerivedCategory[] = []
): CategoryTab[] {
  return [
    allTab,
    ...categories.map(({ category, labelEn, labelMs }) => ({
      value: category,
      labelEn,
      labelMs,
    })),
  ];
}
