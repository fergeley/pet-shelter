import { RehabNeed, RehabNeedCategory, RehabUrgencyLevel, RehabFilterState } from "@/types/rehab";
import { getServerRehabNeedsAsync, findServerRehabNeedById } from "./server/rehabNeedsCatalog";

export type { RehabNeed, RehabNeedCategory, RehabUrgencyLevel, RehabFilterState };

/**
 * Retrieves all rehabilitation house needs, optionally filtered by category or search term.
 */
export async function getRehabNeeds(filters?: RehabFilterState | string): Promise<RehabNeed[]> {
  return getServerRehabNeedsAsync(filters);
}

/**
 * Finds a single rehabilitation need by its unique ID.
 */
export async function getRehabNeedById(id: string): Promise<RehabNeed | null> {
  return findServerRehabNeedById(id);
}

/**
 * Returns distinct category descriptors present in the dataset.
 */
export async function getRehabCategories(): Promise<
  { category: RehabNeedCategory; labelEn: string; labelMs: string }[]
> {
  const needs = await getServerRehabNeedsAsync();
  const seen = new Set<string>();
  const categories: { category: RehabNeedCategory; labelEn: string; labelMs: string }[] = [];

  for (const item of needs) {
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
