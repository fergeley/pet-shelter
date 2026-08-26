import { describe, it, expect, beforeEach } from "vitest";
import initialFaqs from "@/data/faqs.json";
import {
  faqItemSchema,
  faqFilterSchema,
  faqCategorySchema,
  FAQ_CATEGORIES,
} from "@/lib/validations/faq";
import {
  getFaqs,
  getFaqById,
  getFaqCategories,
} from "@/lib/faqStore";
import {
  getFaqsAction,
  fetchFaqsAction,
  getFaqByIdAction,
} from "@/actions/faqs";
import { resetServerStore, getServerFaqs } from "@/lib/serverStore";

describe("FAQ Data Layer & Server Actions", () => {
  beforeEach(() => {
    resetServerStore();
  });

  describe("Fixture & Schema Validation", () => {
    it("should export defined FAQ category enum constants", () => {
      expect(FAQ_CATEGORIES.length).toBeGreaterThan(0);
      expect(faqCategorySchema.safeParse("tnrm").success).toBe(true);
      expect(faqCategorySchema.safeParse("invalid").success).toBe(false);
    });

    it("should load all 8 committed FAQ fixtures", () => {
      expect(initialFaqs).toBeDefined();
      expect(initialFaqs.length).toBe(8);
    });

    it("should validate all 8 fixture records against faqItemSchema", () => {
      for (const faq of initialFaqs) {
        const result = faqItemSchema.safeParse(faq);
        expect(result.success, `Failed to parse FAQ ${faq.id}: ${JSON.stringify(result)}`).toBe(true);
      }
    });

    it("should reject invalid categories", () => {
      const invalidFaq = {
        ...initialFaqs[0],
        category: "invalid_category",
      };
      const result = faqItemSchema.safeParse(invalidFaq);
      expect(result.success).toBe(false);
    });

    it("should reject missing bilingual fields", () => {
      const invalidFaq = {
        ...initialFaqs[0],
        questionMs: "",
      };
      const result = faqItemSchema.safeParse(invalidFaq);
      expect(result.success).toBe(false);
    });

    it("should parse valid filter input", () => {
      expect(faqFilterSchema.safeParse({ category: "tnrm" }).success).toBe(true);
      expect(faqFilterSchema.safeParse({ category: "all" }).success).toBe(true);
      expect(faqFilterSchema.safeParse({}).success).toBe(true);
      expect(faqFilterSchema.safeParse(undefined).success).toBe(true);
    });
  });

  describe("Bilingual Integrity", () => {
    it("should have non-empty English and Malay text for every FAQ item", () => {
      for (const faq of initialFaqs) {
        expect(faq.question.trim().length).toBeGreaterThan(0);
        expect(faq.questionMs.trim().length).toBeGreaterThan(0);
        expect(faq.answer.trim().length).toBeGreaterThan(0);
        expect(faq.answerMs.trim().length).toBeGreaterThan(0);
        expect(faq.categoryLabel.trim().length).toBeGreaterThan(0);
        expect(faq.categoryLabelMs.trim().length).toBeGreaterThan(0);
      }
    });
  });

  describe("Category Distribution", () => {
    it("should span all primary operational FAQ categories", () => {
      const categories = initialFaqs.map((f) => f.category);
      expect(categories).toContain("tnrm");
      expect(categories).toContain("sponsorship");
      expect(categories).toContain("adoption");
      expect(categories).toContain("visiting");
      expect(categories).toContain("get_involved");

      const tnrmCount = categories.filter((c) => c === "tnrm").length;
      const sponsorshipCount = categories.filter((c) => c === "sponsorship").length;
      const adoptionCount = categories.filter((c) => c === "adoption").length;
      const visitingCount = categories.filter((c) => c === "visiting").length;
      const getInvolvedCount = categories.filter((c) => c === "get_involved").length;

      expect(tnrmCount).toBe(3);
      expect(sponsorshipCount).toBe(2);
      expect(adoptionCount).toBe(1);
      expect(visitingCount).toBe(1);
      expect(getInvolvedCount).toBe(1);
    });
  });

  describe("Store Reader Functions (L-B2)", () => {
    it("should return all FAQs when no category filter is passed", async () => {
      const faqs = await getFaqs();
      expect(faqs.length).toBe(8);
    });

    it("should return all FAQs when category is 'all'", async () => {
      const faqs = await getFaqs("all");
      expect(faqs.length).toBe(8);
    });

    it("should filter FAQs by category (tnrm)", async () => {
      const tnrmFaqs = await getFaqs("tnrm");
      expect(tnrmFaqs.length).toBe(3);
      expect(tnrmFaqs.every((f) => f.category === "tnrm")).toBe(true);
    });

    it("should filter FAQs case-insensitively ('TNRM' -> 'tnrm')", async () => {
      const tnrmFaqs = await getFaqs("TNRM");
      expect(tnrmFaqs.length).toBe(3);
      expect(tnrmFaqs.every((f) => f.category === "tnrm")).toBe(true);
    });

    it("should return empty array for non-existent category", async () => {
      const empty = await getFaqs("nonexistent");
      expect(empty).toEqual([]);
    });

    it("should find an item by id", async () => {
      const item = await getFaqById("faq-001");
      expect(item).toBeDefined();
      expect(item?.id).toBe("faq-001");
      expect(item?.question).toContain("What is TNRM");
    });

    it("should return null when searching for an unknown id", async () => {
      const item = await getFaqById("faq-99999");
      expect(item).toBeNull();
    });

    it("should extract distinct categories with labels via getFaqCategories", async () => {
      const categories = await getFaqCategories();
      expect(categories.length).toBe(5);
      expect(categories.map((c) => c.category)).toEqual([
        "tnrm",
        "sponsorship",
        "adoption",
        "visiting",
        "get_involved",
      ]);
      expect(categories[0].labelEn).toBe("TNRM & Coexistence");
      expect(categories[0].labelMs).toBe("TNRM & Kewujudan Bersama");
    });

    it("should support synchronous store reads via getServerFaqs", () => {
      const faqs = getServerFaqs();
      expect(faqs.length).toBe(8);
      const sponsorship = getServerFaqs("sponsorship");
      expect(sponsorship.length).toBe(2);
    });
  });

  describe("Server Actions (L-B8)", () => {
    it("should return all FAQs successfully via getFaqsAction", async () => {
      const res = await getFaqsAction();
      expect(res.success).toBe(true);
      expect(res.data).toBeDefined();
      expect(res.data?.length).toBe(8);
      expect(res.error).toBeUndefined();
    });

    it("should filter by category in getFaqsAction", async () => {
      const res = await getFaqsAction("sponsorship");
      expect(res.success).toBe(true);
      expect(res.data?.length).toBe(2);
      expect(res.data?.every((f) => f.category === "sponsorship")).toBe(true);
    });

    it("should support alias fetchFaqsAction", async () => {
      const res = await fetchFaqsAction("visiting");
      expect(res.success).toBe(true);
      expect(res.data?.length).toBe(1);
      expect(res.data?.[0].category).toBe("visiting");
    });

    it("should accept object filter with category and search query in getFaqsAction", async () => {
      const res = await getFaqsAction({ category: "tnrm", search: "Vacuum Effect" });
      expect(res.success).toBe(true);
      expect(res.data?.length).toBe(1);
      expect(res.data?.[0].id).toBe("faq-001");
    });

    it("should search across Malay terms in getFaqsAction", async () => {
      const res = await getFaqsAction({ search: "Telinga" });
      expect(res.success).toBe(true);
      expect(res.data?.length).toBe(3);
      expect(res.data?.map((f) => f.id)).toEqual(["faq-001", "faq-002", "faq-003"]);
    });

    it("should treat whitespace category as all items", async () => {
      const res = await getFaqsAction("   ");
      expect(res.success).toBe(true);
      expect(res.data?.length).toBe(8);
    });

    it("should retrieve single item via getFaqByIdAction", async () => {
      const res = await getFaqByIdAction("faq-004");
      expect(res.success).toBe(true);
      expect(res.data?.id).toBe("faq-004");
      expect(res.data?.question).toContain("personal animal sponsorship");
    });

    it("should return error when item is not found in getFaqByIdAction", async () => {
      const res = await getFaqByIdAction("faq-nonexistent");
      expect(res.success).toBe(false);
      expect(res.error).toBe("FAQ not found");
      expect(res.data).toBeUndefined();
    });

    it("should return error for invalid or empty ID in getFaqByIdAction", async () => {
      const res = await getFaqByIdAction("");
      expect(res.success).toBe(false);
      expect(res.error).toBe("Valid FAQ ID is required");
    });
  });
});
