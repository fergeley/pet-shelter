/**
 * Financial transparency domain logic.
 *
 * Every number the public "Where Your Money Goes" page shows is DERIVED here
 * from the expense ledger. Nothing is a hard-coded percentage: the allocation
 * chart, the donate-page summary and the admin preview all read the same
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
  },
  {
    key: "FOOD_NUTRITION",
    label: "Food & Nutrition",
    labelMs: "Makanan & Nutrisi",
    blurb:
      "High-protein kibble, newborn milk replacer and veterinary recovery diets for every resident.",
    blurbMs:
      "Kibble berprotein tinggi, susu gantian anak haiwan dan diet pemulihan veterinar.",
  },
  {
    key: "SHELTER_MAINTENANCE",
    label: "Shelter Rent & Facilities",
    labelMs: "Sewa & Kemudahan Pusat Perlindungan",
    blurb:
      "Sanctuary rent, utilities, kennel repairs, bedding and veterinary-grade sanitation.",
    blurbMs:
      "Sewa pusat perlindungan, utiliti, pembaikan reban, alas tidur dan sanitasi gred veterinar.",
  },
  {
    key: "RESCUE_TNRM",
    label: "Rescue & TNRM Operations",
    labelMs: "Operasi Menyelamat & TNRM",
    blurb:
      "Humane trapping, colony sterilisation, ear-notching, microchipping and rescue transport.",
    blurbMs:
      "Perangkap berperikemanusiaan, pemandulan koloni, takuk telinga, mikrocip dan pengangkutan.",
  },
  {
    key: "STAFF_CARE",
    label: "Caretaker & Volunteer Support",
    labelMs: "Sokongan Penjaga & Sukarelawan",
    blurb:
      "Night-shift caretaker stipends, rabies pre-exposure vaccination and handling certification.",
    blurbMs:
      "Elaun penjaga syif malam, vaksinasi rabies pra-pendedahan dan pensijilan pengendalian.",
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

/** Per-category aggregate over the WHOLE published ledger. */
export interface CategoryTotal {
  key: ExpenseCategoryKey;
  totalSen: number;
  itemCount: number;
}

export interface AllocationSlice {
  key: ExpenseCategoryKey;
  meta: ExpenseCategoryMeta;
  totalSen: number;
  /** Percentage of the published total, rounded so the set sums to exactly 100. */
  percent: number;
  itemCount: number;
}

/**
 * Where the figures came from.
 *
 * - `database`  — real rows. The only value the public page treats as verified.
 * - `sample`    — the bundled development dataset. NEVER produced in production.
 * - `unavailable` — the ledger could not be read; show an honest empty state
 *   rather than inventing numbers on a page about financial honesty.
 */
export type TransparencySource = "database" | "sample" | "unavailable";

export interface TransparencySnapshot {
  /** A bounded, newest-first window of the ledger — not necessarily every row. */
  expenses: ExpenseItemRecord[];
  reports: FinancialReportRecord[];
  impactStats: ImpactStatRecord[];
  /** Derived from every published row, not just the window above. */
  allocation: AllocationSlice[];
  totalSen: number;
  /** Total published entries in the ledger, which may exceed `expenses.length`. */
  expenseCount: number;
  /** True when the ledger holds more entries than this window carries. */
  hasMoreExpenses: boolean;
  /** ISO date of the most recent published expense, or null when the ledger is empty. */
  lastExpenseDate: string | null;
  source: TransparencySource;
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
  // Date.UTC maps years 0-99 onto 1900+y, which would reject "0026-01-01".
  if (y < 100) asDate.setUTCFullYear(y);
  return (
    asDate.getUTCFullYear() === y &&
    asDate.getUTCMonth() === m - 1 &&
    asDate.getUTCDate() === d
  );
}

