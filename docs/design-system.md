# Design System & Component Reference

This document defines the visual identity, color palette, typography, and component shape language for the pet-shelter application.

> **These rules are enforced.** `tests/unit/designSystemGuards.test.ts` fails the build on a raw
> palette utility, a hardcoded hex, an arbitrary type/radius/shadow value, an undeclared design-system
> class, or a tone slot missing from either theme. It runs in `npm test`. If you are about to write
> something this document forbids, the suite will say so before review does — see
> [`docs/tasks/TARGET_DESIGN_SYSTEM_GUARDS.md`](tasks/TARGET_DESIGN_SYSTEM_GUARDS.md) for why.

---

## 1. Color

The palette is intentionally warm, approachable, and rescue-focused, derived from the primary paw
icon. Nothing in `src/` names a color directly. Every value is declared once as a token in
[`src/app/globals.css`](../src/app/globals.css) — in `:root` and again in `.dark` — and exposed to
Tailwind through the `@theme inline` map. Because the generated utility resolves to `var(--token)`
rather than a literal, `bg-success-surface` already adapts to the theme.

**That indirection is the point**: pairing a token utility with a `dark:` variant recreates the ~180
hand-written overrides that had drifted out of sync with their light counterparts. Write the token
utility alone.

### 1.1 Brand surface tokens

The frame every page sits in: `background`, `foreground`, `card`, `popover`, `primary`, `secondary`,
`muted`, `accent`, `accent-subtle`, `destructive`, `border`, `input`, `ring`, plus the `frame-*`,
`brand-mark*` and `control-*` groups. Consume them as `bg-background`, `text-muted-foreground`,
`border-border`, and so on. Read the current values from `globals.css` — they are not duplicated here,
because a copy is a copy that goes stale.

### 1.2 Semantic tones — pick by meaning, never by hue

Seven tones, seven slots each. A component says what a thing *means* and the token layer decides what
color that is:

| Tone | Meaning |
|------|---------|
| **success** | verified · available · approved · payment received |
| **warning** | pending · needs attention · caution |
| **info** | informational · scheduled · submitted |
| **care** | under rehabilitation or veterinary care |
| **danger** | rejected · urgent · negative |
| **highlight** | the extra distinguishable color, with no fixed meaning — for legends that have run out of meaning tones. Reach for it last. |
| **neutral** | adopted · archived · inert |

| Slot | Use |
|------|-----|
| `surface` | tinted panel |
| `surface-strong` | emphasised panel |
| `border` | border on a tinted panel |
| `text` | readable on `surface` |
| `accent` | icon or rule on the page background |
| `solid` | filled badge |
| `on-solid` | text on that fill |

Used two ways. Directly, as a utility — `bg-care-surface`, `text-care-text`, `border-care-border` —
or, preferably, by composing a **tone class** with a **shell**: `class="tone-soft tone-care"`. The
tone class remaps a local `--tone-*` group and does nothing else, so every shell works with every
tone and a status surface can be restyled in one place.

The shells are declared in the `@layer components` block of `globals.css`: `tone-soft`,
`tone-panel-strong`, `tone-pill`, `tone-chip` (+ `tone-chip-pill`), `tone-ink`, `eyebrow`,
`receipt` (+ `receipt-panel`, `receipt-accent`) and `segmented` (+ `segmented-thumb`).

Two things that look reasonable and are not:

- **A variant on a shell** — `dark:tone-ink`, `hover:tone-soft` — compiles to nothing. Tailwind
  generates variants for utilities, not for classes in `@layer components`, so the element silently
  keeps its base styling.
- **A tone or slot that does not exist** — `tone-success-strong`, `bg-alert-surface` — also compiles
  to nothing, and renders unstyled rather than throwing.

Status → tone mapping lives in [`src/lib/presentation/`](../src/lib/presentation), not in components.

### 1.3 The two deliberate exceptions

- **HTML email** (`src/lib/email.ts`, `src/actions/settings.ts`) keeps literal hex. Mail clients
  support neither custom properties nor Tailwind, so a token would arrive colourless.
- **The printed tax receipt** (`--receipt-*`) is fixed, and deliberately absent from `.dark`. A
  Sec 44(6) receipt is black ink on white paper in every theme and has to survive a monochrome
  printer.

