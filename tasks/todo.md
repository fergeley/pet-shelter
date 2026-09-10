<!--
  This file still has the collision defect that `tasks/lessons.md` was split to remove on
  2026-09-09: one file, one append point, written by every concurrent session. A conflict here
  costs a pull request its whole CI run, because GitHub builds no merge commit for a conflicted
  PR — see `tasks/decisions/2026-09-09-lessons-become-one-file-per-lesson.md`.

  It was left as one file deliberately: these are work-stream write-ups with far less uniform
  structure than a lesson, so splitting them is its own task, not a ride-along. Until then,
  prepend a new stream at the top and do not reformat what is below it.
-->

# Dual-track pet catalogue — plan

**Branch:** `worktree-agent-4-animals` · opened 2026-09-08

## The finding that shaped this

`buildPetStatusFilterOptions` (`src/lib/presentation/petStatusPresentation.ts`) already exists,
is tested, and says in its own docstring that filter controls should derive their options from it
"rather than hand-listing them, which is how rehabilitation was omitted from the admin table's
status filter in the first place."

Only `usePetTableController` (admin) obeys it. The public `PetGallery` hand-lists three of the four
statuses and omits `Adopted` — the same defect, live, in the public catalogue. So this task is not
"build a catalogue"; it is **finish the abstraction the repo already built** and hang the track
split off it.

## Decisions

- **Pending belongs to the Adoptable track.** It is a stage of the adoption pipeline, not a third
  state. `PetDetailView` already renders it as "Adoption Pending" on the adopt button, so this
  makes the catalogue agree with the page it links to.
- **Adopted is its own track, not a hidden status.** Today an adopted animal appears under "All"
  with a *disabled* button labelled "Adopted" — the dead button `PetCard`'s own comment says it
  wanted to avoid. A track with no CTA removes it.
- **Tabs are derived from the population**, so a track with no animals renders no tab. Same
  contract `buildPetStatusFilterOptions` already keeps for counts.
- **Adopt stays a modal.** No `/adopt` route; `AdoptionForm` is unchanged.

## Items

- [x] 1. `petStatusPresentation.ts` — add `track` to the existing presentation record; derive
      `buildPetTrackOptions` / `matchesTrackFilter` from it. One field per status, no new module.
- [x] 2. `usePetGalleryController.ts` — collapse five copy-pasted filter slots into one declared
      spec, then add `gender` and `track` as data rather than as two more copies.
- [x] 3. `PetGallery.tsx` — track tab strip + gender select; status select stops hand-listing.
- [x] 4. `validations/pet.ts` + `actions/pets.ts` — `gender` filter.
- [x] 5. `actions/pets.ts` + `pets/[id]/page.tsx` — archived animals stop rendering publicly.
- [x] 6. `PetCard.tsx` — no CTA on the alumni track.
- [x] 7. `translations.ts` — track + gender labels, en and ms.
- [x] 8. `tests/unit/pets/petCatalog.test.ts`.

## Explicitly NOT done

- `src/lib/domain/petProfiles.ts` — **not created.** Its stated contents (progress, status badge)
  already live in `petStatusPresentation.ts`. Creating it would be the duplication AGENTS.md names
  as this repo's top defect shape.
- ISR / `revalidateTag` — blocked on `tasks/open/pets-json-fallback-empty-means-outage.md`. Tagging
  a reader that serves fixtures on a zero-row count caches the ambiguity.
- The `/pets/[id]` detail page — already built (751 lines: tabs, rescue story, compatibility,
  status badge, rehab progress bar, medical timeline, updates feed, both CTAs).

## Review

All eight items done. The shape that fell out: **one field on one record decides everything.**
`PetStatusPresentation.track` is the only place a status is assigned to a section; the tab strip,
its counts, the status options inside it, and the card's CTA all derive from it. Adding a status
means adding a `track:` line — no component changes. `tests/unit/pets/petCatalog.test.ts` pins
that as a property ("gives every declared status a track in the declared sequence") rather than
leaving it as a claim in a comment.

