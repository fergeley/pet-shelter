# Target — The Light Theme's Primary Fails AA in Both Directions

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Baseline**: 52 test files / 685 tests green · `npx tsc --noEmit` clean · `npm run lint` 0 errors
**Predecessor**: `1d65478` / `152e817` email colour parity, and `7cb4946`, which measured the
ratios `TARGET_EMAIL_COLOUR_PARITY.md` §6 said to measure before promising anything.

> **Scope**: one token. `--primary` in `:root` is too light to carry text *and* too light to host
> white text, and it is the brand's signature colour, so both failures are everywhere at once. This
> is the whole of what the contrast measurement found — and deliberately not the "contrast guard"
> project §6 imagined, for the reason in §3.2.

---

## 1. 🔴 Why this is next

Every number below was computed from `globals.css` on the date above, with the converter that landed
in `tests/support/oklch.ts`. WCAG relative luminance falls out of its linear-sRGB step, exactly as
`TARGET_EMAIL_COLOUR_PARITY.md` §3.1 predicted it would.

**99 promised pairings were measured across both themes. One token accounts for every real failure.**

| Pairing | Ratio | Needs | |
|---|---|---|---|
| `text-primary` on `--background` | **2.90:1** | 4.5 | ❌ |
| `text-primary` on `--card` | **3.00:1** | 4.5 | ❌ |
| `--primary-foreground` on `--primary` | **3.00:1** | 4.5 | ❌ |
| `--primary-foreground` on `--primary-hover` | **3.31:1** | 4.5 | ❌ |
| everything else — 7 tones × text/surface, receipt inks, muted, destructive | 4.51 – 17.72:1 | | ✅ |

The failure is symmetric, and that is the useful part: `--primary` is asked both to *be* text on
cream and to *host* white text, and it is too light for both. **Both directions want the same fix.**

### 1.1 It is not a corner of the app

One token, resolved by 262 utility uses across 26 files:

| Utility | Call sites |
|---|---|
| `text-primary` | 121 |
| `bg-primary` | 56 |
| `border-primary` | 45 |
| `text-primary-foreground` | 25 |
| `ring-primary` | 15 |

`button.tsx`'s `default` variant is `bg-primary text-primary-foreground` under a base shell of
`text-xs font-semibold uppercase tracking-widest` — **12px**, so WCAG's large-text allowance does not
apply. The primary call-to-action in this application is currently below AA everywhere it appears.

### 1.2 The dark theme already solved this

`.dark` sets `--primary: #eaa39b` on a dark ground and scores **8.34 – 9.01:1** in every direction.
The system's own principle — a token's lightness is chosen for the ground it sits on — was applied
to one theme and not the other. This is not a new rule; it is the existing rule, unapplied.

### 1.3 The claim it retires

`docs/design-system.md` §8 currently hedges: AA is "the **target**… not currently a *verified*
property", and notes a prior code comment claimed AAA for pairings closer to AA. After this, §8 can
state what is true — the tone palette is genuinely AA-or-better, and it was one token that was not.

---

## 2. What already exists to reuse

- **`tests/support/oklch.ts`** — `oklchToHex` and `cssColorToHex`, pinned against the sRGB primaries
  by `tests/unit/oklch.test.ts`. Relative luminance is `dec()` + three coefficients on top of it.
- **`readCssTokens(block)`** already parses `:root` and `.dark` into a map, and
  `designSystemGuards.test.ts` already holds `block()`, `TONES` and `SLOTS` as the contract. A
  contrast assertion is a new `it()` there, not new infrastructure.
- **`EMAIL_TONE` / `EMAIL_BRAND`** already mirror the light values, so the email inherits the fix for
  free — and its parity assertions will *fail* until the mirror is regenerated, which is the
  reminder working as designed.
- **The house pattern**: introduce the guard, then prove each assertion bites by injection. The
  predecessor did 8; `TARGET_DESIGN_SYSTEM_GUARDS.md` §5 did 15.

---

## 3. ⚠️ The real decisions

### 3.1 Which fix — and this one is genuinely the user's

