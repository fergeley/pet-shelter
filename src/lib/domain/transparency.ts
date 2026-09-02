/**
 * Financial transparency domain logic.
 *
 * Every number the public "Where Your Money Goes" page shows is DERIVED here
 * from the expense ledger. Nothing is a hard-coded percentage: the allocation
 * chart, the category totals and the donate-page summary all read the same
 * computation, so they cannot drift apart.
 *
 * Pure module — no Prisma, no React, no server imports. Fully unit-testable.
 */

export const EXPENSE_CATEGORY_KEYS = [
  "MEDICAL",
  "FOOD_NUTRITION",
  "SHELTER_MAINTENANCE",
  "RESCUE_TNRM",
  "STAFF_CARE",
] as const;

export type ExpenseCategoryKey = (typeof EXPENSE_CATEGORY_KEYS)[number];

export interface ExpenseCategoryMeta {
  key: ExpenseCategoryKey;
  /** English display label. */
  label: string;
  /** Bahasa Malaysia display label. */
  labelMs: string;
  blurb: string;
  blurbMs: string;
  /**
   * Categorical chart colours, validated with the data-viz palette checker
   * (adjacent-pair CVD ΔE ≥ 8 and normal-vision ΔE ≥ 15 in both modes).
   * Light-mode slots 3–5 sit below 3:1 against the cream surface, so the
   * chart always ships direct labels plus a table view as the relief.
   */
  color: string;
  colorDark: string;
}

/**
 * Fixed slot order. Colour follows the category, never its rank — filtering or
 * re-sorting must never repaint a category.
 */
export const EXPENSE_CATEGORIES: readonly ExpenseCategoryMeta[] = [
  {
    key: "MEDICAL",
    label: "Veterinary Surgery & Medicine",
    labelMs: "Pembedahan & Perubatan Veterinar",
    blurb:
      "Emergency trauma surgery, spay/neuter operations, core vaccinations and diagnostic lab work.",
    blurbMs:
      "Pembedahan trauma kecemasan, pemandulan, vaksinasi teras dan ujian makmal diagnostik.",
    color: "#2a78d6",
    colorDark: "#3987e5",
  },
  {
    key: "FOOD_NUTRITION",
    label: "Food & Nutrition",
    labelMs: "Makanan & Nutrisi",
    blurb:
      "High-protein kibble, newborn milk replacer and veterinary recovery diets for every resident.",
    blurbMs:
      "Kibble berprotein tinggi, susu gantian anak haiwan dan diet pemulihan veterinar.",
    color: "#eb6834",
    colorDark: "#d95926",
  },
  {
    key: "SHELTER_MAINTENANCE",
    label: "Shelter Rent & Facilities",
    labelMs: "Sewa & Kemudahan Pusat Perlindungan",
    blurb:
      "Sanctuary rent, utilities, kennel repairs, bedding and veterinary-grade sanitation.",
    blurbMs:
      "Sewa pusat perlindungan, utiliti, pembaikan reban, alas tidur dan sanitasi gred veterinar.",
    color: "#1baf7a",
    colorDark: "#199e70",
  },
  {
    key: "RESCUE_TNRM",
    label: "Rescue & TNRM Operations",
    labelMs: "Operasi Menyelamat & TNRM",
    blurb:
      "Humane trapping, colony sterilisation, ear-notching, microchipping and rescue transport.",
    blurbMs:
      "Perangkap berperikemanusiaan, pemandulan koloni, takuk telinga, mikrocip dan pengangkutan.",
    color: "#eda100",
    colorDark: "#c98500",
  },
  {
    key: "STAFF_CARE",
    label: "Caretaker & Volunteer Support",
    labelMs: "Sokongan Penjaga & Sukarelawan",
    blurb:
      "Night-shift caretaker stipends, rabies pre-exposure vaccination and handling certification.",
    blurbMs:
      "Elaun penjaga syif malam, vaksinasi rabies pra-pendedahan dan pensijilan pengendalian.",
    color: "#e87ba4",
    colorDark: "#d55181",
  },
] as const;

const CATEGORY_BY_KEY = new Map<string, ExpenseCategoryMeta>(
  EXPENSE_CATEGORIES.map((c) => [c.key, c])
);

export function getCategoryMeta(key: string): ExpenseCategoryMeta | undefined {
  return CATEGORY_BY_KEY.get(key);
}

export function isExpenseCategory(value: unknown): value is ExpenseCategoryKey {
  return typeof value === "string" && CATEGORY_BY_KEY.has(value);
}

/* -------------------------------------------------------------------------- */
/* Records                                                                     */
/* -------------------------------------------------------------------------- */

