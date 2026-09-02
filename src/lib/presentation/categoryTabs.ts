import { FaqCategory } from "@/types/faq";
import { RehabNeedCategory } from "@/types/rehab";

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
 *
 * It is also the single source of the category labels themselves. They were
 * briefly authored three times — here and once in each catalog — which is the
 * same duplication in a new place, one rename away from the drift it replaced.
 * Both catalogs import the tables below; nothing else declares them.
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

/** The two label languages every category carries. */
export interface CategoryLabels {
  labelEn: string;
  labelMs: string;
}

/**
 * Canonical bilingual labels for FAQ categories.
 *
 * Keyed by `FaqCategory` rather than `string`: an eighth member of that union
 * is then a compile error here, instead of a category that silently renders as
 * its own raw enum value.
 */
export const FAQ_CATEGORY_LABELS: Record<FaqCategory, CategoryLabels> = {
  tnrm: { labelEn: "TNRM & Coexistence", labelMs: "TNRM & Kewujudan Bersama" },
  sponsorship: { labelEn: "Sponsorship & Donations", labelMs: "Penajaan & Sumbangan" },
  adoption: { labelEn: "Adoption & Fostering", labelMs: "Adopsi & Asuhan" },
  visiting: { labelEn: "Visiting & Shelter Guidelines", labelMs: "Lawatan & Garis Panduan" },
  get_involved: { labelEn: "Get Involved & CSR", labelMs: "Penglibatan & CSR" },
  general: { labelEn: "General Inquiries", labelMs: "Pertanyaan Umum" },
  medical: { labelEn: "Medical & Rehabilitation", labelMs: "Perubatan & Pemulihan" },
};

/** Canonical bilingual labels for rehabilitation-need categories. See above. */
export const REHAB_CATEGORY_LABELS: Record<RehabNeedCategory, CategoryLabels> = {
  URGENT: { labelEn: "Urgent Needs", labelMs: "Keperluan Mendesak" },
  REGULAR: { labelEn: "Regular Needs", labelMs: "Keperluan Rutin" },
  LONG_TERM: { labelEn: "Long-term Improvements", labelMs: "Penambahbaikan Jangka Panjang" },
  TNRM_EQUIPMENT: { labelEn: "TNRM Equipment", labelMs: "Peralatan TNRM" },
  MEDICAL: { labelEn: "Medical Supplies", labelMs: "Bekalan Perubatan" },
  FACILITY: { labelEn: "Facility Maintenance", labelMs: "Penyelenggaraan Kemudahan" },
  NUTRITION: { labelEn: "Nutrition & Feed", labelMs: "Pemakanan & Makanan Haiwan" },
};

/**
 * Localised label for one FAQ item's category.
 *
 * Takes `string` rather than `FaqCategory` because fixture rows are read from
 * JSON: an unrecognised value has to render as *something*, and its own raw
 * value is the most debuggable choice. The widening is confined to this lookup.
 */
export function getFaqCategoryLabel(category: string, isMs = false): string {
  const entry = FAQ_CATEGORY_LABELS[category as FaqCategory] as CategoryLabels | undefined;
  if (!entry) return category;
  return isMs ? entry.labelMs : entry.labelEn;
}

/** Localised label for one rehabilitation need's category. See above. */
export function getRehabNeedCategoryLabel(category: string, isMs = false): string {
  const entry = REHAB_CATEGORY_LABELS[
    category as RehabNeedCategory
  ] as CategoryLabels | undefined;
  if (!entry) return category;
  return isMs ? entry.labelMs : entry.labelEn;
}