`docs/design-system.md` §9.4 lists "choosing *which* tone a new status maps to" as needing a person.
Changing the brand's signature colour is squarely that.

**Recommended: darken `--primary` to `oklch(56.9% 0.118 27.7)` = `#b2594f`.** Hue and chroma
unchanged — only lightness moves, by 11 points — so it stays recognisably the same terracotta.

| | white on it | as text on cream |
|---|---|---|
| now `#d77a6f` | 3.00:1 ❌ | 2.90:1 ❌ |
| proposed `#b2594f` | **4.67:1** ✅ | **4.51:1** ✅ |

`--primary-hover` (`#cf7267`, currently 3.31:1) darkens with it, keeping its one-step relationship.

**The alternative, for the record**: keep `#d77a6f` as a fill and put dark ink on it
(`--foreground` `#2a1b1b` scores 5.43:1), then add a separate darker `--primary-text` for the 121
text call sites. It preserves the brand fill exactly, but it grows the token vocabulary, migrates 121
call sites, and inverts every primary button from white-on-coral to dark-on-coral — a bigger visual
change than darkening, in exchange for keeping one value fixed. Recommended against, but it is a real
option and the choice is not mine.

**Do not** fix this by exempting the button, or by pairing `dark:` variants — both are the failure
modes the token layer exists to prevent.

### 3.2 Guard the pairings the design system *promises*, not every pair of tokens

The 99-pairing sweep flagged 16 "non-text" items at 1.4–2.4:1 — every tone's `border` on its own
`surface`, and `--border` on `--card`. **Those are not failures.** WCAG's 3:1 non-text rule covers
boundaries *required to understand content*; a decorative hairline on a panel already distinguished
by its fill is not one. Asserting them would turn 16 legitimate design choices red and teach people
to skip the guard — the exact failure mode `designSystemGuards.test.ts` was written to avoid.

Guard the text pairings the slot vocabulary actually promises: `text` on `surface`, `text` on
`surface-strong`, `on-solid` on `solid`, each `*-foreground` on its own surface, and the receipt
inks on paper. That is ~40 assertions, all meaningful.

### 3.3 Translucent tokens have to be composited, not skipped

`.dark`'s tone surfaces carry alpha (`oklch(26.2% 0.051 172.552 / 0.45)`), and `cssColorToHex`
deliberately **throws** on alpha rather than inventing an opaque value. A contrast check must
composite over the theme's `--background` first, the way a browser does. Skipping alpha tokens would
silently exempt all seven dark surfaces — half the palette, unchecked, while reporting green.

---

## 4. Step plan

1. **Get the decision in §3.1.** Nothing else can start; every step below encodes a colour.
2. **Change `--primary` and `--primary-hover` in `:root`.** Two lines. Do not touch `.dark`.
3. **Regenerate the email mirror.** `EMAIL_BRAND.primary` will fail its parity assertion until it
   matches — recompute it from the new token, do not hand-edit it to whatever makes the test pass.
4. **Add the contrast assertion** to `designSystemGuards.test.ts`, per §3.2, compositing per §3.3.
5. **Prove it bites**: lighten `--primary` back by one step, drop a tone's `text`, feed it a
   translucent dark surface, and confirm each goes red with the offending pairing named.
6. **Update `docs/design-system.md` §8** from "unverified target" to the measured property, and §1.1
   if the primary value is quoted there.
7. **Look at it.** A ratio is not a design review: check the darker terracotta against the navbar
   logo tile (`--brand-mark`), the secondary blush, and a primary button beside a destructive one.

---

## 5. Acceptance criteria

1. `npm run test:all` green, contrast assertions in the Tier-2 group.
2. `npx tsc --noEmit` clean; `npm run lint` no new problems.
3. Every new assertion verified to bite, by injection.
4. Zero text pairings below 4.5:1 in either theme, measured by the guard itself.
5. Failure messages name the pairing and both hex values, not a count.
6. No new dependency, no new token unless §3.1 chooses the alternative.
7. The email mirror regenerated from the token, not hand-matched.

---

## 6. Out of scope

