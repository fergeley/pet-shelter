import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ImpactStatRecord } from "@/lib/domain/transparency";
import baseline from "@/data/transparency.json";
import {
  formatFigureFrame,
  HOME_METRIC_BASELINE,
  HOME_METRIC_KEYS,
  isHomeMetricKey,
  metricLabel,
  selectHomeMetrics,
  splitFigure,
} from "@/lib/domain/metrics";

/**
 * `DATABASE_URL` points at a Neon PRODUCTION branch, so Prisma is mocked before
 * the repository is imported — no test here may reach a real database.
 */
const prismaMock = vi.hoisted(() => ({
  impactStat: { findMany: vi.fn() },
  expenseItem: { groupBy: vi.fn() },
}));
vi.mock("@/lib/server/prisma", () => ({ prisma: prismaMock }));

/**
 * Tier 1: the home page's metric selection, which is pure and therefore belongs
 * in the node project. The rendering half lives in `tests/components/home.test.tsx`
 * — `vitest.config.mts` runs this project under `environment: "node"` on purpose
 * (the "Server Component / jsdom Trap"), so nothing here may mount a component.
 */

function makeStat(overrides: Partial<ImpactStatRecord> = {}): ImpactStatRecord {
  return {
    id: "stat-test",
    key: "home_animals_neutered",
    metricValue: "999",
    label: "Overridden label",
    labelMs: "Label diganti",
    period: "2026",
    periodMs: "2026",
    displayOrder: 10,
    isPublished: true,
    ...overrides,
  };
}

describe("selectHomeMetrics — fallback states", () => {
  it("returns the five curated figures when the database has no rows", () => {
    const metrics = selectHomeMetrics([]);

    expect(metrics.map((m) => m.value)).toEqual([
      "520+",
      "380+",
      "290+",
      "150+",
      "25+",
    ]);
    expect(metrics.every((m) => m.isLive)).toBe(false);
  });

  it("falls back rather than throwing when the read failed and handed back null", () => {
    // `readAllocationSummary` degrades to a sample/unavailable snapshot instead
    // of raising, so the home page must survive both null and undefined.
    expect(selectHomeMetrics(null)).toHaveLength(5);
    expect(selectHomeMetrics(undefined)).toHaveLength(5);
    expect(selectHomeMetrics(null)[0].value).toBe("520+");
  });

  it("keeps all five slots when only one row exists", () => {
    // The grid must never collapse to a single card because staff published one figure.
    const metrics = selectHomeMetrics([makeStat({ metricValue: "601" })]);

    expect(metrics).toHaveLength(5);
    expect(metrics[0].value).toBe("601");
    expect(metrics[1].value).toBe("380+");
  });
});

describe("selectHomeMetrics — live overrides", () => {
  it("overlays a published row onto its slot and marks it live", () => {
    const [first] = selectHomeMetrics([
      makeStat({ metricValue: "640+", label: "Neutered this decade", labelMs: "Dimandulkan" }),
    ]);

    expect(first.value).toBe("640+");
    expect(first.labelEn).toBe("Neutered this decade");
    expect(first.labelMs).toBe("Dimandulkan");
    expect(first.isLive).toBe(true);
  });

  it("preserves baseline order regardless of the order rows arrive in", () => {
    const metrics = selectHomeMetrics([
      makeStat({ key: "home_collaborations", metricValue: "31+" }),
      makeStat({ key: "home_animals_neutered", metricValue: "640+" }),
    ]);

    expect(metrics.map((m) => m.key)).toEqual(
      HOME_METRIC_BASELINE.map((m) => m.key)
    );
    expect(metrics[0].value).toBe("640+");
    expect(metrics[4].value).toBe("31+");
  });

  it("keeps the curated Malay label when a row supplies only English", () => {
    // `ImpactStat.labelMs` is nullable, and a null there must not blank the
    // Malay site — it must fall through to the curated translation.
    const [first] = selectHomeMetrics([makeStat({ labelMs: null })]);

    expect(first.labelMs).toBe("Dimandulkan (TNRM)");
    expect(first.labelEn).toBe("Overridden label");
  });
});

