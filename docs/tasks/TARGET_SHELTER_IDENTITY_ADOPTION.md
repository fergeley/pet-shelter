# Target — Shelter Identity Adoption

**Date**: 2026-08-26
**Branch**: `feat/tnrm-rehabilitation`
**Baseline**: 36 test files / 454 tests green · `npx tsc --noEmit` clean · `npm run build` passes
**Predecessor commit**: `4c9d3f2 docs: link PLAN_LIB_RESTRUCTURE in docs index`

> **Scope**: this document records **P8** — the *adoption* half of **P2**, which both open handoffs
> list. P2 asks which ROS registration number is correct; that question is **blocked on a stakeholder
> reading the physical certificate** and stays blocked here. P8 is the part that is not blocked:
> making the answer, when it arrives, land everywhere at once.
>
> Found while picking the next target after
> [Admin Status Parity](TARGET_ADMIN_STATUS_PARITY.md) — the same defect class (one fact, many
> copies, no single source), one tier up in consequence.

---

## 1. 🔴 Why this is the next target

Every line number below was read from the source on the date above.

`src/lib/domain/shelterIdentity.ts` (81 lines) already exists and is *correct*. It declares the
statutory identifiers, refuses to guess which ROS variant is right, documents how to close P2 in one
edit, and exposes `currentIssuerIdentity()` to stamp receipts. Nothing about it needs designing.

**It has one importer.**

```
src/actions/donations.ts:12   import { currentIssuerIdentity } from "@/lib/domain/shelterIdentity";
```

That one site is the right one — it is the path that writes a `Donation` row, and the schema
snapshots `taxDeductibleRef` / `shelterRegistrationNo` onto the row (`prisma/schema.prisma:281-282`),
so issued receipts are immutable. Everything else still carries a literal:

| Literal | Occurrences outside the module | Where |
|---|---|---|
| `PPM-012-10-18042016` (public) | 13 | `donate/page.tsx:168`, `get-involved/page.tsx:207`, `privacy/page.tsx:39`, `terms/page.tsx:39`, `DonationWidget.tsx:456`, `Footer.tsx:129`, `HomeSections.tsx:330`, `translations.ts:416,627,699,767,978,1050` |
| `PPM-021-10-18082021` (statutory) | 4 | `SponsorshipModal.tsx:296`, `exportCsv.ts:224`, `exportCsv.ts:257`, `sponsorshipStore.ts:85` |
| `LHDN.01/35/42/51/179-6.4912` | 11 | `donate/page.tsx:108,109`, `terms/page.tsx:86`, `DonationWidget.tsx:229,481`, `SponsorshipModal.tsx:321`, `exportCsv.ts:223,256`, `translations.ts:655,1006`, `sponsorshipStore.ts:84` |

**28 literals across 11 files.**

### The consequence is worse than duplication

The module's escape hatch is an environment variable:

```ts
export const STATUTORY_ROS_REGISTRATION_NO =
  process.env.ROS_REGISTRATION_NO ?? "PPM-021-10-18082021";   // shelterIdentity.ts:49
```

Setting it changes **`donations.ts` and nothing else**. `exportCsv.ts:224` falls back to the literal
for any row lacking a snapshot, `exportCsv.ts:257` hardcodes it unconditionally for audit-derived
rows, and `sponsorshipStore.ts:85` mints its own receipt object with both identifiers inline. So the
configuration fix P2 is designed around produces a deployment that emits **two different registration
numbers from one codebase** — new donation receipts corrected, sponsorship receipts and ROS CSV
exports not. That is a worse failure than the current consistent-but-possibly-wrong state, because it
is invisible until somebody reconciles two documents.

`ROS_REGISTRATION_NO` is also **absent from `.env.example`**, so the hatch is undiscoverable.

| Defect | Location | Consequence |
|---|---|---|
| A second, uncentralised receipt issuer | `sponsorshipStore.ts:84-85` | Sponsorship receipts carry hardcoded identifiers `currentIssuerIdentity()` cannot reach |
| CSV export hardcodes the fallback | `exportCsv.ts:224,256-257` | ROS exports keep the old value after the constant is corrected |
| Public copy duplicated 13× | 7 components/pages + 6 dictionary entries | The public number can drift from the module with no test noticing |
| Env override reaches 1 of 4 statutory sites | `shelterIdentity.ts:49` | The documented "ship as a configuration change" path silently half-applies |