---

## 2. Shape Language & Border Radius

The design follows a **soft, semi-rounded** approach (the "squircle" direction) to convey warmth and approachability without becoming playful or unserious.

### Border Radius Guide

The scale derives from `--radius` (1.15rem), so changing that one value reshapes the whole app.
`rounded-3xl` and `rounded-4xl` are overridden too — Tailwind's defaults (1.5rem / 2rem) would
otherwise land *below* this project's `rounded-2xl` and invert the scale.

| Step | CSS Value | Use |
|------|-----------|-----|
| `rounded-sm` … `rounded-4xl` | `calc(--radius × 0.6)` … `× 2.6` | The general scale |
| `rounded-mark` | 1rem | The logo tile |
| `rounded-control` | 1.25rem | Buttons, navbar, segmented controls |
| `rounded-card` | 1.4rem | Card surfaces |
| `rounded-dialog` | 1.6rem | Modals |
| `rounded-md` / `rounded-lg` | from the scale | Badges, pills, small tags |

### Practical Application

- **Do**: Use the named shapes for the four shells that have one; the general scale otherwise.
- **Do**: Apply radius to both background shapes and border strokes for cohesion.
- **Don't**: Mix sharp corners with soft rounded corners in the same visual section.
- **Don't**: write `rounded-[1.4rem]`. An arbitrary radius is invisible to `--radius` and fails
  `designSystemGuards`. If a shape is genuinely missing, add the step to `globals.css`.

---

## 3. Shadows & Depth

Shadows are subtle and warm-toned to maintain the soft, approachable aesthetic.

### Shadow System

Warm-tinted, so shadows sit on cream without reading as grey. Five named steps, declared in
`globals.css`; an inline `shadow-[…]` fails `designSystemGuards`.

| Step | Use Case |
|------|----------|
| `shadow-brand-xs` | Borders and minimal elevation |
| `shadow-brand-sm` | Interactive hover states |
| `shadow-brand-md` | Lifted controls |
| `shadow-brand-lg` | Card surfaces, lifted content |
| `shadow-brand-xl` | Modal overlays, prominent surfaces |

---

## 4. Typography

### Font Family

- **Primary**: System stack (Segoe UI, Roboto, -apple-system, sans-serif)
- **Fallback**: Tailwind's default sans-serif stack

### Type Scale

| Element | Size | Weight | Line Height | Tailwind Class |
|---------|------|--------|-------------|----------------|
| **H1 / Page Title** | 3rem / 48px | 700 (bold) | 1.2 | `text-4xl font-bold` |
| **H2 / Section Title** | 2rem / 32px | 700 (bold) | 1.3 | `text-3xl font-bold` |
| **H3 / Subsection** | 1.5rem / 24px | 600 (semibold) | 1.4 | `text-2xl font-semibold` |
| **Body / Paragraph** | 1rem / 16px | 400 (normal) | 1.6 | `text-base` |
| **Small / Caption** | 0.875rem / 14px | 400 (normal) | 1.5 | `text-sm` |
| **Tiny / Badge** | 0.75rem / 12px | 500 (medium) | 1.4 | `text-xs font-medium` |
| **Metadata label** | 0.6875rem / 11px | 700 (bold) | 1.15 | `text-2xs` |
| **Eyebrow / fine print** | 0.625rem / 10px | 700 (bold) | 1.0 | `text-3xs`, or the `eyebrow` shell |

The scale is extended below `xs` rather than reached around: `text-[10px]` and `text-[11px]` are what
`text-3xs` and `text-2xs` replaced, and `designSystemGuards` rejects them.

---

## 5. Component-Specific Guidance

### Buttons

- **Default State**: Soft rounded, warm coral background, white or cream text
- **Hover State**: Darker coral or muted secondary, lifted shadow
- **Disabled State**: Muted gray-brown, no cursor change
- **Variants**: Primary (coral), secondary (blush), outline (border only)
- **Size**: sm (2.5rem), md (3rem), lg (3.5rem) heights

**Implementation**: See [`src/components/ui/button.tsx`](src/components/ui/button.tsx)

### Cards