describe("selectHomeMetrics — rows that must be ignored", () => {
  it("ignores unpublished rows", () => {
    const [first] = selectHomeMetrics([
      makeStat({ metricValue: "1", isPublished: false }),
    ]);

    expect(first.value).toBe("520+");
    expect(first.isLive).toBe(false);
  });

  it("ignores a blank or whitespace-only figure rather than publishing nothing", () => {
    expect(selectHomeMetrics([makeStat({ metricValue: "" })])[0].value).toBe("520+");
    expect(selectHomeMetrics([makeStat({ metricValue: "   " })])[0].value).toBe("520+");
  });

  it("ignores donation-ledger rows that share the ImpactStat table", () => {
    // /donate seeds `animals_fed_last_month`, `surgeries_sponsored` and
    // `tax_receipts_issued`. None may leak into the home grid.
    const metrics = selectHomeMetrics([
      makeStat({ key: "animals_fed_last_month", metricValue: "180" }),
      makeStat({ key: "surgeries_sponsored", metricValue: "42" }),
      makeStat({ key: "tax_receipts_issued", metricValue: "100%" }),
    ]);

    expect(metrics.map((m) => m.value)).toEqual([
      "520+",
      "380+",
      "290+",
      "150+",
      "25+",
    ]);
    expect(metrics.some((m) => m.isLive)).toBe(false);
  });
});

describe("splitFigure", () => {
  it("splits a trailing marker off the digits", () => {
    expect(splitFigure("520+")).toEqual({
      lead: "",
      num: 520,
      trail: "+",
      grouped: false,
    });
    expect(splitFigure("100%")).toEqual({
      lead: "",
      num: 100,
      trail: "%",
      grouped: false,
    });
  });

  it("keeps a leading currency marker out of the number", () => {
    expect(splitFigure("RM 1200")).toEqual({
      lead: "RM ",
      num: 1200,
      trail: "",
      grouped: false,
    });
  });

  it("treats a thousands separator as part of the number, not the suffix", () => {
    // The first version left the comma in `trail`, so "1,250" parsed as 1 and
    // the counter climbed 0..1 with a stray ",250" pinned beside it.
    expect(splitFigure("1,250")).toEqual({
      lead: "",
      num: 1250,
      trail: "",
      grouped: true,
    });
    expect(splitFigure("1,250,000+")).toEqual({
      lead: "",
      num: 1250000,
      trail: "+",
      grouped: true,
    });
  });

  it("returns null for a figure with no digits to count", () => {
    expect(splitFigure("Ongoing")).toBeNull();
    expect(splitFigure("")).toBeNull();
    expect(splitFigure("—")).toBeNull();
  });

  it("parses every figure in the shipped baseline", () => {
    for (const metric of HOME_METRIC_BASELINE) {
      const parsed = splitFigure(metric.value);
      expect(parsed, `${metric.key} → ${metric.value}`).not.toBeNull();
      // The settled frame must reproduce the original exactly, or the counter
      // would land on a number that differs from the published figure.
      expect(formatFigureFrame(parsed!, parsed!.num)).toBe(metric.value);
    }
  });
});

describe("formatFigureFrame", () => {
  it("reproduces the original figure at the final frame", () => {
    for (const value of ["520+", "100%", "RM 1200", "1,250", "1,250,000+"]) {
      const parsed = splitFigure(value)!;
      expect(formatFigureFrame(parsed, parsed.num)).toBe(value);
    }
  });

  it("groups intermediate frames only when the original was grouped", () => {
    const grouped = splitFigure("1,250")!;
    const plain = splitFigure("1250")!;

    expect(formatFigureFrame(grouped, 999)).toBe("999");
    expect(formatFigureFrame(grouped, 1100)).toBe("1,100");
    expect(formatFigureFrame(plain, 1100)).toBe("1100");
  });

  it("never emits a bare separator fragment mid-climb", () => {
    const parsed = splitFigure("1,250")!;
    for (let current = 0; current <= 1250; current += 7) {
      expect(formatFigureFrame(parsed, current)).not.toMatch(/^,|,$/);
    }
  });
});

describe("metricLabel", () => {
  it("selects the language-appropriate label", () => {
    const [first] = selectHomeMetrics([]);

    expect(metricLabel(first, false)).toBe("Neutered via TNRM");
    expect(metricLabel(first, true)).toBe("Dimandulkan (TNRM)");
  });
});