### The guard test does not exist

`shelterIdentity.ts:24-26` states:

> `tests/unit/shelterIdentity.test.ts` asserts the divergence is still deliberate, so it will fail and
> point at this comment when they are unified — delete that assertion as part of the same change.

There is no such file. The safety net the module tells its next reader to rely on is fictional, which
is the specific reason this is a target rather than a cleanup: as written, the file reads as though
P2 is already contained.

What *does* pin the statutory value today is two behavioural suites asserting it as a string literal —
`donations.test.ts:103-104` and `exportCsv.test.ts:56-57,70-71`. They will fail when the constant
changes, which is useful, but they assert a *fact about the NGO* from inside tests about receipt
shape and CSV columns. They should assert against the constant, so that the day P2 closes exactly one
test fails and it is the one whose message says the divergence was deliberate.

---

## 2. What already exists to reuse

| Module | Provides |
|---|---|
| `src/lib/domain/shelterIdentity.ts` | `LHDN_TAX_DEDUCTIBLE_REF`, `STATUTORY_ROS_REGISTRATION_NO`, `PUBLIC_ROS_REGISTRATION_NO`, `SHELTER_LEGAL_NAME`, `StatutoryIssuerIdentity`, `currentIssuerIdentity()` |
| `LanguageProvider.t()` | Interpolation already supported — `t(path, { regNo })` replaces `{regNo}` via the `interpolationParams` branch |
| `tests/unit/layerBoundaries.test.ts` | The precedent for a repo-wide source scan: walks `src/`, asserts a structural property of the tree. A "no statutory literal outside the module" guard is the same shape |
| `tests/unit/i18n.test.ts` | Key-parity guard over both dictionaries — interpolating the number must not disturb it |

There is **no** `ShelterSettings` registration field (`settingsStore.ts` has none), so the handoff's
"ideally sourced from `ShelterSettings`" is not an available option today. `shelterIdentity.ts` is
the answer, and it is already written.

---

## 3. ⚠️ The one real decision

**How do the six dictionary entries get the number?** They embed it inside display copy, and the
prefix is translated while the number is not:

```ts
rosBadge: "ROS Reg: PPM-012-10-18042016",   // en, translations.ts:416
rosBadge: "No. ROS: PPM-012-10-18042016",   // ms, translations.ts:767
```

- **(a) Interpolate.** `rosBadge: "ROS Reg: {regNo}"` in both dictionaries; call sites pass
  `t("…rosBadge", { regNo: PUBLIC_ROS_REGISTRATION_NO })`. The dictionary then holds *copy* and the
  module holds the *fact* — which is what `CLAUDE.md` already asks of the dictionary. Costs six entry
  edits plus their call sites.
- **(b) Leave the literals, add a parity test** asserting every entry contains
  `PUBLIC_ROS_REGISTRATION_NO`. Cheaper, and drift becomes loud rather than silent — but the number
  still lives in seven places, so "correct it in one edit" stays false.

**(a) is recommended.** A registration number is not copy; it is a fact that happens to appear inside
copy. (b) leaves P2's promise unfulfilled and adds a test whose only job is to notice that.

A second, smaller call: `SponsorshipModal.tsx:296` and `sponsorshipStore.ts:85` use the **statutory**
variant today. Keep that — they are receipt-shaped output — and route them through
`currentIssuerIdentity()` so they cannot drift from the real issuer. Whether a `localStorage` store
should be minting receipts at all is a separate question; see §6.

---

## 4. Step plan

1. Resolve §3.
2. **Write `tests/unit/shelterIdentity.test.ts` first.** It is named in the module's own docblock and
   is the artifact that makes the eventual P2 fix safe. It should assert: the two ROS constants are
   still deliberately different (with a comment pointing here); `currentIssuerIdentity()` returns the
   statutory variant and not the public one; and a **source scan**, modelled on
   `layerBoundaries.test.ts`, that no `PPM-` or `LHDN.` literal appears anywhere under `src/` except
   `shelterIdentity.ts`. That last assertion is what makes this target stay fixed.
