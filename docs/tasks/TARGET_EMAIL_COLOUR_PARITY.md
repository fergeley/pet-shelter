# Target — Email Colour Parity

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Baseline**: 42 test files / 537 tests green at `da81c1b` · `npx tsc --noEmit` clean · `npm run lint` 0 errors
**Predecessor commit**: `da81c1b test(ui): guard the design system against colour and shell drift`

> **Scope**: `da81c1b` made the design system an enforced invariant everywhere it could reach. It
> deliberately could not reach two files. This task closes that hole — not by extending the guard
> over them, which would be wrong, but by giving them something correct to point at.

---

## 1. 🔴 Why this is the next target

Every number below was read from the source on the date above.

`designSystemGuards.test.ts` forbids a literal hex anywhere in `src/**`, with exactly two exemptions:

```ts
const HEX_ALLOWED = new Set(["src/lib/email.ts", "src/actions/settings.ts"]);
```

That exemption is **correct and must stay**. Mail clients support neither CSS custom properties nor
Tailwind, so a token would arrive at the donor's inbox as colourless markup. But it means those two
files are now the only unguarded colour surface in the codebase, and what is underneath the
exemption is wrong:

| Metric | Count |
|---|---|
| Hex occurrences in `src/lib/email.ts` | 64 |
| Distinct hex values in `src/lib/email.ts` | 23 |
| Hex occurrences in `src/actions/settings.ts` | 9 |
| Distinct hex values in `src/actions/settings.ts` | 8 |
| Of those 8, how many are copies of a value in `email.ts` | **8** |
| Shared palette constant between the two files | **none — every hex is inline** |
| Exported email builders in `email.ts` | 5 |

### 1.1 The email is styled in the palette the app abandoned

The values are Tailwind's stock `slate` / `sky` / `green` / `amber` / `red`:

| Email value | Tailwind default | Used for |
|---|---|---|
| `#0f172a` | slate-900 | header background |
| `#f8fafc` | slate-50 | body background, footer |
| `#64748b` | slate-500 | secondary text |
| `#e2e8f0` | slate-200 | rules |
| `#0284c7` | sky-600 | primary button, headings |
| `#dcfce7` / `#15803d` | green-100 / green-700 | `.badge-approved` |
| `#fef3c7` / `#b45309` | amber-100 / amber-700 | `.badge-review` |
| `#fee2e2` / `#b91c1c` | red-100 / red-700 | `.badge-rejected` |

That is precisely the vocabulary the token pass removed from `src/**`. A shelter whose app is warm
cream and terracotta (`--background: #fff8f4`, `--primary: #d77a6f`) sends cool slate-and-sky email.
The two surfaces do not look like the same organisation.

### 1.2 A status reads one colour in the app and another in the inbox

The app has seven tones. The email has four badge classes, none of which is derived from a tone:

| Application status | In-app tone | In-email badge |
|---|---|---|
| approved | `success` — emerald `oklch(43.2% 0.095 166.913)` | green-700 `#15803d` |
| under review | `warning` — amber `oklch(47.3% 0.137 46.201)` | amber-700 `#b45309` |
| rejected | `danger` — red `oklch(44.4% 0.177 26.899)` | red-700 `#b91c1c` |
| submitted / scheduled | `info` — sky `oklch(44.3% 0.11 240.79)` | sky-700 `#0369a1` |
| **in rehabilitation** | **`care` — indigo** | **no equivalent exists** |
| **adopted / archived** | **`neutral`** | **no equivalent exists** |
| **(legend overflow)** | **`highlight`** | **no equivalent exists** |

Three of the seven tones have no email representation at all, so any notification about an animal
under veterinary care falls back to the default sky badge — the colour the app reserves for
"informational".

### 1.3 The duplication is already total

All eight distinct colours in `settings.ts` also appear in `email.ts`, and neither file imports the
other. They were hand-copied. Nothing detects the two drifting apart, which is the same class of
failure the `dark:` overrides had before the token layer: two copies of one value, kept in sync by
hand, until they are not.

### 1.4 One of these is a statutory document

`buildDonationReceiptEmail` renders the Sec 44(6) tax-exempt e-receipt. It is the most
consequential thing this codebase sends, it is styled in `#0f172a` on `#f8fafc`, and the in-app
receipt it mirrors is styled from the `--receipt-*` tokens. The printed and the emailed receipt for
the same donation do not match.

---

## 2. What already exists to reuse

