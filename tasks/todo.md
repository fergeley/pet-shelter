# FAQ & Rehab Needs category tabs → the derived server catalogs

Executing `docs/tasks/TARGET_RESTRUCTURE_FOLLOWUPS.md` §1, dispatched as `/fix-category-tabs`.
Branch `feat/tnrm-rehabilitation`. Landed `5832244`.

## Critique of the brief as given

The brief was accurate about the shape of the work and wrong in four checkable places. Recorded
because three of them would have shipped a defect.

- [x] **Its `"all"` tab is wrong for one of the two components.** The brief states both lists open
      with `{ value: "all", labelEn: "All Topics", labelMs: "Semua Topik" }`. `RehabNeedsSection`
      actually had `"All Wishlist Items"` / `"Semua Barangan Keperluan"`. Prepending the brief's
      literal tab to both would have silently relabelled the wishlist — exactly the quiet breakage
      the brief's own trap 4 exists to prevent. Each component now prepends its own.
- [x] **The framing — dead tabs — is not the defect that was present.** Both hardcoded *sets*
      already matched the fixture: 5 FAQ topics, 4 need categories, same values, same
      first-appearance order. What had drifted were **7 of the 9 labels**. So the visible diff is a
      relabel, not a retab. The readers still earn their place: they make a dead tab
      *unexpressible*, rather than fixing one that existed.
- [x] **Trap 1 understates its own guard.** `tests/unit/layerBoundaries.test.ts` matches import
      *specifiers*, so `import type ... from "@/lib/server/..."` trips it too.
      `ReturnType<typeof getServerFaqCategories>` was therefore never available, not even as a
      types-only shortcut. Confirmed by injecting that import and watching the guard go red.
- [x] **The stated baseline names the wrong suite.** "41 files / 524 tests" is `npm test` (unit
      only), not `npm run test:all`. Measured on this tree: unit 44 files / 583 tests, `test:all`
      52 files / 678 tests.

## Work

- [x] `src/lib/presentation/categoryTabs.ts` — `CategoryTab`, `DerivedCategory`,
      `ALL_CATEGORY_VALUE`, `withAllTab()`. The tab shape has to live somewhere both a Server
      Component and a `"use client"` component may reach, and `presentation/` is that place. It
      also stops this list being authored twice, which is what produced the drift above.
- [x] `src/app/pets/page.tsx`, `src/app/needs/page.tsx` — `getServerFaqCategories()` /
      `getServerRehabCategories()` passed down as `initialCategories`, riding the same prop channel
      as the `initialFaqs` / `initialNeeds` already there. No Server Action added.
- [x] Both components accept `initialCategories`, prepend their own `"all"` tab, and use
      `ALL_CATEGORY_VALUE` for the sentinel in place of four bare `"all"` literals each.
- [x] Neither client component imports `@/lib/server/*` in any form.

## Review

Verified green: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors (5 pre-existing warnings in
`PetDataTable` / `PetFormDialog`, none in changed files) · targeted trio
(`faqs` / `rehabNeeds` / `layerBoundaries`) 59/59 · `npm test` 583/583 · `npm run test:all` 678/678.

Verified by execution, not inspection:

- **The guard really does stop this.** Injected
  `import type { FaqCategory } from "@/lib/server/faqCatalog"` into `PetsFaqSection` and watched
  "keeps the repository layer out of the browser bundle" fail naming that exact edge, then reverted.
  A type-only import is not a loophole.
- **My change alone is green.** `npm run test:all` in the shared tree showed 6–11 failures in
  `petHistory` / `rehabilitation`, which belong to the concurrent `/fix-admin-session` stream. Rather
  than assume, I built a detached worktree at HEAD, copied in only my five files, and ran the full
  three-project suite there: **51 files / 640 tests, all passing**. The failures were never mine, and
  the concurrent session has since resolved them.
