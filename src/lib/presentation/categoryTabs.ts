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

/** Canonical bilingual labels for FAQ categories. */
export const FAQ_CATEGORY_LABELS: Record<string, { labelEn: string; labelMs: string }> = {
  tnrm: { labelEn: "TNRM & Coexistence", labelMs: "TNRM & Kewujudan Bersama" },
  sponsorship: { labelEn: "Sponsorship & Donations", labelMs: "Penajaan & Sumbangan" },
  adoption: { labelEn: "Adoption & Fostering", labelMs: "Adopsi & Asuhan" },
  visiting: { labelEn: "Visiting & Shelter Guidelines", labelMs: "Lawatan & Garis Panduan" },
  get_involved: { labelEn: "Get Involved & CSR", labelMs: "Penglibatan & CSR" },
  general: { labelEn: "General Inquiries", labelMs: "Pertanyaan Umum" },
  medical: { labelEn: "Medical & Rehabilitation", labelMs: "Perubatan & Pemulihan" },
};

/** Canonical bilingual labels for Rehabilitation Need categories. */
export const REHAB_CATEGORY_LABELS: Record<string, { labelEn: string; labelMs: string }> = {
  URGENT: { labelEn: "Urgent Needs", labelMs: "Keperluan Mendesak" },
  REGULAR: { labelEn: "Regular Needs", labelMs: "Keperluan Rutin" },
  LONG_TERM: { labelEn: "Long-term Improvements", labelMs: "Penambahbaikan Jangka Panjang" },
  TNRM_EQUIPMENT: { labelEn: "TNRM Equipment", labelMs: "Peralatan TNRM" },
  MEDICAL: { labelEn: "Medical Supplies", labelMs: "Bekalan Perubatan" },
  FACILITY: { labelEn: "Facility Maintenance", labelMs: "Penyelenggaraan Kemudahan" },
  NUTRITION: { labelEn: "Nutrition & Feed", labelMs: "Pemakanan & Makanan Haiwan" },
};

/** Resolves localized category label for an FAQ item. */
export function getFaqCategoryLabel(category: string, isMs = false): string {
  const entry = FAQ_CATEGORY_LABELS[category];
  if (!entry) return category;
  return isMs ? entry.labelMs : entry.labelEn;
}

/** Resolves localized category label for a Rehabilitation Need item. */
export function getRehabNeedCategoryLabel(category: string, isMs = false): string {
  const entry = REHAB_CATEGORY_LABELS[category];
  if (!entry) return category;
  return isMs ? entry.labelMs : entry.labelEn;
}

