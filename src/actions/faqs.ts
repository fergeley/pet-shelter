"use server";

import { FaqItem } from "@/types/faq";
import { faqFilterSchema, FaqFilterInput } from "@/lib/validations/faq";
import { getServerFaqsAsync, findServerFaqById } from "@/lib/serverStore";

/**
 * Server Action: Retrieves FAQs with optional category/search filtering.
 */
export async function getFaqsAction(
  filterInput?: string | FaqFilterInput
): Promise<{ success: boolean; data?: FaqItem[]; error?: string }> {
  try {
    const rawFilter = typeof filterInput === "string" ? { category: filterInput } : filterInput;
    const validated = faqFilterSchema.parse(rawFilter);
    const faqs = await getServerFaqsAsync(validated);
    return { success: true, data: faqs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch FAQs";
    return { success: false, error: msg };
  }
}

/**
 * Alias for getFaqsAction
 */
export async function fetchFaqsAction(
  filterInput?: string | FaqFilterInput
): Promise<{ success: boolean; data?: FaqItem[]; error?: string }> {
  return getFaqsAction(filterInput);
}

/**
 * Server Action: Retrieves a single FAQ item by ID.
 */
export async function getFaqByIdAction(
  id: string
): Promise<{ success: boolean; data?: FaqItem; error?: string }> {
  try {
    if (!id || typeof id !== "string" || id.trim() === "") {
      return { success: false, error: "Valid FAQ ID is required" };
    }
    const faq = findServerFaqById(id);
    if (!faq) {
      return { success: false, error: "FAQ not found" };
    }
    return { success: true, data: faq };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch FAQ";
    return { success: false, error: msg };
  }
}
