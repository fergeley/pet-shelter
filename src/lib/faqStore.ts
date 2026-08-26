import { FaqItem, FaqCategory, FaqFilterState } from "@/types/faq";
import { getServerFaqsAsync, findServerFaqById } from "./serverStore";

export type { FaqItem, FaqCategory, FaqFilterState };

/**
 * Retrieves all FAQ items, optionally filtered by category or search term.
 */
export async function getFaqs(filters?: FaqFilterState | string): Promise<FaqItem[]> {
  return getServerFaqsAsync(filters);
}

/**
 * Finds a single FAQ item by its unique ID.
 */
export async function getFaqById(id: string): Promise<FaqItem | null> {
  return findServerFaqById(id);
}

/**
 * Returns distinct FAQ category descriptors present in the dataset.
 */
export async function getFaqCategories(): Promise<
  { category: FaqCategory; labelEn: string; labelMs: string }[]
> {
  const faqs = await getServerFaqsAsync();
  const seen = new Set<string>();
  const categories: { category: FaqCategory; labelEn: string; labelMs: string }[] = [];

  for (const item of faqs) {
    if (!seen.has(item.category)) {
      seen.add(item.category);
      categories.push({
        category: item.category,
        labelEn: item.categoryLabel,
        labelMs: item.categoryLabelMs,
      });
    }
  }

  return categories;
}