- **Both strips render.** Fetched `/pets` and `/needs` from the running dev server. The FAQ strip
  renders `All Topics · TNRM & Coexistence · Sponsorship & Donations · Adoption & Fostering ·
  Visiting & Shelter Guidelines · Get Involved & CSR`; the wishlist renders `All Wishlist Items ·
  Urgent Needs · Regular Needs · Long-term Improvements · TNRM Equipment`. On both, the `"all"` tab
  carries the active classes and the others do not.
- **No tab is dead, and `"all"` still means all.** A throwaway probe drove every rendered tab value
  through its catalog filter: FAQ 3/2/1/1/1 of 8, needs 3/3/2/3 of 11, and `"all"` returns the full
  8 and 11. Run in the worktree so it could not be swept into the other session's `git add -A`.

Not done, and deliberately: `docs/architecture/LAYERS.md:316` still says `faqs.json` and
`rehabNeeds.json` have "no reader and no action" and that `PetsFaqSection` hardcodes FAQ arrays
inline. Both halves were already stale before this change — the readers and `getFaqsAction` exist,
and that component has never held a FAQ array. It also talks about the donate page, which is a
separate hardcoding. Correcting it is a doc job with its own scope, not a rider on this one.

## Landed

`5832244` — 5 files, committed with `git commit -F <msg> -- <the five paths>`. The concurrent
session had ten modified and four untracked files in the tree throughout, including a new
`src/lib/presentation/emailTokens.ts` beside my new module; the pathspec kept all of it out.

---

# Previous stream — Live Postgres verification & schema integrity audit

