import { EXPENSE_CATEGORIES } from "@/lib/domain/transparency";

/**
 * CSS custom properties for the categorical expense palette.
 *
 * Series colours live in variables rather than inline `style` so the light/dark
 * pair swaps with the `.dark` class the ThemeProvider toggles — no JS re-render,
 * no flash of the wrong palette on first paint. Every consumer scopes them under
 * `ALLOCATION_SCOPE` so one definition serves the full-size chart and the compact
 * donate-page summary alike.
 */

export const ALLOCATION_SCOPE = "tv-alloc";

export function allocationPaletteCss(): string {
  const light = EXPENSE_CATEGORIES.map((c) => `--tv-${c.key}: ${c.color};`).join(" ");
  const dark = EXPENSE_CATEGORIES.map((c) => `--tv-${c.key}: ${c.colorDark};`).join(" ");
  return `.${ALLOCATION_SCOPE} { ${light} } .dark .${ALLOCATION_SCOPE} { ${dark} }`;
}

/** The variable reference for one category, e.g. `var(--tv-MEDICAL)`. */
export function categoryVar(key: string): string {
  return `var(--tv-${key})`;
}
