import { describe, it, expect } from "vitest";
import { settleWithConcurrency } from "@/lib/concurrency";

describe("settleWithConcurrency", () => {
  it("preserves input order regardless of completion order", async () => {
    const items = [40, 5, 30, 1, 20];

    const results = await settleWithConcurrency(items, 3, async (ms) => {
      await new Promise((resolve) => setTimeout(resolve, ms));
      return ms;
    });

    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual(items);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;

    await settleWithConcurrency(Array.from({ length: 50 }, (_, i) => i), 4, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 2));
      inFlight -= 1;
      return true;
    });

    expect(peak).toBeLessThanOrEqual(4);
    expect(peak).toBeGreaterThan(1);
  });

  it("isolates failures — a rejection does not abort the rest", async () => {
    const results = await settleWithConcurrency([1, 2, 3, 4], 2, async (n) => {
      if (n === 2) throw new Error(`boom ${n}`);
      return n * 10;
    });

    expect(results.map((r) => r.status)).toEqual([
      "fulfilled",
      "rejected",
      "fulfilled",
      "fulfilled",
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(3);
  });

  it("handles an empty list without hanging", async () => {
    await expect(settleWithConcurrency([], 5, async () => 1)).resolves.toEqual([]);
  });

  it("clamps a nonsensical limit rather than spinning or stalling", async () => {
    const results = await settleWithConcurrency([1, 2, 3], 0, async (n) => n);
    expect(results.map((r) => (r.status === "fulfilled" ? r.value : null))).toEqual([1, 2, 3]);
  });
});