Executing `docs/tasks/TARGET_SCHEMA_TYPE_INTEGRITY.md` §2 (the standing "never verified against real
Postgres" gap) plus §3 P-E. Branch `feat/tnrm-rehabilitation`.

## Critique of the brief as given

The brief's own steps could not be run as written. Recorded here because the reasoning is the
deliverable, not just the fix.

- [x] **`npm run db:push` targeted Neon production, not localhost.** `prisma.config.ts` loaded
      `.env.local` first, and that file carries a Neon URL with `NEON_BRANCH=production`. The brief
      also asked for `.env.local` to be rewritten — it holds live credentials and must not be
      touched by tooling.
- [x] **`db:push` and `db:seed` resolved different databases.** The seed used `import "dotenv/config"`
      (loads `.env` only; this repo has none), so it fell through to a hardcoded localhost default
      while the push went to Neon. Both exit 0. A green pair proving nothing.
- [x] **An integration probe would have run in memory.** `isLedgerPersistent()` keys off
      `DATABASE_URL`, but `src/lib/server/prisma.ts` falls back to a hardcoded localhost URL, so with
      the variable unset the ledger silently takes its in-memory branch and every assertion passes.
- [x] **`recordDonationReceipt()` does not exist** — the export is `issueDonationReceipt()`.
- [x] **`AdoptionApplication.petName` is documented in §3 P-E, not §2**, and P-E is explicitly
      "model comments only", not an audit.
- [x] **`npm run test:integration` proved nothing** — one file asserting an env var is set.

## Work

- [x] `prisma/env.ts` — one resolver for the CLI and the seed, so they cannot diverge again
- [x] Seed refuses a non-local target (`ALLOW_REMOTE_SEED=true` to override)
- [x] `db:up`, `db:down`, `db:push:local`, `db:seed:local`; `test:db` pinned to localhost
- [x] Tier 3b `integration-db` vitest project — fails rather than skips without a database, and is
      kept out of `test:all` so the no-Docker baseline stays honest
- [x] `donationLedger.postgres.test.ts` — rollback, unique index, 8-way concurrency, integer sen
- [x] `schemaIntegrity.postgres.test.ts` — `rehab*` columns and the two tables were really pushed;
      fixtures round-trip
- [x] Probes refuse a non-local host before opening a connection
- [x] P-E model + field comments on `AdoptionApplication` and `AuditLog`
- [x] Stale `src/lib/donationLedger.ts` / `src/lib/userStore.ts` paths corrected
- [x] `TARGET_SCHEMA_TYPE_INTEGRITY.md` §2.1 / §2.2 / §5 / §6 / §8 updated
- [ ] **BLOCKED** — `npm run db:up && npm run db:push:local && npm run db:seed:local && npm run test:db`

## Blocker

WSL2 is broken on this machine: every `wsl` call returns
`Wsl/CallMsi/Install/REGDB_E_CLASSNOTREG`. Docker Desktop's only context is `desktop-linux`, which
requires it, and there is no native Postgres on the host. Repair needs an elevated shell
(`wsl --update`) and a Docker Desktop restart; Windows 11 Home rules out the Hyper-V backend.

## Review

Verified green: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test` 537/537 ·
`npm run test:all` 538/538.

Verified by execution, not inspection:

- `npm run db:seed` against the real `.env.local` **refuses**, naming the Neon production host.
- `vitest --project integration-db` with a Neon-shaped URL **refuses** before connecting.
- `npm run test:db` with no database **fails** with exit 1 and an actionable message — it does not
  skip.

The Tier-3b suites have never been run green. They are written and wired; the claim being made is
"the harness exists and fails correctly when the database is absent", not "the ledger is verified
against Postgres". That second claim stays open until the blocker above is cleared.

## Landed

`bde0095` — 14 files, committed with a pathspec (`git add -- <paths>` then
`git commit -F <msg> -- <the same paths>`) so the concurrent session's 15 staged archive renames
stayed in the index rather than riding along.

Deliberately **not** committed: `package.json`, `vitest.config.mts`, `docs/README.md`. All three
carry both sessions' edits, and the other half of each references files that were still untracked
(`tests/setup/componentSetup.ts`, `integrationEnv.ts`) or only staged (the archive moves).
Committing them would have produced broken references. Consequence: the `test:db` / `db:*:local`
scripts and the `integration-db` project block are not in `bde0095` — they land with that session's
next commit. The Tier-3b tests are safe in history either way; they simply are not collected until
the config does.

`npm run test:integration` verified green afterwards (4 files / 40 tests) — confirming the
single-level glob narrowing did not orphan the three Tier-3a suites that session added at that path
while this work was in flight.

---

# Closing the non-production admin pet mutation bypass

Executing `docs/tasks/URGENT_NONPRODUCTION_ADMIN_BYPASS.md`. Branch `feat/tnrm-rehabilitation`.

Appended rather than replacing the section above: that stream's blocker is still open and a
concurrent session owns the record.

## Critique of the brief as given

- [x] **The brief's "seal a session per suite *or* a shared helper" was a false choice, and both
      horns were blocked by something it did not mention.** Both failing suites declared their own
      `vi.mock("next/headers", ...)` returning `get: () => undefined`. A file's own `vi.mock` beats
      the setup file's, so *any* cookie-seeding approach was inert until those local doubles were
      deleted. An author who dropped in a helper, saw no change, and reached for the nearest fix
      would have landed exactly on the forbidden `vi.mock("@/lib/security/adminSession")`.
- [x] **"A third file will want it tomorrow" understated it — a third file already had one.**
      `tests/integration/rbacAuthorization.test.ts` carried a private `signInAs(role)`. Adding a
      shared helper beside it would have created the divergence the helper exists to prevent, so it
      was migrated too.
- [x] **The brief made eleven tests authenticate but never asserted the hole was shut.** Green tests
      prove the *authorized* path; nothing in the brief's steps fails if the bypass returns. That
      guard was the missing deliverable.
- [x] **`UnauthorizedError`'s default message is user-facing.** All five actions catch and return
      `err.message`, which reaches admin UI toasts. The typed error was adopted; the message was
      kept verbatim so a security fix did not smuggle in a UX change.

## Work

- [x] `getAdminActorOrThrow()` throws unconditionally — `UnauthorizedError`, message unchanged
- [x] `DEV_BYPASS_PRINCIPAL` and the `"dev-bypass"` `AdminAuthMethod` member deleted, and the prose
      that described them rewritten rather than left to rot
- [x] `tests/setup/authSession.ts` — `signInAs` / `signInAsAdmin` / `signOut` / `TEST_ADMIN_ACTOR`,
      going through the real `setSessionCookie()`, so a test authenticates as the login action does
- [x] Both failing suites: local `next/headers` + `next/cache` doubles removed in favour of the
      harness, one `await signInAsAdmin()` per suite, duplicate `mockAdminActor` fixtures folded
      into `TEST_ADMIN_ACTOR`
- [x] `rbacAuthorization.test.ts` migrated off its private copy
- [x] `LEGACY_ADMIN_TOKEN_PRINCIPAL` untouched, as instructed

## Review

Written test-first, against the vulnerable code, so the guard is known to detect the hole rather
than assumed to: the new `Unauthenticated pet mutations are refused` block failed **6 of 7** before
the fix, and its audit assertion read `expected 4 to be 1` — three rows written by a caller who had
proved nothing.

Baseline re-established before starting: 43 files / 545 tests, matching the brief. After: 44 / 582.
The extra file and 30 of the extra tests are the concurrent session's `tests/unit/oklch.test.ts`;
7 are this work.

Verified green: `npx tsc --noEmit` 0 errors · `npm run test:unit` 44 files / 582 tests ·
`npm run test:all` 52 files / 677 tests.

Verified by execution against a running `next dev` (`NODE_ENV=development` — the exact condition the
bypass keyed on), with no session cookie and no `admin_session` cookie. Server Action ids were read
from `.next/dev/server/server-reference-manifest.json` and POSTed directly, since a Server Action is
a network-reachable endpoint whether or not a UI calls it:

- Five distinct pet-mutation action ids each returned
  `{"success":false,"error":"Unauthorized: Admin authorization required"}`.
- The catalogue was then re-read: `pet-001` still public and still `Available`, no `Bypass Probe`
  record created, nothing marked `Adopted`. The refusals wrote nothing.

Not demonstrated on the dev server: the "before" behaviour. Reproducing it would have meant
reinstating the bypass in a working tree that a concurrent session commits with `git add -A`. The
before/after control comes from the test run instead, which is where it belongs.

---

# The tax receipt stated two different payment rails

Executing `docs/tasks/URGENT_RECEIPT_EMAIL_CORRECTNESS.md`. Branch `feat/tnrm-rehabilitation`.
Landed `98e8a97`.

Appended rather than prepended: two other streams own the sections above and one of them is still
open.

## Critique of the brief as given

The brief was right about the defect and about its root cause. Four things in it needed correcting,
and one of them would have shipped a guard that did not guard.

- [x] **Keying the exhaustive mapping off the zod enum would have been decorative.** §3 asks for
      `Record<PaymentMethod, string>` next to a §1 that introduces `paymentMethod` as
      `z.enum([...])` from `src/lib/validations/donation.ts:12`. But the templates render a
      `DonationReceipt`, and that union is spelled out **five** times in this repo:
      `types/sponsorship.ts:26`, `lib/server/donationLedger.ts:56`,
      `lib/client/sponsorshipStore.ts:56`, and `lib/validations/donation.ts` twice — the enum at
      line 12 and a hand-written copy at line 64. A record keyed off the enum compiles green while
      the rendered field drifts. `PaymentMethod` is therefore `DonationReceipt["paymentMethod"]`:
      the exact union the code below it renders.
- [x] **The brief missed a second wrong number on the same receipt.** `RM ${amountMYR}.00` was
      string concatenation, so an RM 250.50 donation was receipted as **"RM 250.5.00"** — both
      halves and the subject line. Not in §1, not in §3; found while consolidating the amount into
      the shared object. Fixed with `toFixed(2)`.
- [x] **"(Maybank)" was the same defect as the card bug, one line up.** §1 treats the
      `online_banking` row as correct in the plain text and only wrong in the HTML. The receipt DTO
      carries no bank field, so the plain-text half was naming a bank it could not know — an
      unverifiable claim on a document filed with LHDN. The label is now "Direct Bank Transfer" with
      no bank named.
- [x] **§4's guard check runs the wrong way round.** It asks for proof that the build fails when a
      value is *removed* from the enum. The failure that matters is a value being *added* — that is
      the case that used to fall through to "Direct Bank Transfer" silently. Proved in that
      direction: a fourth rail on the union produced `src/lib/email.ts(568,7): error TS2741`, then
      reverted.

Everything else in §1 checks out against `98e8a97^`, line references included: the plain-text
ternary at 568, the donor message at 569, and the two-branch HTML ternary at 616.

## Work

- [x] `src/lib/email.ts` — one `fields` object above both templates carrying the formatted amount,
      the frequency label, the payment rail and the four optional rows. Neither half re-derives a
      value.
- [x] `PAYMENT_RAIL_LABELS: Record<PaymentMethod, string>` replaces both ternaries. DuitNow settled
      as "DuitNow QR (PayNet)" — PayNet's actual product name, with both invented variants gone —
      and `online_banking` as "Direct Bank Transfer".
- [x] `escapeHtml()` added beside `wrapEmailHtml()`; `receipt.notes` now renders in the HTML half,
      escaped. It is up to 500 characters of free text off a public form.
- [x] `tests/unit/email.test.ts` — for all three rails, both halves must contain the expected label
      and neither of the other two, plus the donor message present/absent, escaping, and a
      fractional amount.
- [x] Palette hex values untouched, per §5.
- [ ] The remaining four builders were audited read-only; nothing was fixed. Recorded as §8 of the
      task doc, not as done here.

## Review

Verified green: `npx tsc --noEmit` 0 errors · `tests/unit/email.test.ts` 15/15.

Verified by execution, not inspection:

- **The exhaustiveness guard bites.** A fourth rail added to `DonationReceipt["paymentMethod"]`
  produced `src/lib/email.ts(568,7): error TS2741` on the record literal, and was reverted. A
  ternary would have compiled.
- **The test detects the original defect and only that defect.** Reintroducing the two-branch
  ternary fails exactly the `card` case — not the DuitNow case, not the bank-transfer case. The
  assertion that earns its place is the negative one: each half must contain *neither of the other
  two* labels.
- **A human read all three.** One receipt per payment method rendered, plain text and HTML side by
  side. All three agree, which is the check arithmetic cannot make — §4 asked for it precisely
  because a wrong label is still a well-formed string.

One user-visible side effect, recorded rather than buried: the subject line for whole amounts moves
from `RM 250` to `RM 250.00`. That is `toFixed(2)` doing its job, and the alternative was keeping a
formatter that renders RM 250.50 as "RM 250.5.00".

## Follow-up left open

The audit of the other four builders (§8 of the task doc) found one builder with the same defect
shape and one systemic gap:

- `sendStaffApplicationAlert` renders the applicant's notes and the pet ID in the plain text and
  omitted both from the HTML. A separate stream is on it; if the builder already resolves a `fields`
  object above both halves, that has landed.
- `sendInterviewInvitationEmail` and `sendApplicationConfirmationEmail` are clean — the former
  already used the resolve-once pattern the receipt has now adopted.
- `sendApplicationStatusUpdateEmail` is asymmetric by design, but a plain-text reader of a REJECTED
  decision gets `Status: REJECTED` and none of the explanation. A content gap, not a contradiction.
- Every other free-text field (`applicantNotes`, `coordinatorNotes`, `currentPets`, `address`,
  `donorName`, `tierName`) still enters HTML unescaped. `escapeHtml()` now exists for whoever takes
  that on; it is one task across the file, and holding a statutory-document fix behind it would have
  been the same mistake as mixing in the palette.

## Landed

`98e8a97` — 2 files. This entry and the task-doc close-out are documentation only; no code changed
while writing them. `src/lib/email.ts` and `tests/unit/email.test.ts` were deliberately left out of
the doc commit's pathspec — a concurrent stream is editing both.