3. Adopt at the four statutory sites — `exportCsv.ts:223-224,256-257`, `sponsorshipStore.ts:84-85`,
   `SponsorshipModal.tsx:296,321`. Prefer `currentIssuerIdentity()` over the raw constants wherever a
   value is being stamped onto something receipt-shaped.
4. Adopt at the seven public sites, then the dictionary per §3.
5. Repoint `donations.test.ts:103-104` and `exportCsv.test.ts:56-57,70-71` at the constants instead of
   string literals.
6. Document `ROS_REGISTRATION_NO` in `.env.example` alongside the other deployment-time values.

Steps 2–3 are the correctness work — they are what stops a corrected number from half-applying.
Steps 4–6 reduce the blast radius and can land separately.

---

## 5. Acceptance criteria

- No `PPM-` or `LHDN.` literal exists under `src/` outside `src/lib/domain/shelterIdentity.ts` —
  **asserted by a source scan**, not by review.
- Setting `ROS_REGISTRATION_NO` changes every statutory surface at once: donation receipts,
  sponsorship receipts, and both CSV export paths. Assert it by reading the constant in the tests
  rather than by hardcoding the expected string.
- `PUBLIC_ROS_REGISTRATION_NO` and `STATUTORY_ROS_REGISTRATION_NO` are still two constants with two
  values, and one test says so deliberately. **Do not unify them in this change** — that is P2, and it
  needs the certificate.
- `tests/unit/i18n.test.ts` still passes; key parity is unaffected by interpolation.
- Output is byte-identical before and after. This change has no user-visible effect, and that is the
  point — it is what makes it cheap to verify.
- `npx tsc --noEmit` clean, `npm run test:all` green, `npm run lint` no new warnings, `npm run build`
  passes.

---

## 6. Out of scope

- **Deciding which ROS number is correct.** That is P2, blocked on the physical certificate. This
  target preserves both values byte-for-byte on purpose.
- **Whether `sponsorshipStore` should mint receipts client-side at all.** It is a `localStorage` store
  (`CLAUDE.md`: client stores are "admin/demo UI only") issuing something receipt-shaped with statutory
  identifiers on it. Worth a conversation; not this change.
- **`SHELTER_LEGAL_NAME` adoption.** The name is not disputed and does not reach statutory output the
  way the numbers do. Fold it in only if it comes free.
- **P6 / [`PLAN_LIB_RESTRUCTURE`](PLAN_LIB_RESTRUCTURE.md).** Unrelated, and its stated precondition
  (`git status --porcelain` empty) is false again as of this writing. Worth noting that its Phase 2
  moves `exportCsv.ts` and `sponsorshipStore.ts`: doing this target first is cheaper, since the edits
  here are small and the moves there are mechanical.

---

## 7. State at 2026-08-27 — partially overtaken

Work landed on this target while §1–§6 above were being written, in `6c6d6d5` /
`2f1257e`. §1 records the state as found; this section records what is left. Where the
two disagree, this section is current.

**Landed:**

| Item | Evidence |
|---|---|
| `exportCsv.ts` adopted | Imports the constants; `:227-228` read `LHDN_TAX_DEDUCTIBLE_REF` / `STATUTORY_ROS_REGISTRATION_NO` instead of literals |
| `tests/unit/shelterIdentity.test.ts` written | 7 tests: the three constants, the deliberate P2 divergence, correction-by-configuration, and `currentIssuerIdentity()` snapshot semantics |
| `donations.test.ts` partly repointed | Imports `STATUTORY_ROS_REGISTRATION_NO` (`:7`) but still asserts the literal at `:106` and `:165` |

**Still open — and the open half is the durable half:**

1. **No source scan.** The new suite has zero `readFileSync`/`readdirSync` references. It proves the
   constant is overridable; nothing proves the call sites read it. §4 step 2 exists precisely because
   this assertion is what stops the target from decaying, and it is the piece not yet written.