- **`tests/unit/designSystemGuards.test.ts`** already parses `globals.css`: `block()` returns the
  balanced-brace body of `:root`, `.dark`, `@theme inline` or `@layer components`, and `TONES` /
  `SLOTS` are already declared as the contract. A parity assertion is a new `it()` in that file, not
  new infrastructure.
- **`HEX_ALLOWED`** is already the exact list of files this target touches. It currently means
  "these files may use any hex"; the end state is "these files may use only the mirror".
- **`docs/design-system.md` §1.2** already documents the tone taxonomy and §1.3 already documents
  *why* email is exempt. Both were written in `da81c1b` and need only a pointer to the mirror.
- **The house pattern for a drift guard**: introduce it, then prove every assertion bites by
  injecting the defect and watching it go red (`TARGET_DESIGN_SYSTEM_GUARDS.md` §5, verified there
  with 15 injections).

---

## 3. ⚠️ The real decisions

### 3.1 The tokens are `oklch`; email needs `#rrggbb`

Mail clients support neither `var()` nor `oklch()`. So parity cannot mean "reference the token" — it
must mean "a hex mirror of the token, provably equal to it".

**Recommendation: compute the conversion in the guard rather than trusting a hand-written table.**
oklch → sRGB is OKLab → LMS → linear sRGB → gamma, about 40 lines and no dependency, which keeps the
predecessor's "no dependency, no config change" property. A hand-maintained table would be a third
copy of the palette and would rot exactly like `settings.ts` did.

The converter is worth writing carefully because it also unlocks the contrast target (§6): relative
luminance falls out of the same linear-sRGB step.

### 3.2 Mirror the **light** theme only

Email has no theme. A mail client does not carry the app's `.dark` class, and `prefers-color-scheme`
support is inconsistent enough that a dark email palette is its own project. Mirror `:root`, ignore
`.dark`, and say so in a comment so the next reader does not think it was forgotten.

### 3.3 The receipt tokens are already theme-fixed — reuse them, do not re-derive

`--receipt-*` is deliberately absent from `.dark` because a Sec 44(6) receipt is black ink on white
paper in every theme. That makes it the one group already shaped for print and email. The emailed
receipt should mirror `--receipt-*`, not the tone palette.

### 3.4 Mirror semantics, not every grey

Only values that *claim to be the brand* need parity: the seven tones, the brand surface colours, and
the receipt group. An email-structural grey — a table rule, a footer divider — carries no brand
meaning and can stay literal. Over-reaching here converts a real fix into 64 mechanical edits with no
reviewer able to say which mattered.

### 3.5 One module, imported twice

`settings.ts` must import the mirror, not re-copy it. That is the actual defect in §1.3, and it is
the part that will silently come back if the fix is "update both files".

---

## 4. Step plan

1. **Add the oklch → hex converter.** Dependency-free, in the test tier first if it is only needed by
   the guard, or in `src/lib/presentation/` if the mirror is generated at build time. Unit-test it
   against known pairs before trusting it — a wrong converter makes every parity assertion below
   agree with itself and enforce nothing.
2. **Create the mirror module**, exporting hex for the seven tones' light `surface` / `text` /
   `solid` / `on-solid`, the brand surface values, and the `--receipt-*` group.
3. **Replace the 64 inline hex in `email.ts`** with references to it, mapping the four badge classes
   onto `success` / `warning` / `danger` / `info` and adding `care` / `neutral` / `highlight`.
4. **Make `settings.ts` import the mirror** and delete its eight copies.
5. **Guard it**, as a new assertion in `designSystemGuards.test.ts`:
   - every value in the mirror equals the computed hex of the `globals.css` token it claims to
     mirror — this is the assertion that makes the whole thing hold;
   - the two exempt files contain no hex that is not in the mirror, tightening `HEX_ALLOWED` from a
     blanket exemption to a bounded one;
   - every tone has an email badge, so a new tone cannot be added app-side and silently fall back to
     sky in the inbox.
6. **Verify each assertion bites** before committing: change one mirror value by one digit, delete a
   badge mapping, put a raw hex back in `settings.ts`.
7. **Update `docs/design-system.md` §1.3**, which currently says these two files "keep literal hex"
   — after this it is "these two files use the hex mirror".

---

## 5. Acceptance criteria

1. `npm test` green, with the parity assertions added to the Tier-2 group.
2. `npx tsc --noEmit` clean; `npm run lint` no new problems.
3. **Every new assertion is verified to bite**, by injection, as in the predecessor.
4. `src/actions/settings.ts` contains zero literal hex.
5. Failure messages name the offending token and the expected value, not a count.
6. No new dependency, no config change.
7. A rendered check of at least the receipt email and one status email, so the parity is confirmed by
   eye and not only by arithmetic. Contrast is *not* asserted here — see §6.

