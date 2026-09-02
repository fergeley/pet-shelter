"use server";

import { RehabNeed } from "@/types/rehab";
import { rehabFilterSchema, RehabFilterInput } from "@/lib/validations/rehab";
import { getServerRehabNeedsAsync, findServerRehabNeedById } from "@/lib/server/rehabNeedsCatalog";

/**
 * Server Action: Retrieves rehabilitation house needs with optional category/search filtering.
 */
export async function getRehabNeedsAction(
  filterInput?: string | RehabFilterInput
): Promise<{ success: boolean; data?: RehabNeed[]; error?: string }> {
  try {
    const rawFilter = typeof filterInput === "string" ? { category: filterInput } : filterInput;
    const validated = rehabFilterSchema.parse(rawFilter);
    const needs = await getServerRehabNeedsAsync(validated);
    return { success: true, data: needs };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch rehabilitation needs";
    return { success: false, error: msg };
  }
}

/**
 * Alias for getRehabNeedsAction
 */
export async function fetchRehabNeedsAction(
  filterInput?: string | RehabFilterInput
): Promise<{ success: boolean; data?: RehabNeed[]; error?: string }> {
  return getRehabNeedsAction(filterInput);
}

/**
 * Server Action: Retrieves a single rehabilitation need by ID.
 */
export async function getRehabNeedByIdAction(
  id: string
): Promise<{ success: boolean; data?: RehabNeed; error?: string }> {
  try {
    if (!id || typeof id !== "string" || id.trim() === "") {
      return { success: false, error: "Valid need ID is required" };
    }
    const need = findServerRehabNeedById(id);
    if (!need) {
      return { success: false, error: "Rehabilitation need not found" };
    }
    return { success: true, data: need };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch rehabilitation need";
    return { success: false, error: msg };
  }
}