- **Background**: Cream or warm off-white
- **Border**: Soft clay / warm beige, 1px
- **Radius**: 1.4rem (squircle)
- **Shadow**: Subtle warm shadow
- **Padding**: 1.5rem to 2rem depending on content density

**Implementation**: See [`src/components/ui/card.tsx`](src/components/ui/card.tsx)

### Dialogs / Modals

- **Background**: Cream (light mode) or deep brown (dark mode)
- **Radius**: 1.6rem for prominent feel
- **Overlay**: Semi-transparent dark (rgba 0,0,0,0.5)
- **Shadow**: Soft drop shadow beneath
- **Padding**: 2rem internal spacing

**Implementation**: See [`src/components/ui/dialog.tsx`](src/components/ui/dialog.tsx)

### Navbar

- **Height**: 4rem (64px)
- **Background**: Gradient blend of primary accent and cream
- **Border-radius**: Soft (1.25rem) on logo / icon containers
- **Text**: Deep espresso brown on warm background
- **Logo Container**: Rounded soft container with slight elevation shadow

**Implementation**: See [`src/components/Navbar.tsx`](src/components/Navbar.tsx)

### Form Inputs

- **Border**: Soft clay, 1px
- **Radius**: Moderate rounded (0.75rem)
- **Focus State**: Primary coral ring (2px), no outline
- **Placeholder**: Muted text, lower opacity
- **Padding**: 0.75rem to 1rem

---

## 6. Brand Asset Reference

### Logo & Icon

- **Primary Logo**: `/public/android-icon-192x192.png` (paw icon, warm palette)
- **Favicon Set**: 
  - `/public/favicon-192x192.png`
  - `/public/favicon-96x96.png`
  - `/public/favicon-32x32.png`
  - `/public/favicon-16x16.png`
  - `/public/favicon.ico` (fallback)
- **Apple Icon**: `/public/apple-icon-180x180.png`

All brand assets should be referenced from the `public/` folder and should maintain the warm coral / cream color scheme.

---

## 7. Spacing & Layout

Follow Tailwind's default 4px grid for consistency:

- **XS**: 0.25rem (4px)
- **SM**: 0.5rem (8px)
- **MD**: 1rem (16px)
- **LG**: 1.5rem (24px)
- **XL**: 2rem (32px)
- **2XL**: 3rem (48px)

Use Tailwind's spacing utilities (`p-`, `m-`, `gap-`) rather than custom pixel values.

---

## 8. Accessibility & Contrast

- All text must maintain **WCAG AA contrast** (4.5:1 for body, 3:1 for large text).
- The warm palette is legible; test dark text on light backgrounds and vice versa.
- Focus states must always be visible; use the primary accent color for ring focus states.
- Ensure color is never the only method of conveying information (pair with icons, text labels, or borders).

---

## 9. When to Request Design Review

Request design review before implementing if you're:

1. Adding a new component type not listed above
2. Introducing a color outside the palette
3. Changing border radius conventions
4. Creating a variant with significantly different styling
5. Applying dark mode handling that isn't a simple invert of light mode

---

## Quick Reference

[`src/app/globals.css`](../src/app/globals.css) is the single source of truth, in four numbered
sections: **1. Tokens** (`:root`, `.dark`, `@theme inline`), **2. Base** (element defaults),
**3. Components** (the shells), **4. Print** (receipt isolation). Values are `oklch()` or hex; the
`@theme inline` map is what turns each one into a Tailwind utility.

Access in components via the generated utility — `bg-background`, `text-foreground`, `border-border`,
`bg-care-surface`, `rounded-card`, `shadow-brand-lg` — or by composing a tone class with a shell,
`class="tone-soft tone-care"`. Never `var()` at a call site, never a literal.

| Want to… | Do |
|---|---|
| add a color | declare `--x` in **both** `:root` and `.dark`, map it in `@theme inline`, then use `bg-x` |
| add a status color | reuse one of the seven tones; add a tone only if the *meaning* is new |
| add a recurring shell | declare it in `@layer components` and use it — an unused class fails the guard |
| use a one-off size | add the step to the scale rather than inlining `text-[13px]` |

**Enforced by**: [`tests/unit/designSystemGuards.test.ts`](../tests/unit/designSystemGuards.test.ts).

---

**Last Updated**: 2026-08-27
