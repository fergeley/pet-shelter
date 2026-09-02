import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import committedFaqs from "@/data/faqs.json";
import {
  getPrismaDouble,
  resetPrismaDouble,
  type PrismaDouble,
} from "./support/prismaDouble";

/**
 * Tier 3a — an empty FAQ table must stay empty.
 *
 * `getServerFaqsAsync` falls back to the `src/data/faqs.json` fixture **only**
 * from its `catch`. A successful query returning no rows means staff have
 * unpublished everything, which is an answer, not an outage. An earlier version
 * gated the fallback on `rows.length > 0`, so unpublishing every entry restored
 * all the launch questions — including copy that had been deliberately
 * retracted — and no admin action could empty `/faq`.
 *
 * This is easy to reintroduce, which is why it is pinned here rather than left
 * to review. The wrong shape is next door in `petRepository.getServerPetsAsync`,
 * and `support/prismaDouble.ts` explains its empty-by-default reads in terms of
 * that guard. Someone making the two readers consistent has two nearby
 * precedents pointing the wrong way.
 *
 * Both halves matter. Asserting only that an empty result stays empty would
 * also pass against a reader that had lost its fallback altogether, so the
 * second test proves the fallback still exists.
 */

vi.mock("@/lib/server/prisma", async () => {
  const { createPrismaDouble } = await import("./support/prismaDouble");
  const double = createPrismaDouble();
  return {
    prisma: double,
    default: double,
    disconnectPrisma: vi.fn().mockResolvedValue(undefined),
  };
});

let double: PrismaDouble;
let getServerFaqsAsync: typeof import("@/lib/server/faqRepository")["getServerFaqsAsync"];

beforeAll(async () => {
  double = await getPrismaDouble();
  ({ getServerFaqsAsync } = await import("@/lib/server/faqRepository"));
});

beforeEach(() => {
  resetPrismaDouble(double);
  vi.unstubAllEnvs();
});

describe("an empty FAQ table is an answer, not an outage", () => {
  it("returns nothing when the query succeeds with no rows", async () => {
    double.faq.findMany.mockResolvedValue([]);

    const faqs = await getServerFaqsAsync();

    expect(faqs).toEqual([]);
    // Stated separately: `toEqual([])` already covers it, but this is the
    // assertion that fails loudly with the fixture's own length if the
    // `catch`-only fallback is ever changed back to a count check.
    expect(faqs).toHaveLength(0);
    expect(committedFaqs.length).toBeGreaterThan(0);
  });

  it("still falls back to the fixture when the query fails", async () => {
    // `handlePersistenceError` rethrows under STRICT_PERSISTENCE, which is what
    // `npm run test:integration` sets. The fallback only runs with it off, and
    // `persistenceMode` reads the flag per call precisely so this works on an
    // already-imported module.
    vi.stubEnv("STRICT_PERSISTENCE", "false");
    double.faq.findMany.mockRejectedValue(new Error("connection refused"));

    const faqs = await getServerFaqsAsync();

    expect(faqs).toHaveLength(committedFaqs.length);
    expect(faqs.map((f) => f.id)).toEqual(
      expect.arrayContaining(committedFaqs.map((f) => f.id))
    );
  });

  it("propagates the failure instead of falling back under strict persistence", async () => {
    // The property strict mode exists for: a broken query must not be absorbed
    // and reported as a green read of fixture data.
    vi.stubEnv("STRICT_PERSISTENCE", "true");
    double.faq.findMany.mockRejectedValue(new Error("relation \"faqs\" does not exist"));

    await expect(getServerFaqsAsync()).rejects.toThrow(/faqs/);
  });

  it("filters the rows the database returned rather than the fixture", async () => {
    // Guards the same boundary from the other side: a non-empty result must be
    // the one that reaches the caller, so a reader that ignored the database
    // and always served fixtures would fail here too.
    double.faq.findMany.mockResolvedValue([
      {
        id: "db-only-1",
        category: "general",
        question: "Only in the database?",
        answer: "Yes.",
        questionMs: null,
        answerMs: null,
        displayOrder: 0,
        isPublished: true,
        createdAt: new Date(0),
        updatedAt: new Date(0),
      },
    ]);

    const faqs = await getServerFaqsAsync();

    expect(faqs.map((f) => f.id)).toEqual(["db-only-1"]);
    expect(faqs[0].questionMs).toBe("Only in the database?");
  });
});
