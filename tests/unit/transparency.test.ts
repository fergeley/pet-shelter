import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  EXPENSE_CATEGORIES,
  ExpenseItemRecord,
  buildSnapshot,
  computeAllocation,
  formatLongDate,
  formatMYR,
  formatMonthYear,
  formatReportPeriod,
  getCategoryMeta,
  groupExpensesByMonth,
  isExpenseCategory,
  isIsoDate,
  parseRinggitToSen,
  sortExpensesNewestFirst,
  sortReportsNewestFirst,
} from "@/lib/domain/transparency";
import {
  expenseItemSchema,
  financialReportSchema,
  impactStatSchema,
} from "@/lib/validations/transparency";
import baseline from "@/data/transparency.json";

/**
 * `DATABASE_URL` in this project points at a Neon PRODUCTION branch, so the
 * Prisma client is mocked to reject on every call. That keeps the suite on the
 * in-memory fallback path and makes it impossible for a test to write to a live
 * database.
 */
vi.mock("@/lib/prisma", () => {
  const reject = () => Promise.reject(new Error("database unavailable (test)"));
  const model = {
    findMany: reject,
    create: reject,
    update: reject,
    upsert: reject,
    delete: reject,
  };
  return {
    prisma: {
      expenseItem: model,
      financialReport: model,
      impactStat: model,
      auditLog: { create: () => ({ catch: () => undefined }) },
    },
  };
});

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const sessionMock = vi.hoisted(() => ({
  getCurrentSession: vi.fn(),
}));

vi.mock("@/lib/security/session", () => sessionMock);

function expense(
  overrides: Partial<ExpenseItemRecord> & Pick<ExpenseItemRecord, "id">
): ExpenseItemRecord {
  return {
    category: "MEDICAL",
    title: "Test expense",
    amountSen: 10000,
    date: "2026-01-01",
    vendorOrClinic: null,
    petName: null,
    receiptRef: null,
    isPublished: true,
    ...overrides,
  };
}

describe("Transparency domain - dates", () => {
  it("accepts a real ISO calendar date", () => {
    expect(isIsoDate("2026-08-14")).toBe(true);
    expect(isIsoDate("2024-02-29")).toBe(true); // leap year
  });

  it("rejects malformed and impossible dates", () => {
    expect(isIsoDate("14/08/2026")).toBe(false);
    expect(isIsoDate("March 2026")).toBe(false);
    expect(isIsoDate("2026-8-14")).toBe(false);
    expect(isIsoDate("2026-02-31")).toBe(false); // shape-valid, calendar-invalid
    expect(isIsoDate("2025-02-29")).toBe(false); // not a leap year
    expect(isIsoDate("2026-13-01")).toBe(false);
  });

  it("formats month and long dates in both languages", () => {
    expect(formatMonthYear("2026-03-11")).toBe("March 2026");
    expect(formatMonthYear("2026-03-11", true)).toBe("Mac 2026");
    expect(formatLongDate("2026-08-14")).toBe("14 August 2026");
    expect(formatLongDate("2026-08-14", true)).toBe("14 Ogos 2026");
  });

  it("labels report periods by month or annual", () => {
    expect(formatReportPeriod(2026, 8)).toBe("August 2026");
    expect(formatReportPeriod(2025, null)).toBe("Annual 2025");
    expect(formatReportPeriod(2025, null, true)).toBe("Tahunan 2025");
  });
});