export interface ExpenseItemRecord {
  id: string;
  category: ExpenseCategoryKey;
  title: string;
  /** Amount in sen (1/100 MYR). */
  amountSen: number;
  /** ISO-8601 calendar date, "YYYY-MM-DD". */
  date: string;
  vendorOrClinic?: string | null;
  petName?: string | null;
  receiptRef?: string | null;
  isPublished: boolean;
}

export interface FinancialReportRecord {
  id: string;
  year: number;
  /** 1–12 for a monthly statement; null for an annual report. */
  month: number | null;
  title: string;
  fileUrl: string;
  summary?: string | null;
  /** ISO-8601 timestamp. */
  publishedAt: string;
  isPublished: boolean;
}

export interface ImpactStatRecord {
  id: string;
  key: string;
  metricValue: string;
  label: string;
  labelMs?: string | null;
  period: string;
  periodMs?: string | null;
  displayOrder: number;
  isPublished: boolean;
}

export interface AllocationSlice {
  key: ExpenseCategoryKey;
  meta: ExpenseCategoryMeta;
  totalSen: number;
  /** Percentage of the published total, rounded so the set sums to exactly 100. */
  percent: number;
  itemCount: number;
}

export interface TransparencySnapshot {
  expenses: ExpenseItemRecord[];
  reports: FinancialReportRecord[];
  impactStats: ImpactStatRecord[];
  allocation: AllocationSlice[];
  totalSen: number;
  /** ISO date of the most recent published expense, or null when the ledger is empty. */
  lastExpenseDate: string | null;
  /** Where the data came from — surfaced in the admin UI so a fallback is never mistaken for live data. */
  source: "database" | "fallback";
}

/* -------------------------------------------------------------------------- */
/* Money & dates                                                               */
/* -------------------------------------------------------------------------- */

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * True only for a real calendar date in "YYYY-MM-DD" form. The shape check
 * alone would accept 2026-02-31, which would then sort into a month that has
 * no such day.
 */
export function isIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;
  const [y, m, d] = value.split("-").map(Number);
  if (m < 1 || m > 12 || d < 1) return false;
  // Date.UTC normalises overflow, so a round-trip mismatch means the day does
  // not exist in that month.
  const asDate = new Date(Date.UTC(y, m - 1, d));
  return (
    asDate.getUTCFullYear() === y &&
    asDate.getUTCMonth() === m - 1 &&
    asDate.getUTCDate() === d
  );
}

/** Formats sen as Malaysian ringgit, e.g. 145000 -> "RM 1,450". */
export function formatMYR(amountSen: number, opts: { withCents?: boolean } = {}): string {
  const withCents = opts.withCents ?? amountSen % 100 !== 0;
  const ringgit = amountSen / 100;
  const formatted = ringgit.toLocaleString("en-MY", {
    minimumFractionDigits: withCents ? 2 : 0,
    maximumFractionDigits: withCents ? 2 : 0,
  });
  return `RM ${formatted}`;
}