Two things found on the way that were not in the brief:

1. **`/pets/[id]` served archived animals.** `getPublicPets` has filtered them since it was
   written; `getPetById`, the reader behind the profile page, never did. Archiving took an animal
   out of the grid and left its page reachable by direct link. Fixed at the action, not the
   repository — `findServerPetById` stays unfiltered because the update and archive mutations
   read with it and must see the row they are about to write.
2. **The server-action auth guard passes some functions on their neighbour's authorization.**
   `getPetById` was reading as guarded because the extractor slices a body from one exported
   function to the next, swallowing the private `getAdminActorOrThrow` helper that follows it.
   Reproduced (1499-char body, contains `verifyAdminSession`), written up in
   `tasks/open/server-action-auth-guard-slices-bodies-by-the-next-export.md`, and `getPetById` is
   now listed explicitly instead of classified by adjacency. The extractor itself is unchanged —
   that is a change to a security guard and belongs in its own task.

One deliberate corner: `/pets` sends the whole public population in a single payload, because
the facet counts have to be computed over animals the visitor is *not* currently filtered to.
Marked with a `ceiling:` comment naming ~500 as the point to page it.

### Verification

| Check | Result |
|---|---|
| `npx vitest run --project unit tests/unit/pets/petCatalog.test.ts` | 22/22 pass |
| `npm run test` (full unit project) | 79 files, 1304/1304 pass |
| `npm run test:components` | 5 files, 58/58 pass |
| `npm run typecheck` | clean |
| `npm run lint` | 0 errors, 17 warnings, none in touched files |
| `npm run docs:check` | OK, every invariant reference resolves |
| `npm run arch:check` | no new orphans or cycles |
| `npm run build` | could not run at the time — **since resolved, see "The build gap, closed"** |

`npm run build` fails in this worktree with *"Could not find the Next.js package
(next/package.json)"*: the worktree has no `node_modules` of its own, and Turbopack will not
resolve outside its workspace root. Everything else resolves by walking up to the parent
checkout, which is why the suites run. **Remaining risk: no production build has exercised these
pages.** Typecheck and the component suite cover the module graph and the rendering, but not
prerendering. Run `npm run build` from the main checkout after merge.

That gap is also why `/pets` now declares `export const dynamic = "force-dynamic"`: dropping the
`searchParams` prop would otherwise have flipped it to static prerendering silently, in a place
where a build that cannot reach the database bakes the `pets.json` fixtures into the page.

## Code review round (`/code-review xhigh`, 2026-09-09)

Fifteen findings. **One of them said the headline claim above was wrong, and it was right.**

`getPetById` called `findServerPetById` — a synchronous lookup over the in-memory mirror, which a
cold process initialises from `src/data/pets.json`. So the archive guard was reading `isArchived`
off a fixture: an archive performed in another instance stayed invisible, and the profile page
kept serving the animal. The converse too — a pet that exists only in the database 404'd on any
instance that had not already loaded the catalogue. The action now reads `findServerPetByIdAsync`,
which is what `getServerPetsAsync` has always done for the catalogue beside it.

The unit test could not have caught it: it arranges and reads the same mirror. Four DB-backed
tests went into `tests/integration/softDeleteFiltering.test.ts`, and `prismaDouble` gained
`pet.findUnique`. **Each was confirmed to discriminate** by reverting the fix and watching them
go red — which exposed a second problem the review had not: the first archived-animal test used
an `itest-` id absent from the fixture mirror, so it passed against the *broken* reader for the
wrong reason. It now uses `pet-001`, a real fixture row, which is the production scenario.

