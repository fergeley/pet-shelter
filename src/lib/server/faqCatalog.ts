import initialFaqsData from "@/data/faqs.json";
import { FaqItem, FaqCategory } from "@/types/faq";

/**
 * Bilingual FAQ reads.
 *
 * A *catalog*, not a repository, for the same reason as `./rehabNeedsCatalog`:
 * no Prisma model, no write path, `src/data/faqs.json` is authoritative.
 */

// Deep-cloned for the same reason as the pet cache — see `./petRepository`.
function freshFaqs(): FaqItem[] {
  return structuredClone(initialFaqsData) as FaqItem[];
}

let serverFaqs: FaqItem[] = freshFaqs();

/** Test-only. Reached through `resetServerStore()` in `./fallbackState`. */
export function resetFaqs(): void {
  serverFaqs = freshFaqs();
}

export function getServerFaqs(filters?: string | { category?: string; search?: string }): FaqItem[] {
  let items = [...serverFaqs];
  const category = typeof filters === "string" ? filters : filters?.category;
  const search = typeof filters === "object" ? filters?.search : undefined;

  const trimmedCat = typeof category === "string" ? category.trim() : undefined;
  if (trimmedCat && trimmedCat.toLowerCase() !== "all") {
    const norm = trimmedCat.toLowerCase();
    items = items.filter((f) => f.category.toLowerCase() === norm);
  }

  if (search && search.trim() !== "") {
    const q = search.trim().toLowerCase();
    items = items.filter(
      (f) =>
        f.question.toLowerCase().includes(q) ||
        f.questionMs.toLowerCase().includes(q) ||
        f.answer.toLowerCase().includes(q) ||
        f.answerMs.toLowerCase().includes(q)
    );
  }

  return items;
}

/**
 * Async face of `getServerFaqs`, kept so callers read identically to the pet
 * and application paths. There is no awaited work behind it today.
 */
export async function getServerFaqsAsync(
  filters?: string | { category?: string; search?: string }
): Promise<FaqItem[]> {
  return getServerFaqs(filters);
}

export function findServerFaqById(id: string): FaqItem | null {
  const norm = id.trim().toLowerCase();
  return serverFaqs.find((f) => f.id.toLowerCase() === norm) || null;
}

const FAQ_CATEGORY_DEFINITIONS: Record<FaqCategory, { labelEn: string; labelMs: string }> = {
  tnrm: { labelEn: "TNRM & Coexistence", labelMs: "TNRM & Kewujudan Bersama" },
  sponsorship: { labelEn: "Sponsorship & Donations", labelMs: "Penajaan & Sumbangan" },
  adoption: { labelEn: "Adoption & Fostering", labelMs: "Adopsi & Asuhan" },
  visiting: { labelEn: "Visiting & Shelter Guidelines", labelMs: "Lawatan & Garis Panduan" },
  get_involved: { labelEn: "Get Involved & CSR", labelMs: "Penglibatan & CSR" },
  general: { labelEn: "General Inquiries", labelMs: "Pertanyaan Umum" },
  medical: { labelEn: "Medical & Rehabilitation", labelMs: "Perubatan & Pemulihan" },
};

/**
 * Distinct FAQ categories present in the dataset, in first-appearance order,
 * carrying both label languages derived from canonical category definitions.
 */
export function getServerFaqCategories(): {
  category: FaqCategory;
  labelEn: string;
  labelMs: string;
}[] {
  const seen = new Set<string>();
  const categories: { category: FaqCategory; labelEn: string; labelMs: string }[] = [];

  for (const item of serverFaqs) {
    if (seen.has(item.category)) continue;
    seen.add(item.category);
    const def = FAQ_CATEGORY_DEFINITIONS[item.category];
    if (def) {
      categories.push({
        category: item.category,
        labelEn: def.labelEn,
        labelMs: def.labelMs,
      });
    }
  }

  return categories;
}
