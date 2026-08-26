# Target — Design System Guards

**Date**: 2026-08-27
**Branch**: `feat/tnrm-rehabilitation`
**Baseline**: 39 test files / 516 tests green · `npx tsc --noEmit` clean · `next build` compiles
**Predecessor commit**: `5dfb881 refactor(ui): finish the design-system rollout and fix the review findings`

> **Scope**: this document records the follow-on to the design-system standardization landed in
> `6c6d6d5` (token / base / component layering in `src/app/globals.css`, plus the sweep of 21
> components onto tokens) and `5dfb881` (the fixes from reviewing it).
>
> The system is in place and the tree is clean. **Nothing keeps it that way.** This task adds the
> structural guard that makes the cleanliness an invariant instead of a snapshot.

---

## 1. 🔴 Why this is the next target

Every number below was read from the source on the date above.

**The design system is currently at zero drift — and that state is unenforced.** As of `764b225`:

| Metric | Count |
|---|---|
| Raw Tailwind palette utilities in `src/**` (`bg-emerald-800`, `dark:text-zinc-500`, …) | 0 |
| Hardcoded hex colours in `src/components/**` and `src/app/**` `.tsx` | 0 |
| Arbitrary `text-[Npx]` / `rounded-[…]` / `shadow-[…]` values | 0 |
| Component classes declared in `@layer components` | 21 |

That is a snapshot taken minutes ago. A single `bg-emerald-800` in the next PR restores the drift,
and nothing in `npm test`, `npx tsc --noEmit` or `npm run lint` will say a word.

### 1.1 This codebase has already decayed once — that is the whole argument

The pre-standardization tree carried:

- **335** raw palette utilities across 21 files
- **54** hardcoded hex colours in components
- **121** arbitrary font sizes (`text-[10px]`, `text-[11px]`, `text-[9px]`)
- **184** hand-written `dark:` colour variants, each a light/dark pair kept in sync by hand

Those did not arrive in one commit. They accumulated because every individual `bg-emerald-800`
looked reasonable in isolation, and because `tsc` and ESLint are structurally incapable of
objecting. The token layer removed them; it did not remove the pressure that produced them.

### 1.2 A manual audit is demonstrably not sufficient

The standardization pass was audited by hand and reported clean. A review of that pass then found
four real defects that the audit had missed:

| Defect | How it hid | Guard that catches it |
|---|---|---|
| `.tone-panel` shipped with **zero** call sites, while 17 elements still hand-rolled the `bg-X-surface border-X-border text-X-text` triplet it existed to replace | The class name appears in three doc comments, so a naive `grep` counted it as used | Every declared component class has a consumer — **with comments stripped first** |
| A regex rewrote `bg-success-surface-strong` into `tone-success-strong`, a class that does not exist | An unknown class fails silently: the element renders unstyled rather than throwing | Every used `tone-*`/`eyebrow*`/`receipt*`/`segmented*` class is declared |
| Six bulletin badges kept an orphaned bare `dark:border` after `dark:border-amber-800` was removed, drawing a rosewood border around a solid fill in dark mode | Only visible in dark mode, on one page, on pinned rows | Partially — see §3.2; the bare-utility case is deliberately **not** guarded |
| `.tone-chip` invented its own metrics, silently shrinking both admin tables' status chips from 12px to 10px | No error, no test, just smaller text on the densest staff-facing surface | Not guardable — see §6 |

Two of the four are mechanically detectable. The point of this task is that they were **not**
detected by a careful human pass over the same code.

---

## 2. What already exists to reuse

- **`tests/unit/layerBoundaries.test.ts`** is the exact precedent: a Tier-2 architectural guard that
  reads source text and asserts properties of the *import graph* — "a class of mistake that neither
  `tsc` nor any behavioural test can see". Reuse its `walk()` / `toRepoPath()` shape, its `ROOT`/`SRC`
  resolution via `fileURLToPath`, and its habit of asserting `expect(offenders).toEqual([])` so the
  failure message names every offending file.