Also fixed from the review: a status `<select>` that could hold a value with no matching option
(blank control, empty grid, invisible filter — now `buildVisibleStatusFilterOptions` keeps the
selection visible at zero); a track strip that vanished while a track was still selected;
`matchesTrackFilter` failing closed on a malformed `?track=`; a stale `sm:col-span-3`; a fourth
hand-written copy of Male/Female (now `GENDER_VALUES`); `signInAsAdmin()` in the public-read tests,
which would have masked an authorization gate on the very reads they cover; and a `PetCard`
comment that claimed there was no dead "Pending" button while the code renders one deliberately.

Two findings were declined, with reasons: the server-side `gender` filter has no production
caller, but neither do `species`/`size`/`ageCategory`/`status`/`search` since this branch removed
the only caller passing filters — deleting one field would leave the contract asymmetric. And the
auth guard's body-slicing defect stays whitelisted rather than patched, because changing a
security guard's extractor is its own change; it is written up in `tasks/open/`.

### The controller finding

The review's sharpest quality point: the 314-line rewrite had no test at any tier. It now has 41,
in `tests/components/usePetGalleryController.test.ts`. They were validated by mutation — 15
deliberate regressions to the hook made 20 of them fail, including the dropped-change
(`track=alumni&status=Pending`) that `updateFilters`' own comment predicts if it ever regresses to
per-key setters.

Writing them turned up two more real defects, both fixed:

- **Reset discarded foreign query parameters.** `router.replace(pathname)` threw away
  `utm_source` and anything else riding along, so the one control meaning "show me everything"
  detached the visit from the campaign that brought it — while every other filter interaction
  preserved them. `handleResetFilters` is now `updateFilters({ ...FILTER_DEFAULTS })`, which
  deletes exactly the keys the gallery owns. That is also shorter than what it replaced, and it
  removed the `syncUrl` branch this file's earlier review fix had just added.
- **`?search=%20%20` reported an active filter that narrowed nothing.** `hasActiveFilters` now
  compares the same trimmed value the matcher uses.

**Still not covered:** nothing exercises a re-render *after* a URL write — `router.replace` is a
spy that never feeds its href back to `useSearchParams`, so back/forward navigation and the
stale-snapshot hazard `updateFilters` guards against would need an E2E test.

### Verification, second round

`typecheck` clean · `test` 79 files / **1310** pass · `test:components` 6 files / **100** pass ·
`test:integration` 6 files / **56** pass · `lint` 0 errors (17 pre-existing warnings, none in
touched files) · `docs:check` OK.

## The build gap, closed (2026-09-10)

Reported twice as unrunnable. It runs; the worktree just needed its own dependencies —
`npm ci` (not `install`, so the lockfile is not rewritten), because vitest resolves by walking up
to the parent checkout and Turbopack refuses to compile outside its workspace root.

It then failed a second time, on `SESSION_SECRET is not set`: `.env.local` is gitignored, so a
worktree has no environment at all, and `next build` sets `NODE_ENV=production`, which flips
`resolveSecret` from warn to throw. Built with a throwaway `SESSION_SECRET`/`ADMIN_SECRET_KEY`
passed inline rather than by copying `.env.local` across — that file points `DATABASE_URL` at the
Neon **production** branch, and a build with no database is the more honest test anyway.

**`npm run build` passes.** The route table confirms the rendering-mode decision rather than
leaving it as reasoning:

    ├ ƒ /pets                    ← Dynamic, as `force-dynamic` intends
    ├   /pets/[id]
    │ ├ ● /pets/pet-001          ← SSG, 10 paths prerendered

With no `DATABASE_URL` the reads fell back to `pets.json` and prerendered ten fixture animals —
which is precisely the outage shape `force-dynamic` keeps off `/pets`. Nothing left unverified
except the URL round-trip noted in
`tasks/open/gallery-url-round-trip-is-never-exercised.md`.

## Merging master (2026-09-11)

Dry-running the merge before opening the PR found master 11 commits ahead and four conflicts. Two
things came out of it that the conflicts alone would not have shown:

