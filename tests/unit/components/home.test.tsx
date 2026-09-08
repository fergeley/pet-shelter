import { describe, it, expect } from "vitest";
import type { ImpactStatRecord } from "@/lib/domain/transparency";
import {
  HOME_METRIC_BASELINE,
  metricLabel,
  selectHomeMetrics,
} from "@/lib/domain/metrics";

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