- **The `unit` vitest project** (node environment, no jsdom) already runs `tests/unit/**`. A source-text
  guard needs no DOM and no database, so it drops straight in with no config change.
- **`src/app/globals.css`** is already structured for machine reading: the tone tokens are declared in
  `:root` and `.dark` with a strict `--tone-<name>-<slot>` naming scheme, mapped one-to-one in
  `@theme inline`, and every component class lives inside a single `@layer components` block.
- **The precedent for a drift guard in this repo**: `TARGET_ADMIN_STATUS_PARITY.md` §7.1 added
  `PET_STATUS_SEQUENCE > covers every canonical status the validation enum accepts` for exactly this
  reason, and verified it bites by deleting a status and watching it go red. Do the same here (§5).

---

## 3. ⚠️ The real decisions

### 3.1 Comments must be stripped before any usage scan

This is not a nicety. Every one of these class names is discussed in a doc comment somewhere —
`petStatusPresentation.ts`, `applicationStatusPresentation.ts` and `medicalTimeline.ts` all name
shells in their JSDoc. **Counting a mention as a use is precisely how the unused `.tone-panel`
survived the manual audit.** Strip `/* … */` and `//` before scanning, or the "no unused class"
assertion is worthless.

### 3.2 What deliberately must NOT be asserted

Each of these would produce false positives that train people to disable the guard:

- **Hex in HTML email.** `src/lib/email.ts` and `src/actions/settings.ts` build email markup with
  literal hex on purpose — mail clients support neither CSS custom properties nor Tailwind. Scope the
  hex assertion to `src/components/**` and `src/app/**` `.tsx` only.
- **Bare `dark:border` / `dark:ring`.** These are legal Tailwind (they set border-*width* in dark
  mode). The six in `BulletinFeed` were orphans, but intent is not recoverable from the text, so
  guarding this trades a real bug for recurring false alarms. Leave it.
- **`dark:` on token utilities.** `dark:text-warning-accent` and `dark:bg-muted/80` are correct: they
  switch *which* token applies, not a token's value. Four such variants exist today and all four are
  legitimate. Assert only against `dark:` + a *raw palette* colour.
- **`text-white` / `bg-white`.** Still correct over photo scrims and inside the printed receipt.

### 3.3 Naming and placement

`tests/unit/designSystem.test.ts`, alongside `layerBoundaries.test.ts`. Tier 2 (architectural
guards), per the `npm run test:unit` grouping in `CLAUDE.md`.

---

## 4. Step plan

1. **Create `tests/unit/designSystem.test.ts`** using the `walk()` / `readFileSync` shape from
   `layerBoundaries.test.ts`. Load every `src/**/*.{ts,tsx}` once into a `Map`, and a
   comment-stripped copy into a second `Map` (§3.1). Read `src/app/globals.css` once.
2. **Colour assertions** over the stripped sources:
   - no `(dark:)?(bg|text|border|ring|fill|stroke|from|to|via|divide|outline|accent|caret)-<palette>-<shade>`
     anywhere in `src/**`;
   - no `dark:(bg|text|border|ring)-<palette>-` (subsumed by the above, but assert separately so the
     failure message explains *why* — the token already flips theme);
   - no `#rrggbb` in `src/components/**` or `src/app/**` `.tsx` (§3.2).
3. **Size assertions**: no `(text|rounded|shadow)-[…]` in any `.tsx`. The message should name the
   scale — type is `text-3xs`…`text-xs`, radii are `rounded-sm`…`rounded-4xl` plus
   `rounded-mark`/`control`/`card`/`dialog`, elevation is `shadow-brand-xs`…`xl`.
4. **Component-layer assertions**, parsing class selectors out of the `@layer components` block:
   - every declared class has at least one consumer in the stripped sources — *the `.tone-panel`
     guard*;
   - every used class matching `^(tone-|eyebrow|receipt|segmented)` is declared — *the
     `tone-success-strong` guard*;
   - no variant is applied to a component class (`dark:tone-ink` compiles to nothing, so the element
     silently keeps its light-mode colour);
   - the seven tone selectors and the documented shells are present, so a rename cannot quietly drop
     one.
