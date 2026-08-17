# Design System & Component Reference

This document defines the visual identity, color palette, typography, and component shape language for the pet-shelter application.

---

## 1. Color Palette

The palette is intentionally warm, approachable, and rescue-focused. All colors are derived from the primary paw icon and should create a cohesive, non-clinical visual identity.

### Light Mode

| Token | Color | Use Case |
|-------|-------|----------|
| **background** | `#FFFDF8` (Cream / Warm Ivory) | Page backgrounds, card surfaces |
| **foreground** | `#2A1810` (Deep Espresso Brown) | Primary text, headings, body copy |
| **primary** | `#C85A54` (Muted Coral / Rose Terracotta) | Key CTAs, accent highlights, hover states |
| **secondary** | `#E8D5C4` (Blush / Warm Sand) | Secondary buttons, muted accents, tags |
| **muted** | `#D4B5A0` (Warm Clay) | Borders, dividers, subtle backgrounds |
| **border** | `#E5D4C1` (Soft Beige) | Card borders, input borders, separators |

### Dark Mode

| Token | Color | Use Case |
|-------|-------|----------|
| **background** | `#1A1410` (Deep Brown-Black) | Dark backgrounds |
| **foreground** | `#F5EFEA` (Warm Off-White) | Text on dark backgrounds |
| **primary** | `#F49080` (Lighter Coral / Warm Salmon) | Bright accents in dark mode |
| **secondary** | `#D4A89C` (Warm Rose) | Secondary accents |
| **muted** | `#5A4A40` (Warm Gray-Brown) | Borders in dark mode |
| **border** | `#6B5B50` (Medium Brown) | Dark mode borders |

### Implementation Location

All theme tokens are defined centrally in:
- **CSS Variables**: [`src/app/globals.css`](src/app/globals.css) (`:root` and `html.dark` selectors)
- **Tailwind Config**: Extends color theme from CSS variables via `theme.colors.{token}`

Any new component should reference these tokens via `bg-background`, `text-foreground`, `border-border`, etc., rather than hardcoded hex values.

---

## 2. Shape Language & Border Radius

The design follows a **soft, semi-rounded** approach (the "squircle" direction) to convey warmth and approachability without becoming playful or unserious.

### Border Radius Guide

| Component | Radius | CSS Value | Rationale |
|-----------|--------|-----------|-----------|
| **Buttons** | Soft | `rounded-[1.25rem]` | Inviting, touchable; signals CTA |
| **Cards** | Rounded | `rounded-[1.4rem]` | Gentle, friendly surfaces; primary content containers |
| **Dialogs** | Extra Rounded | `rounded-[1.6rem]` | Calm, non-aggressive modal framing; larger radius for emphasis |
| **Inputs** | Soft | `rounded-[0.75rem]` | Slightly softer than dialog, but consistent with overall language |
| **Navbar** | Soft | `rounded-[1.25rem]` | Matches button radius for visual cohesion |
| **Small UI** | Minimal | `rounded-md` or `rounded-lg` | Badge, pill, small tag elements |

### Practical Application

- **Do**: Use the defined radius tokens consistently across all new components.
- **Do**: Apply radius to both background shapes and border strokes for cohesion.
- **Don't**: Mix sharp corners with soft rounded corners in the same visual section.
- **Don't**: Use radius values outside the guide unless explicitly approved during design review.

---

## 3. Shadows & Depth

Shadows are subtle and warm-toned to maintain the soft, approachable aesthetic.

### Shadow System

| Layer | CSS | Use Case |
|-------|-----|----------|
| **Card Shadow** | `shadow-[0_10px_28px_rgba(200,90,84,0.08)]` | Card surfaces, lifted content |
| **Button Hover** | `shadow-md` + warmtint | Interactive hover states |
| **Dialog Shadow** | `shadow-[0_20px_48px_rgba(0,0,0,0.12)]` | Modal overlays, prominent surfaces |
| **Subtle Shadow** | `shadow-sm` | Borders and minimal elevation |

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

## Quick Reference: CSS Variables

All values are exposed as CSS custom properties in [`src/app/globals.css`](src/app/globals.css):

```css
--background: 0 0% 99.7%;
--foreground: 16 60% 10%;
--primary: 10 42% 51%;
--secondary: 19 45% 87%;
--muted: 16 25% 68%;
--border: 20 42% 80%;
--radius: 1.4rem;
```

Access in components via:
- Tailwind class: `bg-background`, `text-foreground`, `border-border`, `rounded-[var(--radius)]`
- CSS: `background-color: hsl(var(--background))`

---

**Last Updated**: 2026-08-15