/**
 * Formats sen as Malaysian ringgit, e.g. 145000 -> "RM 1,450".
 *
 * Grouping is done by hand rather than with `toLocaleString`, for the same
 * reason `formatTimestampDate` avoids `toLocaleDateString`: these amounts are
 * rendered on the server and hydrated in the browser, and `Intl` output depends
 * on the runtime's ICU data. Identical output on both sides is worth more here
 * than locale flexibility, and the format is fixed anyway.
 */
export function formatMYR(amountSen: number, opts: { withCents?: boolean } = {}): string {
  // `amountSen` is an integer column, but this is exported and reachable from a
  // form field, so a non-integer or NaN must not produce "RM 14.50.5" or
  // "RM NaN.NaN" — splitting whole from cents assumes a whole number of sen.
  if (!Number.isFinite(amountSen)) return "RM 0";
  const sen = Math.round(amountSen);

  const withCents = opts.withCents ?? sen % 100 !== 0;
  const sign = sen < 0 ? "-" : "";
  const abs = Math.abs(sen);

  const whole = withCents ? Math.floor(abs / 100) : Math.round(abs / 100);
  const grouped = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  const body = withCents
    ? `${grouped}.${String(abs % 100).padStart(2, "0")}`
    : grouped;

  return `${sign}RM ${body}`;
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

/**
 * Formats the calendar date of an ISO timestamp, in UTC.
 *
 * Deliberately does NOT use `new Date(...).toLocaleDateString()`: that renders
 * in the *runtime's* timezone, so a UTC server and a UTC+8 browser disagree
 * about the day for any timestamp near midnight — which both shows the wrong
 * date and produces a React hydration mismatch.
 */
export function formatTimestampDate(isoTimestamp: string, isMs = false): string {
  const datePart = isoTimestamp.slice(0, 10);
  if (isIsoDate(datePart)) return formatLongDate(datePart, isMs);

  // Not an ISO-8601 string; fall back to a UTC-normalised parse.
  const parsed = new Date(isoTimestamp);
  if (Number.isNaN(parsed.getTime())) return isoTimestamp;
  return formatLongDate(parsed.toISOString().slice(0, 10), isMs);
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
 * Builds allocation slices from per-category aggregates.
 *
 * Kept separate from `computeAllocation` so the database path can aggregate
 * with a `groupBy` over the entire ledger while shipping only a bounded window
 * of rows to the browser. Both paths produce identical figures.
 */
export function allocationFromTotals(totals: CategoryTotal[]): {
  allocation: AllocationSlice[];
  totalSen: number;
  expenseCount: number;
} {
  const byKey = new Map<ExpenseCategoryKey, CategoryTotal>();
  for (const total of totals) {
    if (!isExpenseCategory(total.key)) continue;
    if (!Number.isFinite(total.totalSen) || total.totalSen <= 0) continue;
    byKey.set(total.key, total);
  }

  // Iterate the fixed category order so colour never follows rank.
  const present = EXPENSE_CATEGORIES.filter((c) => byKey.has(c.key));
  const totalSen = [...byKey.values()].reduce((sum, t) => sum + t.totalSen, 0);
  const expenseCount = [...byKey.values()].reduce((sum, t) => sum + t.itemCount, 0);
  const percents = largestRemainderPercents(
    present.map((c) => byKey.get(c.key)!.totalSen),
    totalSen
  );

  const allocation: AllocationSlice[] = present
    .map((meta, idx) => ({
      key: meta.key,
      meta,
      totalSen: byKey.get(meta.key)!.totalSen,
      percent: percents[idx],
      itemCount: byKey.get(meta.key)!.itemCount,
    }))
    .sort((a, b) => b.totalSen - a.totalSen);

  return { allocation, totalSen, expenseCount };
}

/**
 * The single rule for what counts as a public ledger entry.
 *
 * Both the aggregate and the rendered feed must apply it, or the page states two
 * different answers: a row excluded from the totals but listed in the feed makes
 * the month subtotals disagree with the chart, on a page whose whole claim is
 * that its figures reconcile. `amountSen` has no database CHECK constraint, so a
 * legacy row, a manual correction or a refund can be non-positive even though
 * the admin write path rejects one.
 */
export function isCountableExpense(item: ExpenseItemRecord): boolean {
  return (
    item.isPublished &&
    isExpenseCategory(item.category) &&
    Number.isFinite(item.amountSen) &&
    item.amountSen > 0
  );
}

/** Aggregates a full in-memory ledger into per-category totals. */
export function categoryTotalsFromItems(items: ExpenseItemRecord[]): CategoryTotal[] {
  const totals = new Map<ExpenseCategoryKey, CategoryTotal>();

  for (const item of items) {
    if (!isCountableExpense(item)) continue;

    const bucket = totals.get(item.category) ?? {
      key: item.category,
      totalSen: 0,
      itemCount: 0,
    };
    bucket.totalSen += item.amountSen;
    bucket.itemCount += 1;
    totals.set(item.category, bucket);
  }

  return [...totals.values()];
}

/**
 * Aggregates published expenses into per-category allocation slices, ordered
 * largest-first. Categories with no spend are dropped rather than shown as a
 * zero-width segment the reader cannot inspect.
 */
export function computeAllocation(items: ExpenseItemRecord[]): {
  allocation: AllocationSlice[];
  totalSen: number;
  expenseCount: number;
} {
  return allocationFromTotals(categoryTotalsFromItems(items));
}

/** Published expenses, newest first. ISO dates make the string sort chronological. */
export function sortExpensesNewestFirst(items: ExpenseItemRecord[]): ExpenseItemRecord[] {
  return [...items].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

/**
 * Reports newest first: year descending, then month descending with the annual
 * report leading its year.
 *
 * An annual statement is sorted as though it came after December, because it is
 * the summary document for that year and belongs at the top of it. (`?? 0` would
 * have pushed it below every monthly report — the opposite of this comment.)
 */
export function sortReportsNewestFirst(
  reports: FinancialReportRecord[]
): FinancialReportRecord[] {
  const rank = (month: number | null) => month ?? 13;
  return [...reports].sort(
    (a, b) => b.year - a.year || rank(b.month) - rank(a.month) || a.id.localeCompare(b.id)
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
 * Builds the snapshot the public page renders. Filtering to published rows
 * happens here, once, so no caller can leak a draft entry.
 *
 * `totals` may be supplied by a database aggregate covering the entire ledger;
 * when omitted it is computed from `expenses`, which is only correct if that
 * array is the complete ledger.
 */
export function buildSnapshot(input: {
  expenses: ExpenseItemRecord[];
  reports: FinancialReportRecord[];
  impactStats: ImpactStatRecord[];
  source: TransparencySource;
  totals?: CategoryTotal[];
}): TransparencySnapshot {
  // Same predicate as the aggregate, so the feed can never list a row the totals
  // exclude.
  const expenses = sortExpensesNewestFirst(input.expenses.filter(isCountableExpense));
  const { allocation, totalSen, expenseCount } = input.totals
    ? allocationFromTotals(input.totals)
    : computeAllocation(expenses);

  return {
    expenses,
    reports: sortReportsNewestFirst(input.reports.filter((r) => r.isPublished)),
    impactStats: sortImpactStats(input.impactStats.filter((s) => s.isPublished)),
    allocation,
    totalSen,
    expenseCount,
    hasMoreExpenses: expenseCount > expenses.length,
    lastExpenseDate: expenses.length > 0 ? expenses[0].date : null,
    source: input.source,
  };
}

/** The snapshot shown when the ledger cannot be read. Never invents figures. */
export function emptySnapshot(source: TransparencySource): TransparencySnapshot {
  return {
    expenses: [],
    reports: [],
    impactStats: [],
    allocation: [],
    totalSen: 0,
    expenseCount: 0,
    hasMoreExpenses: false,
    lastExpenseDate: null,
    source,
  };
}