5. **Token-completeness assertions**, parsing `:root`, `.dark` and `@theme inline`:
   - all seven slots (`surface`, `surface-strong`, `border`, `text`, `accent`, `solid`, `on-solid`)
     exist for all seven tones (`success`, `warning`, `info`, `care`, `danger`, `highlight`,
     `neutral`) **in both themes** — a slot missing from one theme is invisible until someone views
     that theme, at which point the utility resolves to an undefined var and the element loses its
     colour entirely;
   - each slot is exposed to Tailwind as `--color-<tone>-<slot>: var(--tone-<tone>-<slot>);`;
   - **no `--receipt-*` token is overridden inside `.dark`** — a Sec 44(6) receipt is black ink on
     white paper in every theme, and a dark override prints a donor an unreadable statutory document.
6. **Verify each assertion bites** (§5) before committing.
7. **Cross-link** from `CLAUDE.md`'s "Design system" section, so the conventions and their enforcement
   point at each other.

---

## 5. Acceptance criteria

1. `npm test` green, with the new file adding roughly 10 assertions to the Tier-2 group.
2. `npx tsc --noEmit` clean; `npm run lint` reports no new problems.
3. **Every assertion is verified to bite.** Temporarily introduce each defect, watch the suite go
   red, then revert:
   - add `className="bg-emerald-800"` to a component;
   - add `text-[13px]` to a component;
   - add an unused `.tone-orphan { color: red }` to `@layer components`;
   - reference a nonexistent `tone-bogus` from a component;
   - write `dark:tone-ink` on an element;
   - delete `--tone-care-accent` from `.dark`;
   - add `--receipt-ink: white` to `.dark`.
4. Each failure message names the offending **file and token**, not just a count — the guard is read
   by whoever broke it, and a bare `expected 3 to be 0` sends them hunting.
5. The guard adds no dependency, no config change, and no measurable runtime to `npm test`.

---

## 6. Out of scope

- **The `.tone-chip` metrics class of bug.** That a shell shrank the admin chips from 12px to 10px is
  not mechanically detectable — both values are on the scale, and only a human or a visual-regression
  tier can say which is correct. It belongs to `TEST_TASK_02_COMPONENT_AND_UI_SUITE.md` /
  `TEST_TASK_04_PLAYWRIGHT_E2E_AND_CI.md`, not here.
- **Contrast assertions.** Checking tone `solid` against `on-solid` for WCAG AA would be valuable and
  is genuinely computable from the oklch values, but it needs a colour library and a decision about
  which level to enforce. Worth its own target; note that the pre-existing `badgeClass` comment
  claimed AAA for pairings that are closer to AA.
- **HTML email colour alignment.** `src/lib/email.ts` and `src/actions/settings.ts` keep literal hex
  correctly (§3.2), but their badge colours do not mirror the tone palette, so a status reads one
  colour in the app and another in the notification email. Contained, worth doing, separate.
- **`AuditLogViewer.tsx:58`** carries `hover:bg-success-surface` on an element that is already
  `tone-soft tone-success` — a hover to the colour it already is. Pre-existing, cosmetic.
- Any change to the tokens, the tone taxonomy, or the component layer itself. This task adds
  enforcement only; `5dfb881` is the design.

---

## 7. ⚠️ Coordination — this branch has concurrent writers

`feat/tnrm-rehabilitation` is being written by more than one session, and commits land mid-task.
During the predecessor work the tree moved five commits forward unprompted, and two files
(`DonationWidget.tsx`, `SponsorshipModal.tsx`) were rewritten underneath an in-progress edit, silently
reverting it — it had to be re-applied and re-verified.

Practical consequences for whoever picks this up:

- **Re-run the §1 audit before starting.** The zero-drift numbers are from `764b225`; concurrent work
  may have introduced offenders, in which case fix them first or the new guard lands red.
- **Stage by filename, never `git commit -a`.** At the time of writing, 21 files unrelated to this
  work sit modified in the tree.
- **Re-read any file you are mid-edit on** before assuming your change is still there.