/** Parses a user-typed ringgit amount ("1,450" / "1450.75") into sen. */
export function parseRinggitToSen(input: string): number | null {
  const cleaned = input.replace(/[\s,]/g, "").replace(/^RM/i, "");
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

const MONTHS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const MONTHS_MS = [
  "Januari", "Februari", "Mac", "April", "Mei", "Jun",
  "Julai", "Ogos", "September", "Oktober", "November", "Disember",
];

/** "2026-03-11" -> "March 2026" (or "Mac 2026" in Malay). */
export function formatMonthYear(isoDate: string, isMs = false): string {
  if (!isIsoDate(isoDate)) return isoDate;
  const [y, m] = isoDate.split("-").map(Number);
  const names = isMs ? MONTHS_MS : MONTHS_EN;
  return `${names[m - 1]} ${y}`;
}

/** "2026-03-11" -> "11 March 2026". */
export function formatLongDate(isoDate: string, isMs = false): string {
  if (!isIsoDate(isoDate)) return isoDate;
  const [y, m, d] = isoDate.split("-").map(Number);
  const names = isMs ? MONTHS_MS : MONTHS_EN;
  return `${d} ${names[m - 1]} ${y}`;
}

/** Label for a report row: "August 2026" for monthly, "Annual 2025" otherwise. */
export function formatReportPeriod(
  year: number,
  month: number | null,
  isMs = false
): string {
  if (month && month >= 1 && month <= 12) {
    const names = isMs ? MONTHS_MS : MONTHS_EN;
    return `${names[month - 1]} ${year}`;
  }
  return isMs ? `Tahunan ${year}` : `Annual ${year}`;
}

/* -------------------------------------------------------------------------- */
/* Derivations                                                                 */
/* -------------------------------------------------------------------------- */

/**
 * Rounds percentages so they sum to exactly 100 (largest-remainder method).
 * Naive per-slice rounding produces "99%" or "101%" totals, which on a page
 * whose entire purpose is financial credibility is not a cosmetic problem.
 */
function largestRemainderPercents(values: number[], total: number): number[] {
  if (total <= 0) return values.map(() => 0);

  const exact = values.map((v) => (v / total) * 100);
  const floored = exact.map((v) => Math.floor(v));
  let remaining = 100 - floored.reduce((sum, v) => sum + v, 0);

  const order = exact
    .map((v, i) => ({ i, remainder: v - Math.floor(v) }))
    .sort((a, b) => b.remainder - a.remainder || a.i - b.i);

  const result = [...floored];
  for (let k = 0; k < order.length && remaining > 0; k++) {
    result[order[k].i] += 1;
    remaining -= 1;
  }
  return result;
}

/**
 * Aggregates published expenses into per-category allocation slices, ordered
 * largest-first. Categories with no spend are dropped rather than shown as a
 * zero-width segment the reader cannot hover.
 */
export function computeAllocation(items: ExpenseItemRecord[]): {
  allocation: AllocationSlice[];
  totalSen: number;
} {
  const published = items.filter((i) => i.isPublished);
  const totals = new Map<ExpenseCategoryKey, { totalSen: number; itemCount: number }>();

  for (const item of published) {
    if (!isExpenseCategory(item.category)) continue;
    if (!Number.isFinite(item.amountSen) || item.amountSen <= 0) continue;
    const bucket = totals.get(item.category) ?? { totalSen: 0, itemCount: 0 };
    bucket.totalSen += item.amountSen;
    bucket.itemCount += 1;
    totals.set(item.category, bucket);
  }

  const present = EXPENSE_CATEGORIES.filter((c) => totals.has(c.key));
  const totalSen = [...totals.values()].reduce((sum, b) => sum + b.totalSen, 0);
  const percents = largestRemainderPercents(
    present.map((c) => totals.get(c.key)!.totalSen),
    totalSen
  );

  const allocation: AllocationSlice[] = present
    .map((meta, idx) => ({
      key: meta.key,
      meta,
      totalSen: totals.get(meta.key)!.totalSen,
      percent: percents[idx],
      itemCount: totals.get(meta.key)!.itemCount,
    }))
    .sort((a, b) => b.totalSen - a.totalSen);

  return { allocation, totalSen };
}

/** Published expenses, newest first. ISO dates make the string sort chronological. */
export function sortExpensesNewestFirst(items: ExpenseItemRecord[]): ExpenseItemRecord[] {
  return [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/** Reports newest first: year desc, then month desc with annual reports leading the year. */
export function sortReportsNewestFirst(
  reports: FinancialReportRecord[]
): FinancialReportRecord[] {
  return [...reports].sort(
    (a, b) => b.year - a.year || (b.month ?? 0) - (a.month ?? 0)
  );
}

export function sortImpactStats(stats: ImpactStatRecord[]): ImpactStatRecord[] {
  return [...stats].sort(
    (a, b) => a.displayOrder - b.displayOrder || a.key.localeCompare(b.key)
  );
}

/** Groups a chronological feed under "August 2026" style headings, newest first. */
export function groupExpensesByMonth(
  items: ExpenseItemRecord[],
  isMs = false
): { monthKey: string; monthLabel: string; items: ExpenseItemRecord[]; subtotalSen: number }[] {
  const groups = new Map<string, ExpenseItemRecord[]>();

  for (const item of sortExpensesNewestFirst(items)) {
    const monthKey = item.date.slice(0, 7);
    const bucket = groups.get(monthKey);
    if (bucket) bucket.push(item);
    else groups.set(monthKey, [item]);
  }

  return [...groups.entries()].map(([monthKey, groupItems]) => ({
    monthKey,
    monthLabel: formatMonthYear(`${monthKey}-01`, isMs),
    items: groupItems,
    subtotalSen: groupItems.reduce((sum, i) => sum + i.amountSen, 0),
  }));
}

/**
 * Builds the full snapshot the public page renders. Filtering to published rows
 * happens here, once, so no caller can leak a draft entry.
 */
export function buildSnapshot(input: {
  expenses: ExpenseItemRecord[];
  reports: FinancialReportRecord[];
  impactStats: ImpactStatRecord[];
  source: "database" | "fallback";
}): TransparencySnapshot {
  const expenses = sortExpensesNewestFirst(input.expenses.filter((e) => e.isPublished));
  const { allocation, totalSen } = computeAllocation(expenses);

  return {
    expenses,
    reports: sortReportsNewestFirst(input.reports.filter((r) => r.isPublished)),
    impactStats: sortImpactStats(input.impactStats.filter((s) => s.isPublished)),
    allocation,
    totalSen,
    lastExpenseDate: expenses.length > 0 ? expenses[0].date : null,
    source: input.source,
  };
}
