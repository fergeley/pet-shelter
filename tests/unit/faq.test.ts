import { describe, it, expect } from "vitest";
import {
  FAQ_CATEGORIES,
  FAQ_CATEGORY_VALUES,
  FAQ_SEED_CONTENT,
  FaqEntry,
  countFaqsByCategory,
  faqCategoryLabel,
  faqMatchesQuery,
  filterFaqs,
  getFallbackFaqs,
  getFaqCategoryMeta,
  groupFaqsByCategory,
  planFaqReorder,
  resolveFaqCopy,
  sortFaqs,
} from "@/lib/domain/faq";
import { faqFormSchema, faqCategoryEnum } from "@/lib/validations/faq";
import type { FaqCategoryValue } from "@/lib/validations/faq";

function makeFaq(overrides: Partial<FaqEntry> & { id: string }): FaqEntry {
  return {
    category: "ADOPTION",
    question: "A question",
    answer: "An answer",
    questionMs: null,
    answerMs: null,
    displayOrder: 0,
    isPublished: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("FAQ category metadata", () => {
  it("exposes exactly the four categories defined by the Prisma enum", () => {
    expect(FAQ_CATEGORY_VALUES).toEqual([
      "ADOPTION",
      "VOLUNTEERING",
      "ANIMAL_CARE",
      "SHELTER_INFO",
    ]);
  });

  it("keeps the metadata list in sync with the zod enum", () => {
    expect([...FAQ_CATEGORY_VALUES].sort()).toEqual([...faqCategoryEnum.options].sort());
  });

  it("returns English and Malay labels, and falls back to the raw value", () => {
    expect(faqCategoryLabel("ADOPTION")).toBe("Adoption");
    expect(faqCategoryLabel("ADOPTION", true)).toBe("Adopsi");
    expect(faqCategoryLabel("NOT_A_CATEGORY" as FaqCategoryValue)).toBe("NOT_A_CATEGORY");
  });

  it("gives every category a non-empty pill label in both languages", () => {
    for (const meta of FAQ_CATEGORIES) {
      expect(meta.pillLabel.length).toBeGreaterThan(0);
      expect(meta.pillLabelMs.length).toBeGreaterThan(0);
      expect(getFaqCategoryMeta(meta.value)).toBe(meta);
    }
  });
});

describe("resolveFaqCopy", () => {
  const bilingual = makeFaq({
    id: "a",
    question: "How much does adoption cost?",
    answer: "Adoption is free.",
    questionMs: "Berapakah kos adopsi?",
    answerMs: "Adopsi adalah percuma.",
  });

  it("returns English copy when the language is English", () => {
    expect(resolveFaqCopy(bilingual, false)).toEqual({
      question: "How much does adoption cost?",
      answer: "Adoption is free.",
    });
  });

  it("returns Malay copy when a translation exists", () => {
    expect(resolveFaqCopy(bilingual, true)).toEqual({
      question: "Berapakah kos adopsi?",
      answer: "Adopsi adalah percuma.",
    });
  });

  it("falls back to English when the Malay translation is missing", () => {
    const untranslated = makeFaq({
      id: "b",
      question: "Where are you?",
      answer: "Petaling Jaya.",
      questionMs: null,
      answerMs: null,
    });

    expect(resolveFaqCopy(untranslated, true)).toEqual({
      question: "Where are you?",
      answer: "Petaling Jaya.",
    });
  });

  it("treats a whitespace-only translation as missing", () => {
    const blank = makeFaq({
      id: "c",
      question: "Question",
      answer: "Answer",
      questionMs: "   ",
      answerMs: "\n\t ",
    });

    expect(resolveFaqCopy(blank, true)).toEqual({
      question: "Question",
      answer: "Answer",
    });
  });

  it("falls back per field, so a half-translated entry still shows Malay where it can", () => {
    const partial = makeFaq({
      id: "d",
      question: "Question",
      answer: "Answer",
      questionMs: "Soalan",
      answerMs: null,
    });

    expect(resolveFaqCopy(partial, true)).toEqual({
      question: "Soalan",
      answer: "Answer",
    });
  });
});

describe("sortFaqs", () => {
  it("orders by displayOrder ascending", () => {
    const entries = [
      makeFaq({ id: "third", displayOrder: 5 }),
      makeFaq({ id: "first", displayOrder: 1 }),
      makeFaq({ id: "second", displayOrder: 3 }),
    ];

    expect(sortFaqs(entries).map((e) => e.id)).toEqual(["first", "second", "third"]);
  });

  it("breaks displayOrder ties on question text so ordering is stable", () => {
    const entries = [
      makeFaq({ id: "b", displayOrder: 0, question: "Bravo" }),
      makeFaq({ id: "a", displayOrder: 0, question: "Alpha" }),
    ];

    expect(sortFaqs(entries).map((e) => e.id)).toEqual(["a", "b"]);
    // Sorting the already-sorted result must not reshuffle it.
    expect(sortFaqs(sortFaqs(entries)).map((e) => e.id)).toEqual(["a", "b"]);
  });

  it("does not mutate the input array", () => {
    const entries = [
      makeFaq({ id: "z", displayOrder: 9 }),
      makeFaq({ id: "y", displayOrder: 1 }),
    ];
    const snapshot = entries.map((e) => e.id);

    sortFaqs(entries);
    expect(entries.map((e) => e.id)).toEqual(snapshot);
  });
});

describe("faqMatchesQuery", () => {
  const entry = makeFaq({
    id: "tnrm",
    question: "What is TNRM?",
    answer: "Trap-Neuter-Release-Manage keeps community cat colonies stable.",
    questionMs: "Apakah itu TNRM?",
    answerMs: "Perangkap-Mandul-Lepas-Urus mengekalkan koloni kucing komuniti.",
  });

  it("matches an empty or whitespace query", () => {
    expect(faqMatchesQuery(entry, "")).toBe(true);
    expect(faqMatchesQuery(entry, "   ")).toBe(true);
  });

  it("matches against the question", () => {
    expect(faqMatchesQuery(entry, "TNRM")).toBe(true);
  });

  it("matches against the answer body", () => {
    expect(faqMatchesQuery(entry, "colonies")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(faqMatchesQuery(entry, "tNrM")).toBe(true);
  });

  it("searches Malay fields even when the visitor is reading English", () => {
    expect(faqMatchesQuery(entry, "Mandul")).toBe(true);
    expect(faqMatchesQuery(entry, "koloni")).toBe(true);
  });

  it("requires every term to match, narrowing rather than widening", () => {
    expect(faqMatchesQuery(entry, "community colonies")).toBe(true);
    expect(faqMatchesQuery(entry, "community elephants")).toBe(false);
  });

  it("allows terms to match across different fields", () => {
    expect(faqMatchesQuery(entry, "TNRM koloni")).toBe(true);
  });

  it("returns false when nothing matches", () => {
    expect(faqMatchesQuery(entry, "microchip")).toBe(false);
  });

  it("ignores extra whitespace between terms", () => {
    expect(faqMatchesQuery(entry, "  TNRM    colonies ")).toBe(true);
  });
});

describe("filterFaqs", () => {
  const entries = [
    makeFaq({
      id: "adopt-fee",
      category: "ADOPTION",
      question: "How much is the adoption fee?",
      answer: "Adoption is free of charge.",
      displayOrder: 1,
    }),
    makeFaq({
      id: "adopt-visit",
      category: "ADOPTION",
      question: "Do you do a home visit?",
      answer: "Yes, after the initial review.",
      displayOrder: 0,
    }),
    makeFaq({
      id: "vol-signup",
      category: "VOLUNTEERING",
      question: "How do I volunteer?",
      answer: "Attend the monthly orientation.",
      displayOrder: 0,
    }),
    makeFaq({
      id: "info-hours",
      category: "SHELTER_INFO",
      question: "What are your visiting hours?",
      answer: "Tuesday to Sunday, 10:00 AM to 5:00 PM.",
      displayOrder: 0,
    }),
  ];

  it("returns everything sorted when no filters are supplied", () => {
    // The three displayOrder-0 entries tie-break alphabetically on their
    // question text ("Do you…" < "How do I…" < "What are…"), then adopt-fee
    // follows at displayOrder 1.
    expect(filterFaqs(entries).map((e) => e.id)).toEqual([
      "adopt-visit",
      "vol-signup",
      "info-hours",
      "adopt-fee",
    ]);
  });

  it("narrows to a single category", () => {
    const result = filterFaqs(entries, { category: "ADOPTION" });
    expect(result.map((e) => e.id)).toEqual(["adopt-visit", "adopt-fee"]);
  });

  it("treats the 'all' category as no category filter", () => {
    expect(filterFaqs(entries, { category: "all" })).toHaveLength(entries.length);
  });

  it("filters on the search query", () => {
    expect(filterFaqs(entries, { search: "visiting hours" }).map((e) => e.id)).toEqual([
      "info-hours",
    ]);
  });

  it("applies category and search together", () => {
    expect(
      filterFaqs(entries, { category: "ADOPTION", search: "free" }).map((e) => e.id)
    ).toEqual(["adopt-fee"]);
  });

  it("returns an empty list when a filter combination matches nothing", () => {
    expect(filterFaqs(entries, { category: "VOLUNTEERING", search: "microchip" })).toEqual(
      []
    );
  });

  it("ignores a whitespace-only search", () => {
    expect(filterFaqs(entries, { search: "   " })).toHaveLength(entries.length);
  });
});

describe("groupFaqsByCategory", () => {
  const entries = [
    makeFaq({ id: "info", category: "SHELTER_INFO" }),
    makeFaq({ id: "adopt-b", category: "ADOPTION", displayOrder: 2 }),
    makeFaq({ id: "adopt-a", category: "ADOPTION", displayOrder: 1 }),
  ];

  it("groups entries under their category in the canonical category order", () => {
    const groups = groupFaqsByCategory(entries);
    expect(groups.map((g) => g.meta.value)).toEqual(["ADOPTION", "SHELTER_INFO"]);
  });

  it("sorts entries within each group", () => {
    const groups = groupFaqsByCategory(entries);
    expect(groups[0].entries.map((e) => e.id)).toEqual(["adopt-a", "adopt-b"]);
  });

  it("drops categories with no entries", () => {
    const values = groupFaqsByCategory(entries).map((g) => g.meta.value);
    expect(values).not.toContain("VOLUNTEERING");
    expect(values).not.toContain("ANIMAL_CARE");
  });

  it("returns nothing for an empty input", () => {
    expect(groupFaqsByCategory([])).toEqual([]);
  });
});

describe("countFaqsByCategory", () => {
  it("counts each category and the overall total", () => {
    const counts = countFaqsByCategory([
      makeFaq({ id: "1", category: "ADOPTION" }),
      makeFaq({ id: "2", category: "ADOPTION" }),
      makeFaq({ id: "3", category: "VOLUNTEERING" }),
    ]);

    expect(counts.all).toBe(3);
    expect(counts.ADOPTION).toBe(2);
    expect(counts.VOLUNTEERING).toBe(1);
    expect(counts.ANIMAL_CARE).toBe(0);
    expect(counts.SHELTER_INFO).toBe(0);
  });

  it("reports zero for every category when empty", () => {
    const counts = countFaqsByCategory([]);
    expect(counts.all).toBe(0);
    for (const value of FAQ_CATEGORY_VALUES) {
      expect(counts[value]).toBe(0);
    }
  });
});

describe("planFaqReorder", () => {
  const entries = [
    makeFaq({ id: "a", category: "ADOPTION", displayOrder: 0, question: "A" }),
    makeFaq({ id: "b", category: "ADOPTION", displayOrder: 1, question: "B" }),
    makeFaq({ id: "c", category: "ADOPTION", displayOrder: 2, question: "C" }),
    makeFaq({ id: "v", category: "VOLUNTEERING", displayOrder: 0, question: "V" }),
  ];

  it("swaps with the previous sibling when moving up", () => {
    const plan = planFaqReorder(entries, "b", "up");
    expect(plan?.moved.id).toBe("b");
    expect(plan?.swappedWith.id).toBe("a");
  });

  it("swaps with the next sibling when moving down", () => {
    const plan = planFaqReorder(entries, "b", "down");
    expect(plan?.moved.id).toBe("b");
    expect(plan?.swappedWith.id).toBe("c");
  });

  it("returns null at the top of a category", () => {
    expect(planFaqReorder(entries, "a", "up")).toBeNull();
  });

  it("returns null at the bottom of a category", () => {
    expect(planFaqReorder(entries, "c", "down")).toBeNull();
  });

  it("returns null for a lone entry in its category", () => {
    expect(planFaqReorder(entries, "v", "up")).toBeNull();
    expect(planFaqReorder(entries, "v", "down")).toBeNull();
  });

  it("never swaps across categories", () => {
    // "c" is last in ADOPTION; the VOLUNTEERING entry must not be picked up.
    expect(planFaqReorder(entries, "c", "down")).toBeNull();
  });

  it("returns null for an unknown id", () => {
    expect(planFaqReorder(entries, "does-not-exist", "up")).toBeNull();
  });

  it("uses sorted position rather than array position", () => {
    const shuffled = [entries[2], entries[0], entries[1]];
    const plan = planFaqReorder(shuffled, "c", "up");
    expect(plan?.swappedWith.id).toBe("b");
  });
});

describe("bundled launch content", () => {
  it("has a unique id for every entry", () => {
    const ids = FAQ_SEED_CONTENT.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("uses only valid categories and covers every one of them", () => {
    const used = new Set(FAQ_SEED_CONTENT.map((f) => f.category));
    for (const value of FAQ_CATEGORY_VALUES) {
      expect(used.has(value)).toBe(true);
    }
    for (const faq of FAQ_SEED_CONTENT) {
      expect(faqCategoryEnum.safeParse(faq.category).success).toBe(true);
    }
  });

  it("ships a Malay translation for every entry", () => {
    for (const faq of FAQ_SEED_CONTENT) {
      expect(faq.questionMs.trim().length).toBeGreaterThan(0);
      expect(faq.answerMs.trim().length).toBeGreaterThan(0);
    }
  });

  it("gives each category a contiguous, duplicate-free display order", () => {
    for (const value of FAQ_CATEGORY_VALUES) {
      const orders = FAQ_SEED_CONTENT.filter((f) => f.category === value)
        .map((f) => f.displayOrder)
        .sort((a, b) => a - b);

      expect(new Set(orders).size).toBe(orders.length);
      expect(orders).toEqual(orders.map((_, i) => i));
    }
  });

  it("satisfies the same validation schema the admin form enforces", () => {
    for (const faq of FAQ_SEED_CONTENT) {
      const result = faqFormSchema.safeParse({
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        questionMs: faq.questionMs,
        answerMs: faq.answerMs,
        displayOrder: faq.displayOrder,
        isPublished: true,
      });
      expect(result.success, `"${faq.question}" failed validation`).toBe(true);
    }
  });

  it("answers the specific topics the shelter was asked to cover", () => {
    const corpus = FAQ_SEED_CONTENT.map(
      (f) => `${f.question} ${f.answer}`
    ).join(" ");

    for (const topic of ["adoption", "home visit", "TNRM", "Petaling Jaya", "surrender"]) {
      expect(
        corpus.toLowerCase().includes(topic.toLowerCase()),
        `launch content never mentions "${topic}"`
      ).toBe(true);
    }
  });
});

describe("getFallbackFaqs", () => {
  it("projects every seed record into a published entry", () => {
    const fallback = getFallbackFaqs();
    expect(fallback).toHaveLength(FAQ_SEED_CONTENT.length);
    expect(fallback.every((f) => f.isPublished)).toBe(true);
  });

  it("serialises timestamps as ISO strings so they cross the server boundary", () => {
    for (const entry of getFallbackFaqs()) {
      expect(typeof entry.createdAt).toBe("string");
      expect(Number.isNaN(Date.parse(entry.createdAt))).toBe(false);
    }
  });

  it("is searchable and filterable exactly like database-backed entries", () => {
    const fallback = getFallbackFaqs();
    const tnrm = filterFaqs(fallback, { category: "ANIMAL_CARE", search: "TNRM" });
    expect(tnrm.length).toBeGreaterThan(0);
    expect(tnrm.every((f) => f.category === "ANIMAL_CARE")).toBe(true);
  });
});

describe("faqFormSchema", () => {
  const valid = {
    category: "ADOPTION" as const,
    question: "How much does adoption cost?",
    answer: "All of our adoptions are completely free of charge.",
    displayOrder: 0,
    isPublished: true,
  };

  it("accepts a well-formed entry", () => {
    expect(faqFormSchema.safeParse(valid).success).toBe(true);
  });

  it("rejects an unknown category", () => {
    expect(
      faqFormSchema.safeParse({ ...valid, category: "PAYROLL" }).success
    ).toBe(false);
  });

  it("rejects a question that is too short", () => {
    expect(faqFormSchema.safeParse({ ...valid, question: "Why?" }).success).toBe(false);
  });

  it("rejects an answer that is too short", () => {
    expect(faqFormSchema.safeParse({ ...valid, answer: "Free." }).success).toBe(false);
  });

  it("rejects a negative display order", () => {
    expect(faqFormSchema.safeParse({ ...valid, displayOrder: -1 }).success).toBe(false);
  });

  it("rejects a fractional display order", () => {
    expect(faqFormSchema.safeParse({ ...valid, displayOrder: 1.5 }).success).toBe(false);
  });

  it("coerces a numeric string from the number input", () => {
    const parsed = faqFormSchema.parse({ ...valid, displayOrder: "7" });
    expect(parsed.displayOrder).toBe(7);
  });

  it("trims surrounding whitespace from the question and answer", () => {
    const parsed = faqFormSchema.parse({
      ...valid,
      question: "   How much does adoption cost?   ",
    });
    expect(parsed.question).toBe("How much does adoption cost?");
  });

  it("normalises a cleared translation field to undefined rather than an empty string", () => {
    const parsed = faqFormSchema.parse({ ...valid, questionMs: "", answerMs: "" });
    expect(parsed.questionMs).toBeUndefined();
    expect(parsed.answerMs).toBeUndefined();
  });

  it("keeps a supplied translation", () => {
    const parsed = faqFormSchema.parse({
      ...valid,
      questionMs: "Berapakah kos adopsi?",
    });
    expect(parsed.questionMs).toBe("Berapakah kos adopsi?");
  });

  it("defaults displayOrder and isPublished when omitted", () => {
    const parsed = faqFormSchema.parse({
      category: "VOLUNTEERING",
      question: "How do I volunteer with the shelter?",
      answer: "Register your interest and attend the monthly orientation.",
    });
    expect(parsed.displayOrder).toBe(0);
    expect(parsed.isPublished).toBe(true);
  });

  it("rejects an over-long question", () => {
    expect(
      faqFormSchema.safeParse({ ...valid, question: "Q".repeat(301) }).success
    ).toBe(false);
  });
});