2. **The second receipt issuer is untouched** — `sponsorshipStore.ts:84-85` still inlines both
   identifiers, and `SponsorshipModal.tsx:321,346` still renders literals. `ROS_REGISTRATION_NO`
   therefore *still* half-applies: donation receipts and CSV exports would pick up a correction,
   sponsorship receipts would not. The mixed-identifier failure in §1 is narrowed, not closed.
3. **All public copy is unchanged** — `donate/page.tsx:110,111,170`, `get-involved/page.tsx:207`,
   `privacy/page.tsx:39`, `terms/page.tsx:39,86`, `DonationWidget.tsx:343,654,695`,
   `Footer.tsx:129`, `HomeSections.tsx:330`, and `translations.ts:416,627,655,699,767,978,1006,1050`.
4. **`exportCsv.test.ts:56-57,70-71`** still pins string literals.
5. **`.env.example`** still does not document `ROS_REGISTRATION_NO`.

**24 literals across 10 files.** §3's decision is unchanged and still unmade; §5's acceptance
criteria are unchanged. Note that `Footer.tsx:129` carries its literal inside a `t()` *fallback*
argument — `t("footer.rosReg", "ROS Reg: PPM-…")` — so the interpolation work in §3(a) has to cover
fallbacks as well as dictionary entries, or the scan in step 2 will still find them.

### 7.1 Landed — 2026-08-27

All 24 sites adopted. §3 resolved as **(a)**: the dictionary holds copy with `{regNo}` / `{taxRef}`
placeholders, and the constants are passed at the three call sites (`donations.rosBadge`,
`footer.rosReg`, `donations.receiptSubtitle`). `common.rosBadge` had no call site at all — a dead
entry, left in place and interpolated for consistency.

| Work | Detail |
|---|---|
| Source-scan guard | `shelterIdentity.test.ts` — walks `src/`, fails listing every `file:line` carrying a `PPM-` or `LHDN.` literal outside the module. This is the assertion that makes the target stay fixed |
| Statutory surfaces | `sponsorshipStore.ts` now spreads `currentIssuerIdentity()`; `SponsorshipModal` reads the constants |
| Public surfaces | 7 pages/components + 8 dictionary entries |
| Tests repointed | `exportCsv.test.ts`, `donations.test.ts` assert via the constants, so closing P2 fails exactly one test — the one that explains the divergence |
| `.env.example` | `ROS_REGISTRATION_NO` documented, with its server-only scope stated |

**The env override cannot reach client components.** `SponsorshipModal` and `sponsorshipStore` are
`"use client"`, and Next.js inlines only `NEXT_PUBLIC_*` into the client bundle, so
`process.env.ROS_REGISTRATION_NO` is `undefined` there and the module default applies. Correcting P2
by configuration therefore fixes server-issued receipts and ROS exports but *not* the client-rendered
sponsorship receipt, which needs the constant itself edited. Recorded in the module docblock rather
than worked around — renaming to `NEXT_PUBLIC_*` trades a config path for putting a statutory
identifier in the browser bundle, and that is a call for whoever closes P2.

**On §5's "byte-identical output":** rendered *text* is unchanged, verified against the production
build. The *markup* is not quite: React emits `<!-- -->` separators where a literal became a JSX
expression, so `Selangor (PPM-012-10-18042016)` is now
`Selangor (<!-- -->PPM-012-10-18042016<!-- -->)`. Invisible, inert, and standard React. Worth noting
that the dictionary path has no such artifact — `t()` returns one interpolated string, so the footer
is byte-identical. Contorting JSX into `{"…" + CONST + "…"}` to chase byte-identity in generated HTML
would trade readable source for nothing.

**Verification**: `npx tsc --noEmit` clean · `npm run test:all` 40 files / 516 tests green ·
`npm run lint` 0 errors · `npm run build` passes · no `{regNo}` or `{taxRef}` placeholder reaches any
prerendered page.

**Still open**: P2 itself. The two constants remain deliberately divergent, one test says so on
purpose, and the certificate is still unread.