---

## 6. Out of scope

- **Contrast assertions.** Still worth their own target, and now cheaper still: the converter landed
  in `tests/support/oklch.ts`, and WCAG relative luminance is a few lines on top of its linear-sRGB
  step.

  **Measured 2026-08-28**, off the rendered emails, so the numbers are no longer a guess:

  | Pairing | Ratio | |
  |---|---|---|
  | body copy on the message card | 16.28:1 | AAA |
  | all seven tone badges (`text` on `surface`) | 6.84 – 14.27:1 | AA / AAA |
  | receipt ink, body, values on paper | 7.72 – 17.72:1 | AAA |
  | receipt labels (`--receipt-ink-faint`) on paper | 4.83:1 | AA |
  | receipt total (`--receipt-ink-accent`) on paper | 5.36:1 | AA |
  | footer fine print on muted | 6.70:1 | AA |
  | **`--primary-foreground` on `--primary`** | **3.00:1** | **below AA for body text** |

  Everything clears AA except the last, and that one is **not an email defect** — it is the app's own
  token pair. `button.tsx` renders `bg-primary text-primary-foreground` at `text-xs` (12px) semibold,
  which is the same 3.00:1 below AA's 4.5:1. In the email it affects the `.btn-track` label (14px
  bold); the header band is 20px bold and so clears AA's 3:1 large-text threshold.

  Deliberately **not** "fixed" here: the email mirrors the token, and picking a different colour for
  the button would break the parity this task exists to establish while leaving the app unchanged. The
  fix belongs in `globals.css` — darken `--primary`, or give solid controls a darker foreground — and
  it changes every button in the app, so it is a design decision (`docs/design-system.md` §9.4), not a
  drive-by edit. This also retires the claim §8 of the design-system doc was hedging: the tone badges
  are genuinely AA-or-better; the primary button is not.
- **Dark-mode email.** §3.2.
- **`.tone-chip` metrics.** Not mechanically detectable; belongs to the component / visual-regression
  tier.

### 6.1 Known gaps left behind by `da81c1b`

Recorded here so they are not rediscovered from scratch:

- ~~**`docs/design-system.md` §5–§9 are unaudited.**~~ **Closed by `10065ca`.** They were audited and
  §5 was found to be describing a materially different application — inputs documented as boxed and
  rounded are in fact underlines with no radius, buttons had 6 variants and 8 sizes rather than the
  documented 3 and 3, cards use a ring rather than a border, the navbar has no gradient, and §6
  listed a favicon that does not exist. All four implementation links were 404ing. Nothing remains
  open here; §8's contrast claim was downgraded to an unverified target that points back at §6 of
  this document.
- **The guard's documented soundness leaks**, all commented in the test file: an all-lowercase prose
  string could mark a shell used; a class list written in single quotes is invisible to the scanner;
  a class name composed at runtime (`` `tone-${x}` ``) is invisible. Each weakens the "unused class"
  assertion only — none can produce a false alarm.
- **`AuditLogViewer.tsx:58`** carries `hover:bg-success-surface` on an element that is already
  `tone-soft tone-success` — a hover to the colour it already is. Pre-existing, cosmetic.

---

## 7. ⚠️ Coordination — this branch has concurrent writers

Still true, and still biting. During the predecessor task the tree moved four commits forward
unprompted and the shared git index was found holding **15 staged renames** belonging to the other
session.

- **Check `git diff --cached --name-only` in its own tool call before composing a commit.** The index
  is shared and is routinely non-empty.
- **Commit with a pathspec**: `git add -- <paths>` then `git commit -F <msg> -- <the same paths>`.
  A pathspec commit records only the named paths and ignores the rest of the index, so the other
  session's staged work stays staged. This is how `da81c1b` was landed cleanly. Do **not** build the
  commit in a private `GIT_INDEX_FILE` — the shared index would then hold pre-commit blobs for your
  paths and the other session's next commit would stage a silent revert of your work.
- **At the time of writing**, `src/lib/security/adminSession.ts` is modified but uncommitted
  (+87/−8): `verifyAdminSession` now returns a principal instead of a boolean, and
  `tests/unit/softDeleteAndAuth.test.ts` has not caught up, so **`npm test` is red in the working
  tree with 5 failures that belong to that work**. `HEAD` is green. Re-run the baseline before
  assuming a failure is yours.
