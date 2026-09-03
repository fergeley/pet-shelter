import type { ExpenseCategoryKey } from "@/lib/domain/transparency";

/**
 * Chart colour for one expense category.
 *
 * The palette lives in `src/app/globals.css` as `--expense-*` tokens, alongside
 * every other colour in the system, so it flips with `.dark` exactly like the
 * rest of the theme — no `<style>` block, no scope class, and no hex in a
 * TypeScript file (see `tests/unit/designSystemGuards.test.ts`).
 *
 * These five are categorical: they carry IDENTITY, not state, so they are
 * deliberately NOT drawn from the semantic tones — a spending category is never
 * "success" or "warning". Their order is a colourblind-safety property rather
 * than a cosmetic one; see the comment on the tokens themselves.
 */
const TOKEN_BY_CATEGORY: Record<ExpenseCategoryKey, string> = {
  MEDICAL: "--expense-medical",
  FOOD_NUTRITION: "--expense-food",
  SHELTER_MAINTENANCE: "--expense-shelter",
  RESCUE_TNRM: "--expense-rescue",
  STAFF_CARE: "--expense-staff",
};

/** `var(--expense-…)` for a category, for use in an inline `style`. */
export function categoryVar(key: string): string {
  const token = TOKEN_BY_CATEGORY[key as ExpenseCategoryKey];
  // An unknown category should not paint a random colour; fall back to the
  // neutral border token so a stray row is visibly unstyled rather than wrong.
  return `var(${token ?? "--color-border"})`;
}
