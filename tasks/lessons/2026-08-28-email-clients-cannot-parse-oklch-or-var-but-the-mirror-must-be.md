# Email clients cannot parse `oklch()` or `var()`, but the mirror must be mathematically provable

**Learned:** 2026-08-28

HTML email cannot consume CSS custom properties or modern color spaces (`oklch()`). The design system must provide a `#rrggbb` hex mirror for email templates and server settings (`src/lib/presentation/emailTokens.ts`). However, hand-written tables rot into divergent palettes.

**Rule:** compute the color conversion (OKLCH → OKLab → LMS → linear sRGB → gamma-corrected sRGB) inside static guard tests (`tests/unit/designSystemGuards.test.ts`) and assert that every token mirror entry matches `globals.css` `:root` computed hex values. Pin the mathematical converter against external ground truths (e.g. published sRGB primaries).