- **This file.** On day one I wrote this plan with a full-file write and deleted the 499-line FAQ
  stream below it without reading it. Master had also edited the file, so it conflicted, and the
  stream is restored here in full beneath the header master added. Had master left this file
  alone, the deletion would have merged cleanly.
- **The lessons split was already on master** (PR #37, 2026-09-09) — same format, same content,
  different slugs on long titles. Git reported no conflict in `tasks/lessons/`, and 33 lessons
  would have landed twice. Diffing titles across both sides found them; all 33 were body-identical
  to master's copies and are removed. Master's split, README and decision record stand; this
  branch contributes only its four new lessons, plus five pointer updates master's split had
  missed, repointed at master's filenames.

`CLAUDE.md`'s close-out procedure now sits on master's version of the file (the drift-log rule it
cited moved to `AGENTS.md`, and gained a session-id filter). Step 5 now says to prepend to this
file and never rewrite it; step 6 now says to dry-run the merge and check for overlapping work
before opening a PR. Both are written from this round. Lesson:
`tasks/lessons/2026-09-11-a-clean-merge-says-nothing-about-duplicated-work.md`.

Re-verified on the merged tree: `typecheck` clean · `test:all` **95 files / 1555 pass** · `lint`
0 errors · `docs:check` OK · `build` passes, `/pets` still dynamic, `/pets/[id]` still SSG.

---

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

## Second pass — collapsing the label tables

The parallel session responded to the drift above by moving category labels off the per-row
fixture fields onto canonical tables — the right call, and it fixed the duplication this stream
was about. But it landed the *same table three times*: in `categoryTabs.ts` and once in each
catalog, with the `presentation/` copy typed `Record<string, …>` where the catalogs used
`Record<FaqCategory, …>`. Same defect shape, new location.

- [x] Compared all three before touching them — 14 entries, **zero divergence**, so this was
      caught before it cost anything.
- [x] One declaration each, in `src/lib/presentation/categoryTabs.ts`, keyed by `FaqCategory` /
      `RehabNeedCategory`. Both catalogs import them; the two `*_DEFINITIONS` copies are gone.
- [x] Exhaustiveness proven: an eighth union member is a compile error at the single
      declaration. Under the old `Record<string, …>` it was accepted silently there.
- [x] Rendering byte-identical — tab strips *and* per-item eyebrows on `/pets` and `/needs`.

## What went wrong, and it was mine

The exhaustiveness proof required breaking the union on purpose. Inject and `tsc` ran in one
tool call; the revert ran in the **next**. In that ~2-minute gap the parallel session read the
TS2741 as a real missing case and committed a fix for it — `4e87dee`, which added an invented
`adoption_events` FAQ category to the Zod enum and the label table. Reverting the union then
*inverted* the error to TS2353 and left **HEAD not typechecking** until `4b06451` removed both.

I had this rule already recorded and broke it. The rule is now stronger: do not inject into the
shared tree at all — use a detached worktree, the same technique that proved the tab work green
in isolation earlier in this stream. `tasks/lessons.md` carries it, including the reciprocal
check for whoever sees the error.

## Handed off

`docs/tasks/TARGET_LEGACY_ADMIN_TOKEN_REMOVAL.md` + `/remove-legacy-admin-token` — closes
`TARGET_SECRET_HARDENING.md` §3.5. The audit moved the risk: nothing in `src/` issues the
`admin_session` cookie, so removal is not the behavioural change §3.5 feared. The real
deliverable is the `ADMIN_SECRET_KEY` decision, not the deletion.

## Landed

| commit | what |
|---|---|
| `5832244` | the wiring — 5 files, pathspec commit |
| `ec055d2` | `tasks/` records; the target-doc closure was swept into the other session's `4952eb1` |
| `4b06451` | removed the phantom `adoption_events` category; restored a red HEAD to green |
| `f051905` | the lesson about deliberate breakage in a shared tree |
| `777f8a3` | the next target and its slash command |

All committed with `git add -- <paths>` + `git commit -F <msg> -- <the same paths>`, checking
`git diff --cached --name-only` in a separate call first. The concurrent session held between
four and fifteen files in the tree throughout; none rode along.

**The label-table collapse itself is not in that table.** It was swept into the other session's
`c257681` / `63e6b94` before I committed. The code is correct and in history; it is simply not
attributable here, and rewriting shared history on a branch with an active writer costs more
than a misleading commit message.

Closed out: `docs/architecture/LAYERS.md:316` said these fixtures had "no reader and no action"
and that `PetsFaqSection` hardcoded FAQ arrays. I left it in the first pass as out of scope; on
closing the stream it was corrected, because it now contradicted the code directly. The one true
half is preserved and sharpened: `src/app/donate/page.tsx:107` really does still hold an inline
`faqs` array, and it is now the last one.

Final state: `npx tsc --noEmit` 0 errors, `npm run test:all` **712 passing**.

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


---

# Pet sponsorship checkout on the animal profile

Opened 2026-09-02. Original ask: a prominent "Sponsor Care" CTA on `/pets/[id]`, a tier modal with
monthly/one-time pricing, a checkout that issues a Section 44(6) receipt, and a `PetSponsorship`
table. A first attempt was built against `9799dfe`, before `feature/frontend` merged; that branch is
kept at `backup/pre-rebase-sponsorship` and is **not** what lands.

## Why the first attempt is being rewritten rather than rebased

It was built on a master that did not yet have the donation subsystem, so it grew its own copy of
almost all of it. Measured against `c95d0b8`, it duplicated:

| First attempt | Already on master |
|---|---|
| `src/lib/money.ts` (plain `number` sen) | `src/lib/domain/money.ts` (branded `Sen`, rejects sub-sen) |
| `generateReceiptNumber()` — random 4 digits | `ReceiptSequence` upsert-in-transaction, gapless |
| `SHELTER_REG_NO` / `LHDN_TAX_REF` constants | `currentIssuerIdentity()` |
| its own ledger + receipt DTO | `donationLedger.ts` + the single `toReceiptDTO` |

The random receipt number is strictly worse than the sequence it would have sat beside: two donors
in the same month can collide, and `decisions/2026-08-31-lhdn-export-reads-the-ledger.md` exists
precisely because a second source of receipt truth is how the export started lying. Rebasing would
have merged the duplication in; this rewrite deletes it and builds on the primitives instead.

It also violated three guards that did not exist when it was written: `layerBoundaries` (a
`"use server"` action importing the `"use client"` tier store; Prisma outside `src/lib/server/`),
`designSystemGuards` (a `bg-amber-600` CTA, hex colours in an email body), and the i18n key parity
check.

## Plan

- [x] **1. Stop the client inventing receipt numbers.** `useSponsorshipController.handleCompleteDonation`
      and `DonationWidget` both fall back to `createDonationReceipt(...)` on *any* action failure,
      handing the donor a locally minted `HFS-DON-...` that no ledger has ever seen. This directly
      contradicts the action's own error copy ("no receipt was issued") and `donationLedger`'s
      declared no-fallback contract. Surface the error instead.
- [x] **2. Escape the remaining free-text fields in email HTML.** `escapeHtml()` already exists and
      the follow-up above names the fields left unescaped (`donorName`, `tierName`, `address`,
      `applicantNotes`, `coordinatorNotes`, `currentPets`). One task across the file.
- [~] **3. Dual pricing per tier — NOT DONE, see below.** Add `monthlySen`/`oneTimeSen` to the catalog and make the
      selected amount follow the frequency toggle. `amount` stays exactly as it is — RM 30/50/120/250
      is pinned by `petDetailTabsAndSponsorship.test.ts`, and repricing public donations is a
      shelter decision, not a refactor. Tier count stays at four.
- [x] **4. `PetSponsorship` persistence.** New model, new repository under `src/lib/server/`.
      A sponsorship is a *commitment* and is mutable; `Donation` stays append-only and untouched.
- [x] **5. Pledge -> reconciliation -> receipt.** Checkout records `PENDING_PAYMENT` and sends a
      welcome email that is explicitly not a tax receipt. A coordinator reconciling the bank
      transfer calls `issueDonationReceipt()` — master's gapless allocator — and the resulting
      `Donation` is linked to the sponsorship. Nothing in checkout verifies that money moved, so
      nothing in checkout may issue a statutory document.
- [x] **6. Social proof and the funding threshold on the profile.** Supporter count from *distinct
      reconciled* donors only; hidden at zero; "Fully Sponsored — View Others" at goal without
      hard-blocking giving. Design tokens only, both locales.
- [x] **7. Verify:** `npm run check`, `npm test`, `npm run test:components`, `npm run arch:check`,
      `npm run build`. The `/donate?sponsorPetId=` deep link is asserted in three suites — it must
      keep working.

## Constraints this must not break

- `SPONSORSHIP_TIERS.length === 4` and `kibble.amount === 30`.
- The `/donate?pet=&sponsorPetId=&tier=` contract (unit, components, and `e2e/specs/02_*`).
- `Donation` is append-only: no status column, no update path.
- Statutory reads use `listDonationsOrThrow`, never `listDonations`.


## Review

Landed as five commits on `worktree-sponsorship-checkout`.

**A pre-existing red baseline had to be cleared first.** `npm test` failed 4 tests on a clean
checkout of `c95d0b8`, all from `1137d3e chore(ui): update home page` moving `--background` from
`#fff8f4` to `#fdf8f4` in passing. That one character broke the email hex mirror, broke
`oklch.test.ts`, and dropped `--primary` text contrast to **4.49:1 — under WCAG AA**. Reverted,
plus a `text-[11px]` in `PetGallery` swapped for the `text-2xs` step that is exactly that value.

**Item 3 was deliberately not done.** The plan asks for Bronze RM 30/mo · RM 50 one-time, Silver
RM 80/mo · RM 150 one-time, Gold RM 200/mo · RM 350 one-time. Three committed tests pin the
opposite:

- `petDetailTabsAndSponsorship.test.ts` — `findSponsorshipTier("kibble")?.amount === 30`
- `DonationDeepLink.test.tsx:176` — `tier=kibble&freq=monthly` renders `RM 30.00`
- `DonationDeepLink.test.tsx:101` — the default tier at `freq=monthly` renders `RM 50.00`

So master's committed behaviour is that monthly costs the same as one-time. Changing that reprices
the shelter's public donation page, which is a decision for the shelter and not a side effect of a
sponsorship feature. The frequency toggle already works; only the price differentiation is missing,
and it is a small change once someone with authority says what the monthly prices are.

**What the reconciliation split buys.** Checkout records `PENDING_PAYMENT` and sends a welcome mail
that says in both halves that it is not a tax receipt. `reconcilePetSponsorshipAction` is the only
path that issues one, and it does so through `issueDonationReceipt` — so a sponsorship receipt is
drawn from the same gapless per-month series as every other receipt and shows up in the LHDN export
unchanged. The first draft of this work minted its own `HFS-DON-<month>-<random 4 digits>`, which
would have collided with that series.

**Verified.** `npm run check` (0 errors), unit 689/689, components 58/58, integration 48/48,
`npm run build` green, and the prerendered `/pets/pet-001` carries the promoted CTA. Two mutation
checks: making `countsTowardFunding` accept `PENDING_PAYMENT` fails 5 tests; swallowing the donation
error instead of surfacing it fails the receipt-integrity test.

**Not verified.** No sponsorship has run against a real Postgres — the same gap
`tasks/open/donation-ledger-unverified-on-postgres.md` has carried since 2026-08-28, and this adds a
table to it. The migration is additive (`pet_sponsorships`, plus two nullable/defaulted columns) so
`db push` will not ask for `--accept-data-loss`, but it has not been run.