describe("HOME_METRIC_BASELINE", () => {
  it("covers the five FE-02 metrics with distinct keys and both languages", () => {
    expect(HOME_METRIC_BASELINE).toHaveLength(5);
    expect(new Set(HOME_METRIC_BASELINE.map((m) => m.key)).size).toBe(5);

    for (const metric of HOME_METRIC_BASELINE) {
      expect(metric.key.startsWith("home_")).toBe(true);
      expect(metric.labelEn.length).toBeGreaterThan(0);
      expect(metric.labelMs.length).toBeGreaterThan(0);
      expect(metric.labelEn).not.toBe(metric.labelMs);
    }
  });

  it("is not mutated by a caller mutating the returned metrics", () => {
    const metrics = selectHomeMetrics([]);
    metrics[0].value = "0";

    expect(HOME_METRIC_BASELINE[0].value).toBe("520+");
    expect(selectHomeMetrics([])[0].value).toBe("520+");
  });
});

describe("the home namespace inside the shared ImpactStat table", () => {
  beforeEach(() => {
    prismaMock.impactStat.findMany.mockReset();
    prismaMock.expenseItem.groupBy.mockReset();
  });

  it("owns exactly the five baseline keys", () => {
    expect([...HOME_METRIC_KEYS].sort()).toEqual(
      HOME_METRIC_BASELINE.map((m) => m.key).sort()
    );
    expect(isHomeMetricKey("home_animals_neutered")).toBe(true);
    expect(isHomeMetricKey("surgeries_sponsored")).toBe(false);
  });

  it("does not collide with any seeded donation-ledger key", () => {
    // If a ledger key ever equalled a home key the two surfaces would fight
    // over one row, and the subtraction below would blank a ledger figure.
    const ledgerKeys = (
      baseline as { impactStats: { key: string }[] }
    ).impactStats.map((s) => s.key);

    expect(ledgerKeys.length).toBeGreaterThan(0);
    for (const key of ledgerKeys) {
      expect(isHomeMetricKey(key), `ledger key ${key} collides`).toBe(false);
    }
  });

  it("reads only home keys, and runs no expense aggregate to do it", async () => {
    prismaMock.impactStat.findMany.mockResolvedValue([]);
    const { readHomeImpactStats } = await import(
      "@/lib/server/transparencyRepository"
    );

    await readHomeImpactStats();

    const where = prismaMock.impactStat.findMany.mock.calls[0][0].where;
    expect(where.isPublished).toBe(true);
    expect([...where.key.in].sort()).toEqual([...HOME_METRIC_KEYS].sort());
    // The first version went through readAllocationSummary, which also
    // aggregated the whole published expense ledger and discarded the result.
    expect(prismaMock.expenseItem.groupBy).not.toHaveBeenCalled();
  });

  it("excludes home keys from the ledger's own read", async () => {
    // The regression this guards: TransparencyEditor creates a counter at
    // displayOrder 0 while the seeded ledger rows are 1/2/3, so an unfiltered
    // ledger query sorts a home counter first and /donate's slice(0, 3) drops
    // a real donation figure.
    prismaMock.impactStat.findMany.mockResolvedValue([]);
    prismaMock.expenseItem.groupBy.mockResolvedValue([]);
    const { readAllocationSummary } = await import(
      "@/lib/server/transparencyRepository"
    );

    await readAllocationSummary();

    const where = prismaMock.impactStat.findMany.mock.calls[0][0].where;
    expect([...where.key.notIn].sort()).toEqual([...HOME_METRIC_KEYS].sort());
  });

  it("degrades to no override rather than throwing when the read fails", async () => {
    prismaMock.impactStat.findMany.mockRejectedValue(
      Object.assign(new Error("unreachable"), { code: "P1001" })
    );
    const { readHomeImpactStats } = await import(
      "@/lib/server/transparencyRepository"
    );

    const stats = await readHomeImpactStats();

    // Whatever comes back, all five curated figures still render.
    expect(selectHomeMetrics(stats)).toHaveLength(5);
    expect(selectHomeMetrics(stats)[0].value).toBe("520+");
  });
});
