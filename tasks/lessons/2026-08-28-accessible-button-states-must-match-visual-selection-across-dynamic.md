# Accessible button states must match visual selection across dynamic routers

**Learned:** 2026-08-28

Interactive carousels and filter toggles (such as `PetChooserCarousel`) that allow users to select items or general funds must programmatically expose their active state to screen readers via boolean `aria-pressed` or `aria-selected` attributes, especially when preselected via URL search parameters.

**Rule:** visual active classes (`ring-2`, `bg-primary`, etc.) are invisible to assistive tech; component unit tests must assert `aria-pressed="true"` on the selected option and `aria-pressed="false"` on unselected options.
