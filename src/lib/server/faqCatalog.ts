import initialFaqsData from "@/data/faqs.json";
import { FaqItem } from "@/types/faq";

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