- **Non-text contrast** — §3.2. Worth revisiting only for genuine UI boundaries (focus rings, form
  borders); `--ring` on `--background` measures 3.40:1 today and already passes.
- **Dark-mode email** — still its own project, `TARGET_EMAIL_COLOUR_PARITY.md` §3.2.
- **`.tone-chip` metrics** — not mechanically detectable.
- **`AuditLogViewer.tsx:58`** — `hover:bg-success-surface` on an element that is already
  `tone-soft tone-success`, a hover to the colour it already is. Still pre-existing, still cosmetic.

---

## 7. ⚠️ Coordination — this branch has concurrent writers

Unchanged and still biting. During the predecessor task the other session implemented the same brief
in parallel, rewrote four files mid-read, and committed the result — including this session's
work — with `git add -A` under its own message.

- **Check `git diff --cached --name-only` in its own tool call before composing a commit.**
- **Commit with a pathspec**: `git add -- <paths>` then `git commit -F <msg> -- <the same paths>`.
- **Re-measure before quoting.** The predecessor's headline "64 hex in `email.ts`" was 46 by the time
  work started. Every number in §1 above was computed on the date in the header; recompute rather
  than inherit them.
- Treat anything already implemented when you arrive as a **draft to review against this plan**, not
  as the task being done.

---

## 8. Outcome

**Done 2026-08-28.** `:root --primary` → `#b2594f`, `--primary-hover` → `#aa5148` (same ΔL, so the
hover keeps its one-step relationship). `.dark` untouched — it was already 8.3–9.0:1.

| | before | after |
|---|---|---|
| `text-primary` on `--background` | 2.90:1 ❌ | **4.51:1** ✅ |
| `--primary-foreground` on `--primary` | 3.00:1 ❌ | **4.67:1** ✅ |
| `--primary-foreground` on `--primary-hover` | 3.31:1 ❌ | **5.20:1** ✅ |

Guard added to `designSystemGuards.test.ts`: 73 pairings across both themes, translucent surfaces
composited per §3.3, failing below 4.5:1. Four injections verified it bites — the old primary value,
a muddied foreground, a *dark-theme* tone text, and a deleted token (reported, never skipped).
`tests/support/oklch.ts` gained `parseCssColor` / `compositeOver` / `relativeLuminance` /
`contrastRatio`, anchored in `oklch.test.ts` on ratios fixed by the WCAG formula (black on white is
21:1 exactly). The email mirror was recomputed from the token, not hand-matched, so the emailed
button label now clears AA too. `npm run test:all` 52 files / 697 tests green.

### 8.1 ⚠️ The consequence worth knowing: primary and destructive converged

Darkening primary moved it toward `--destructive` (`#b54043`). Measured as OKLab ΔE:

| | ΔEok |
|---|---|
| old `#d77a6f` vs destructive | 0.147 — clearly different |
| **new `#b2594f` vs destructive** | **0.049 — similar** |

Roughly a threefold loss of separation. It does **not** affect buttons much, because the destructive
variant is a tint (`bg-destructive/10` with destructive text) rather than a solid fill, so the two
never appear as competing solid blocks. Where it does bite is *text*: `text-primary` (121 call sites)
and `text-destructive` (55) are now near-neighbours on cream, and a destructive link that reads as a
primary link is a real confusion.

Not fixed here, because fixing it means changing a *second* brand token beyond what was approved.
The options, for whoever picks this up:

1. **Accept it.** §8 of the design-system doc already requires that colour never be the only carrier
   of meaning — destructive actions pair with an icon or an explicit label. Cheapest, and arguably
   already the rule.
2. **Push `--destructive` further from the brand hue** — toward a cooler red. One token, no call
   sites, restores the separation. Needs the same contrast check (`--destructive` on `--card` is
   5.48:1 today and must stay ≥ 4.5).
3. Re-pick primary with a small hue shift as well as a lightness drop. Most disruptive; the brand
   colour was only meant to get darker, not to change hue.

Recommendation: **2**, as its own small target. It is the one that restores the distinction without
touching the colour the shelter is recognised by.