describe("Transparency domain - money", () => {
  it("formats sen as ringgit with thousands separators", () => {
    expect(formatMYR(145000)).toBe("RM 1,450");
    expect(formatMYR(0)).toBe("RM 0");
    expect(formatMYR(10000000)).toBe("RM 100,000");
  });

  it("shows cents only when the amount is not whole ringgit", () => {
    expect(formatMYR(145075)).toBe("RM 1,450.75");
    expect(formatMYR(145000, { withCents: true })).toBe("RM 1,450.00");
  });

  it("parses typed ringgit amounts into integer sen", () => {
    expect(parseRinggitToSen("1450")).toBe(145000);
    expect(parseRinggitToSen("1,450.75")).toBe(145075);
    expect(parseRinggitToSen("RM 1450")).toBe(145000);
    expect(parseRinggitToSen(" 12.5 ")).toBe(1250);
  });

  it("rejects amounts it cannot parse rather than guessing", () => {
    expect(parseRinggitToSen("about a thousand")).toBeNull();
    expect(parseRinggitToSen("1450.755")).toBeNull();
    expect(parseRinggitToSen("")).toBeNull();
    expect(parseRinggitToSen("-50")).toBeNull();
  });
});

describe("computeAllocation", () => {
  it("sums per category and orders largest first", () => {
    const { allocation, totalSen } = computeAllocation([
      expense({ id: "a", category: "MEDICAL", amountSen: 4000 }),
      expense({ id: "b", category: "FOOD_NUTRITION", amountSen: 6000 }),
      expense({ id: "c", category: "MEDICAL", amountSen: 1000 }),
    ]);

    expect(totalSen).toBe(11000);
    expect(allocation.map((s) => s.key)).toEqual(["FOOD_NUTRITION", "MEDICAL"]);
    expect(allocation[0].totalSen).toBe(6000);
    expect(allocation[1].totalSen).toBe(5000);
    expect(allocation[1].itemCount).toBe(2);
  });

  it("always produces percentages summing to exactly 100", () => {
    // Three equal thirds: naive rounding gives 33+33+33 = 99.
    const { allocation } = computeAllocation([
      expense({ id: "a", category: "MEDICAL", amountSen: 1000 }),
      expense({ id: "b", category: "FOOD_NUTRITION", amountSen: 1000 }),
      expense({ id: "c", category: "SHELTER_MAINTENANCE", amountSen: 1000 }),
    ]);

    expect(allocation.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
  });

  it("keeps the sum at 100 across many awkward splits", () => {
    const amounts = [
      [1, 1, 1, 1, 1],
      [7, 11, 13, 17, 19],
      [1, 2, 3, 4, 5],
      [999, 1, 1, 1, 1],
      [333, 333, 334],
    ];

    for (const set of amounts) {
      const { allocation } = computeAllocation(
        set.map((amount, idx) =>
          expense({
            id: `x${idx}`,
            category: EXPENSE_CATEGORIES[idx].key,
            amountSen: amount,
          })
        )
      );
      expect(allocation.reduce((sum, s) => sum + s.percent, 0)).toBe(100);
    }
  });

  it("excludes unpublished and non-positive entries", () => {
    const { allocation, totalSen } = computeAllocation([
      expense({ id: "a", category: "MEDICAL", amountSen: 1000 }),
      expense({ id: "b", category: "FOOD_NUTRITION", amountSen: 5000, isPublished: false }),
      expense({ id: "c", category: "STAFF_CARE", amountSen: 0 }),
    ]);

    expect(totalSen).toBe(1000);
    expect(allocation).toHaveLength(1);
    expect(allocation[0].key).toBe("MEDICAL");
  });

  it("returns an empty allocation for an empty ledger instead of dividing by zero", () => {
    const { allocation, totalSen } = computeAllocation([]);
    expect(allocation).toEqual([]);
    expect(totalSen).toBe(0);
  });
});

describe("Ordering and grouping", () => {
  it("sorts expenses newest first using ISO string order", () => {
    const sorted = sortExpensesNewestFirst([
      expense({ id: "a", date: "2026-01-05" }),
      expense({ id: "b", date: "2026-11-02" }),
      expense({ id: "c", date: "2026-02-28" }),
    ]);
    expect(sorted.map((e) => e.id)).toEqual(["b", "c", "a"]);
  });

  it("groups the feed by month, newest month first, with subtotals", () => {
    const groups = groupExpensesByMonth([
      expense({ id: "a", date: "2026-08-14", amountSen: 1000 }),
      expense({ id: "b", date: "2026-08-01", amountSen: 500 }),
      expense({ id: "c", date: "2026-07-03", amountSen: 250 }),
    ]);

    expect(groups.map((g) => g.monthKey)).toEqual(["2026-08", "2026-07"]);
    expect(groups[0].monthLabel).toBe("August 2026");
    expect(groups[0].subtotalSen).toBe(1500);
    expect(groups[1].items).toHaveLength(1);
  });

  it("sorts reports by year then month, annual first within a year", () => {
    const sorted = sortReportsNewestFirst([
      { id: "a", year: 2025, month: null, title: "", fileUrl: "/a.pdf", publishedAt: "", isPublished: true },
      { id: "b", year: 2026, month: 7, title: "", fileUrl: "/b.pdf", publishedAt: "", isPublished: true },
      { id: "c", year: 2026, month: 8, title: "", fileUrl: "/c.pdf", publishedAt: "", isPublished: true },
    ]);
    expect(sorted.map((r) => r.id)).toEqual(["c", "b", "a"]);
  });
});

describe("buildSnapshot", () => {
  it("drops unpublished rows from every collection", () => {
    const snapshot = buildSnapshot({
      expenses: [
        expense({ id: "shown", date: "2026-05-01" }),
        expense({ id: "hidden", date: "2026-06-01", isPublished: false }),
      ],
      reports: [
        { id: "r1", year: 2026, month: null, title: "Shown", fileUrl: "/a.pdf", publishedAt: "", isPublished: true },
        { id: "r2", year: 2026, month: 1, title: "Hidden", fileUrl: "/b.pdf", publishedAt: "", isPublished: false },
      ],
      impactStats: [
        { id: "s1", key: "shown", metricValue: "1", label: "Shown", period: "2026", displayOrder: 1, isPublished: true },
        { id: "s2", key: "hidden", metricValue: "2", label: "Hidden", period: "2026", displayOrder: 2, isPublished: false },
      ],
      source: "fallback",
    });

    expect(snapshot.expenses.map((e) => e.id)).toEqual(["shown"]);
    expect(snapshot.reports.map((r) => r.id)).toEqual(["r1"]);
    expect(snapshot.impactStats.map((s) => s.key)).toEqual(["shown"]);
    expect(snapshot.lastExpenseDate).toBe("2026-05-01");
    expect(snapshot.source).toBe("fallback");
  });
});

describe("Baseline dataset integrity", () => {
  const data = baseline as unknown as {
    expenses: { category: string; date: string; amountSen: number; id: string }[];
    reports: { fileUrl: string; year: number; month: number | null }[];
    impactStats: { key: string }[];
  };

  it("uses only known categories, ISO dates and positive integer amounts", () => {
    for (const item of data.expenses) {
      expect(isExpenseCategory(item.category)).toBe(true);
      expect(isIsoDate(item.date)).toBe(true);
      expect(Number.isInteger(item.amountSen)).toBe(true);
      expect(item.amountSen).toBeGreaterThan(0);
    }
  });

  it("has no duplicate ids or impact-stat keys", () => {
    const ids = data.expenses.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
    const keys = data.impactStats.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("points every report at a site-relative path or https URL", () => {
    for (const report of data.reports) {
      expect(
        report.fileUrl.startsWith("/") || /^https:\/\//.test(report.fileUrl)
      ).toBe(true);
    }
  });

  it("passes its own schema validation", () => {
    for (const item of data.expenses) {
      expect(expenseItemSchema.safeParse(item).success).toBe(true);
    }
  });

  it("produces a documented allocation that sums to 100%", () => {
    const records = data.expenses.map((e) =>
      expense({ ...(e as Partial<ExpenseItemRecord>), id: e.id })
    );
    const { allocation, totalSen } = computeAllocation(records);

    expect(totalSen).toBe(10_000_000); // RM 100,000
    expect(allocation.reduce((sum, s) => sum + s.percent, 0)).toBe(100);

    const byKey = Object.fromEntries(allocation.map((s) => [s.key, s.percent]));
    expect(byKey.MEDICAL).toBe(40);
    expect(byKey.FOOD_NUTRITION).toBe(25);
    expect(byKey.SHELTER_MAINTENANCE).toBe(18);
    expect(byKey.RESCUE_TNRM).toBe(12);
    expect(byKey.STAFF_CARE).toBe(5);
  });
});

describe("Category metadata", () => {
  it("gives every category a bilingual label and a light/dark colour", () => {
    for (const cat of EXPENSE_CATEGORIES) {
      expect(cat.label.length).toBeGreaterThan(0);
      expect(cat.labelMs.length).toBeGreaterThan(0);
      expect(cat.color).toMatch(/^#[0-9a-f]{6}$/i);
      expect(cat.colorDark).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("assigns a distinct colour to every category in both modes", () => {
    const light = EXPENSE_CATEGORIES.map((c) => c.color);
    const dark = EXPENSE_CATEGORIES.map((c) => c.colorDark);
    expect(new Set(light).size).toBe(light.length);
    expect(new Set(dark).size).toBe(dark.length);
  });

  it("looks categories up by key and rejects unknown ones", () => {
    expect(getCategoryMeta("MEDICAL")?.label).toBe("Veterinary Surgery & Medicine");
    expect(getCategoryMeta("CRYPTO_MINING")).toBeUndefined();
    expect(isExpenseCategory("STAFF_CARE")).toBe(true);
    expect(isExpenseCategory("staff_care")).toBe(false);
  });
});

describe("Validation schemas", () => {
  const validExpense = {
    category: "MEDICAL",
    title: "Core vaccines for 20 rescues",
    amountSen: 145000,
    date: "2026-07-22",
  };

  it("accepts a well-formed expense", () => {
    expect(expenseItemSchema.safeParse(validExpense).success).toBe(true);
  });

  it("rejects a non-ISO date, which would break chronological sorting", () => {
    const result = expenseItemSchema.safeParse({ ...validExpense, date: "22 July 2026" });
    expect(result.success).toBe(false);
  });

  it("rejects zero, negative and fractional sen amounts", () => {
    expect(expenseItemSchema.safeParse({ ...validExpense, amountSen: 0 }).success).toBe(false);
    expect(expenseItemSchema.safeParse({ ...validExpense, amountSen: -100 }).success).toBe(false);
    expect(expenseItemSchema.safeParse({ ...validExpense, amountSen: 10.5 }).success).toBe(false);
  });

  it("rejects an unknown category", () => {
    expect(
      expenseItemSchema.safeParse({ ...validExpense, category: "PARTY_FUND" }).success
    ).toBe(false);
  });

  const validReport = {
    year: 2026,
    month: 8,
    title: "Monthly Expenditure Summary",
    fileUrl: "/reports/august.pdf",
    publishedAt: "2026-09-01T00:00:00.000Z",
  };

  it("accepts relative paths and https URLs for report files", () => {
    expect(financialReportSchema.safeParse(validReport).success).toBe(true);
    expect(
      financialReportSchema.safeParse({
        ...validReport,
        fileUrl: "https://example.org/report.pdf",
      }).success
    ).toBe(true);
  });

  it("rejects script-bearing and non-http report links", () => {
    for (const fileUrl of [
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "vbscript:msgbox(1)",
      "reports/relative.pdf",
    ]) {
      expect(financialReportSchema.safeParse({ ...validReport, fileUrl }).success).toBe(false);
    }
  });

  it("rejects an out-of-range month", () => {
    expect(financialReportSchema.safeParse({ ...validReport, month: 13 }).success).toBe(false);
    expect(financialReportSchema.safeParse({ ...validReport, month: 0 }).success).toBe(false);
    expect(financialReportSchema.safeParse({ ...validReport, month: null }).success).toBe(true);
  });

  const validStat = {
    key: "animals_fed_last_month",
    metricValue: "180",
    label: "Animals fed last month",
    period: "August 2026",
  };

  it("accepts a well-formed impact statistic", () => {
    expect(impactStatSchema.safeParse(validStat).success).toBe(true);
  });

  it("rejects keys that are not stable slugs", () => {
    for (const key of ["Animals Fed", "animals-fed", "animals fed", "AF"]) {
      expect(impactStatSchema.safeParse({ ...validStat, key }).success).toBe(false);
    }
  });

  it("allows non-numeric headline values such as percentages", () => {
    expect(impactStatSchema.safeParse({ ...validStat, metricValue: "100%" }).success).toBe(true);
    expect(impactStatSchema.safeParse({ ...validStat, metricValue: "RM 0" }).success).toBe(true);
  });
});

/* -------------------------------------------------------------------------- */
/* Server actions: authorisation and the admin -> public path                  */
/* -------------------------------------------------------------------------- */

const ADMIN = {
  id: "usr-admin-01",
  email: "admin@hopeforstrays.org",
  name: "Admin",
  role: "ADMIN" as const,
  expiresAt: Date.now() + 3_600_000,
};

const COORDINATOR = { ...ADMIN, id: "usr-coord-01", role: "COORDINATOR" as const };
const STAFF = { ...ADMIN, id: "usr-staff-01", role: "STAFF" as const };
const VOLUNTEER = { ...ADMIN, id: "usr-vol-01", role: "VOLUNTEER" as const };

describe("Transparency server actions", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    const store = await import("@/lib/domain/transparencyStore");
    store.resetTransparencyMemory();
  });

  it("serves the public snapshot without a session", async () => {
    sessionMock.getCurrentSession.mockResolvedValue(null);
    const { getTransparencySnapshotAction } = await import("@/actions/transparency");

    const snapshot = await getTransparencySnapshotAction();
    expect(snapshot.expenses.length).toBeGreaterThan(0);
    expect(snapshot.allocation.reduce((n, s) => n + s.percent, 0)).toBe(100);
    expect(snapshot.source).toBe("fallback");
  });

  it("refuses writes from an unauthenticated visitor", async () => {
    sessionMock.getCurrentSession.mockResolvedValue(null);
    const { createExpenseItemAction } = await import("@/actions/transparency");

    const res = await createExpenseItemAction({
      category: "MEDICAL",
      title: "Injected expense",
      amountSen: 100000,
      date: "2026-09-01",
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/sign in|Authentication/i);
  });

  it.each([
    ["STAFF", STAFF],
    ["VOLUNTEER", VOLUNTEER],
  ])("refuses writes from %s", async (_name, user) => {
    sessionMock.getCurrentSession.mockResolvedValue(user);
    const { saveImpactStatAction } = await import("@/actions/transparency");

    const res = await saveImpactStatAction({
      key: "unauthorised_edit",
      metricValue: "999",
      label: "Should not publish",
      period: "2026",
    });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not authorized/i);
  });

  it.each([
    ["ADMIN", ADMIN],
    ["COORDINATOR", COORDINATOR],
  ])("allows %s to edit the ledger", async (_name, user) => {
    sessionMock.getCurrentSession.mockResolvedValue(user);
    const { createExpenseItemAction } = await import("@/actions/transparency");

    const res = await createExpenseItemAction({
      category: "RESCUE_TNRM",
      title: "TNRM sterilisation drive",
      amountSen: 250000,
      date: "2026-09-01",
    });

    expect(res.success).toBe(true);
  });

  it("surfaces an admin impact-stat edit on the public snapshot", async () => {
    sessionMock.getCurrentSession.mockResolvedValue(ADMIN);
    const { saveImpactStatAction, getTransparencySnapshotAction } = await import(
      "@/actions/transparency"
    );

    const before = await getTransparencySnapshotAction();
    expect(
      before.impactStats.find((s) => s.key === "animals_fed_last_month")?.metricValue
    ).toBe("180");

    const saved = await saveImpactStatAction({
      key: "animals_fed_last_month",
      metricValue: "212",
      label: "Animals fed last month",
      labelMs: "Haiwan diberi makan bulan lalu",
      period: "September 2026",
      periodMs: "September 2026",
      displayOrder: 1,
      isPublished: true,
    });
    expect(saved.success).toBe(true);

    const after = await getTransparencySnapshotAction();
    const stat = after.impactStats.find((s) => s.key === "animals_fed_last_month");
    expect(stat?.metricValue).toBe("212");
    expect(stat?.period).toBe("September 2026");

    // Upsert by key must overwrite the card, never append a duplicate.
    expect(
      after.impactStats.filter((s) => s.key === "animals_fed_last_month")
    ).toHaveLength(1);
  });

  it("revalidates every public path that renders ledger figures", async () => {
    sessionMock.getCurrentSession.mockResolvedValue(ADMIN);
    const { revalidatePath } = await import("next/cache");
    const { createExpenseItemAction } = await import("@/actions/transparency");

    await createExpenseItemAction({
      category: "MEDICAL",
      title: "Emergency surgery",
      amountSen: 500000,
      date: "2026-09-02",
    });

    const paths = vi.mocked(revalidatePath).mock.calls.map(([p]) => p);
    expect(paths).toContain("/transparency");
    expect(paths).toContain("/donate");
  });

  it("moves the published allocation when an admin adds an expense", async () => {
    sessionMock.getCurrentSession.mockResolvedValue(ADMIN);
    const { createExpenseItemAction, getTransparencySnapshotAction } = await import(
      "@/actions/transparency"
    );

    const before = await getTransparencySnapshotAction();
    const medicalBefore =
      before.allocation.find((s) => s.key === "MEDICAL")?.percent ?? 0;

    // RM 50,000 of medical spend on top of an RM 100,000 ledger.
    await createExpenseItemAction({
      category: "MEDICAL",
      title: "Major surgical programme",
      amountSen: 5_000_000,
      date: "2026-09-02",
    });

    const after = await getTransparencySnapshotAction();
    const medicalAfter = after.allocation.find((s) => s.key === "MEDICAL")!.percent;

    expect(after.totalSen).toBe(before.totalSen + 5_000_000);
    expect(medicalAfter).toBeGreaterThan(medicalBefore);
    expect(after.allocation.reduce((n, s) => n + s.percent, 0)).toBe(100);
  });

  it("hides an unpublished expense from the public snapshot", async () => {
    sessionMock.getCurrentSession.mockResolvedValue(COORDINATOR);
    const { createExpenseItemAction, getTransparencySnapshotAction } = await import(
      "@/actions/transparency"
    );

    await createExpenseItemAction({
      category: "STAFF_CARE",
      title: "Draft entry pending receipt",
      amountSen: 100000,
      date: "2026-09-02",
      isPublished: false,
    });

    const snapshot = await getTransparencySnapshotAction();
    expect(
      snapshot.expenses.some((e) => e.title === "Draft entry pending receipt")
    ).toBe(false);
  });

  it("rejects an invalid payload even from an authorised editor", async () => {
    sessionMock.getCurrentSession.mockResolvedValue(ADMIN);
    const { createExpenseItemAction } = await import("@/actions/transparency");

    const res = await createExpenseItemAction({
      category: "MEDICAL",
      title: "Bad date entry",
      amountSen: 100000,
      date: "September 2026",
    });

    expect(res.success).toBe(false);
  });
});
