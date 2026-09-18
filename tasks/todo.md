<!--
  This file still has the collision defect that `tasks/lessons.md` was split to remove on
  2026-09-09: one file, one append point, written by every concurrent session. A conflict here
  costs a pull request its whole CI run, because GitHub builds no merge commit for a conflicted
  PR — see `tasks/decisions/2026-09-09-lessons-become-one-file-per-lesson.md`.

  It was left as one file deliberately: these are work-stream write-ups with far less uniform
  structure than a lesson, so splitting them is its own task, not a ride-along. Until then,
  prepend a new stream at the top and do not reformat what is below it.
-->

# Active Work Streams

Historical completed work streams (August-September 2026) have been archived to [tasks/archive/todo-historical-streams.md](archive/todo-historical-streams.md).

Record active multi-step work streams below.

# Home page loose ends, and the ledger mirrored into GitHub issues — review

**Branch:** `worktree-ledger-issues-mirror` · opened 2026-09-18 · base `85ee351`

## What shipped

- [x] Four home page defects no open entry held, each checked at `85ee351` (most by a throwaway
      component test): `bulletins-are-a-per-browser-demo-anyone-can-edit`,
      `home-page-text-stays-english-on-the-malay-site`,
      `hero-mounts-a-quiz-and-sponsor-dialog-nothing-can-open`,
      `nav-links-point-at-home-sections-the-page-no-longer-renders`.
- [x] `scripts/ledger-issues.mjs` (`npm run ledger:issues`): a one-way mirror of `tasks/open/` into
      public issues labelled `ledger`. Rules and why: `tasks/decisions/2026-09-18-ledger-issues-are-a-one-way-mirror.md`.
- [x] `.github/workflows/ledger-issues.yml` runs it with `--apply` on push to `master`.
- [x] Published 2026-09-18 from `master`: #48–#71, one per entry. The home page entries and the
      workflow's own open entry publish when this branch merges and the workflow runs.

## Review

- Six `/code-review` rounds, each on the previous fix round, plus one probe found by running the
  script the way CI will. Every round found real defects, and the fix rounds made some of their own:
  running from `tasks/` would have closed every issue; a depth-1 clone could not resolve
  `origin/master`; any stranger could plant a marker (fixed with the label gate); the label filter
  then moved the read onto the lagging search index (fixed with GraphQL `repository.issues`);
  four separate file-name shapes broke the marker until it was percent-encoded instead.
- Final state: 36 tests, 29 of 29 mutations killed, dry runs from the root, from `tasks/`, in a
  depth-1 clone, and paging five issues at a time. The whole-branch review found no correctness
  bug; its low findings are fixed — an empty fallback title, an overstated line in this stream.
  Generalising the first, one round made the sync keep going past a refused action; its review
  found that retired renamed entries and hammered rate limits, so it was reverted to stopping, and
  the entry-shaped refusals (a blank, long or control-character title, an oversized body) are
  prevented in the core instead.
- Registered kill condition — the marker survives GitHub — **SURVIVED**: the run straight after the
  first `--apply` printed `in sync, nothing to do`. Entry deleted, verdict in the decision record.

## Deliberately not done

- **None of the four home page defects is fixed.** The ask was to write them up, and each needs an
  owner's decision first: bulletin persistence (P-D in `docs/tasks/TARGET_SCHEMA_TYPE_INTEGRITY.md`),
  FE-02's hero buttons against the undocumented "sitemap" in `home.test.tsx`, where the dead anchors
  should point.
- **PR #34's three unreproduced local failures were not filed.** They match the load-timeout pattern
  in two lessons and in `tasks/decisions/2026-09-08-admin-sponsorship-reconciliation.md`, and CI's
  test job passed on all eleven failed runs since 2026-09-08.
- **PR #34's "dedicated table" ceiling for the impact counters stays untracked**, as its author chose.
- **One open entry has no settle condition at all** (`sponsor-portal-is-inert-until-reconciliation-is-reachable`),
  and three write theirs as a `## Settles when` heading rather than the `**Settles when:**` line
  `tasks/README.md` asks for (`donation-form-and-admin-denials-have-loose-ends`,
  `matcherless-hook-wiring-unverified`, `production-schema-has-drifted-ahead-of-master`); the second
  of those also has two H1s. Noticed while building the mirror, which copes with all of it; not
  rewritten, because they belong to other sessions.
- **No two-way sync, and no run on `pull_request`.** Both are recorded as rejected in the decision.
- **The workflow has never run** — it cannot before it is on `master`. Open entry
  `ledger-issues-workflow-has-never-run`, with an agent-checkable settle condition.

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
file and never rewrite it; the merge-check step now says to dry-run the merge and check for
overlapping work before opening a PR. Both are written from this round. Lesson:
`tasks/lessons/2026-09-11-a-clean-merge-says-nothing-about-duplicated-work.md`.

Re-verified on the merged tree: `typecheck` clean · `test:all` **95 files / 1555 pass** · `lint`
0 errors · `docs:check` OK · `build` passes, `/pets` still dynamic, `/pets/[id]` still SSG.

## Merging master again (2026-09-16)

PR #38 had gone `CONFLICTING` while it sat: master moved 20 commits, so it was getting no CI. One
textual conflict, in this file — and it was the restructuring kind. Master's `eaca046` moved every
historical stream out of `todo.md` into `tasks/archive/todo-historical-streams.md`. Keeping this
branch's copy would have put the 499-line FAQ stream back inline while it also sat in the archive.
Resolved by script onto master's layout, refusing if any stream below this one was absent from
the archive: all five were present, so this stream now sits under "Active Work Streams" and nothing
else is here.

Checked beside the conflict, since restructuring is where a clean path-level merge lies: master
touched `src/actions/pets.ts` (a comment path only; the async `getPetById` fix is intact), and moved
two docs this branch had edited into `docs/archives/tasks/` — rename detection carried the edits,
and no old path was resurrected. Master also reworked `SponsorshipModal` and the adoption and
sponsorship controllers, which `PetGallery` renders; they type-check against it unchanged.

`typecheck` first failed in `src/lib/server/applicationRepository.ts`, a file this branch never
opened, on a `referenceCode` field. Master had added it to the schema, and the worktree's generated
client predated the merge. `npm run db:generate` cleared it with no code change. Written up as
`tasks/lessons/2026-09-16-after-a-merge-a-type-error-in-a-file-you-never-touched-is-a-stale-client.md`,
and the merge-check step of `CLAUDE.md`'s close ("Merge-check against current `origin/master`")
now says to regenerate after a merge that touched `prisma/`. Cited by name, not number: a step was
inserted above it on 2026-09-16 and the number this line first gave pointed at the wrong one.

Re-verified on the merged tree: `typecheck` clean · `test:all` **104 files / 1688 pass** · `lint`
0 errors · `docs:check` OK · `build` passes, `/pets` still dynamic, `/pets/[id]` still SSG.

## Second code review (`/code-review xhigh 38`, 2026-09-16)

Asked for by the user before merging, and they were right to ask: the commit that fixed the first
review's fifteen findings had never been reviewed itself. Fourteen candidates, each checked
against the code before acting. **Eleven real, three pre-existing.**

**The one that stopped the merge.** The archived-profile fix could be bypassed by changing the case
of the URL. `findServerPetByIdAsync` falls back to the in-memory mirror not only when the database
fails but also when it *succeeds* with no row, and the mirror matches ids case-insensitively where
Postgres does not. `/pets/PET-001` missed the database, found fixture `pet-001` unarchived, and
served it. `getPetById` now requires an exact id match. And the test named "returns null when the
row does not exist" used an id absent from the mirror too — passing for the wrong reason, the exact
shape of this branch's own lesson from six days earlier. Renamed to say what it covers; the real
case is a new test against fixture `pet-001`.

Fixed. **Not every one has a test** — this line first said "each with a test shown to go red
when its fix is reverted", and the review of this round caught that three did not. Proven red on
revert: the case-variant guard, `buildVisibleTrackOptions`, `resolveFilters` (status, track and
base filters separately), the track-switch status rule, `syncUrl: false` ignoring the URL, search
written as typed, and the server search trim. **Untested:** the Adoption Form preselect (it lives
in `PetGallery`'s markup, and no suite renders the gallery), and the `React.cache` wrapper
(nothing observes a second query that does not happen). The gender label gained a test in the
round below.

- The gallery's "Adoption Form" button preselected `filteredPets[0]`, which the new Adopted and
  Rehabilitation tabs make non-adoptable by construction. It now passes the first adoptable animal
  or `null`, and `resolveDefaultPet`'s existing fallback picks the rest. *(Corrected in the round
  below: `null` does not guarantee an adoptable animal.)*
- A selected track vanished from the strip when other filters emptied it — the defect
  `buildVisibleStatusFilterOptions` was added to fix for status, left open for tracks.
  `buildVisibleTrackOptions` now does the same.
- Filter values from the URL are resolved once, in `resolveFilters`, against `petFilterSchema` and
  `PET_TRACK_SEQUENCE`: an unrecognised value means "not filtering", never "match nothing", and a
  legacy `?status=Rehabilitation` resolves to the canonical option the select actually has. That
  one change closed three findings, which had each described a different symptom of raw values.
- Switching track kept the status only when switching to a track that did not contain it; it now
  keeps it for "All" and for the status's own track.
- The home page's featured strip seeded filters from the URL with no controls to show them.
  `syncUrl: false` now means the URL plays no part in either direction.
- Search was trimmed before being written to a URL the box reads back from, so a space could not be
  typed. Pre-existing, but this branch's own test had pinned it; now written as typed, compared
  trimmed.
- `getPetById` became a real query in this branch and was called twice per render.
  `React.cache` in the page, per the Next 16 docs on metadata.
- The server search did not trim where the client did; `GENDER_LABEL_KEYS`' docstring claimed a
  coverage it did not have.

**Deliberately not fixed here**, each written up with what would settle it:

- `submitApplication` — reading the code to write up the preselect finding showed it checks
  archiving against the fixture mirror, accepts an unknown pet id, and checks no status at all.
  Pre-existing, belongs to #39's adoption work, and a public write path deserves its own review.
  `tasks/open/submit-application-checks-a-fixture-and-no-status.md`.
- The repository still falls back to the fixture after a *successful* "no such row", so a
  fixture-only id is served at its exact URL. That is the open fallback-policy question, not this
  branch's to decide. `tasks/open/pet-profile-falls-back-to-a-fixture-the-database-lacks.md`.
- Every filter change is a server navigation on a dynamic page. Pre-existing and unmeasured.
  `tasks/open/gallery-filters-navigate-the-server-on-every-change.md`.

The process gap is recorded where it will fire: `CLAUDE.md`'s close now has a step to review the
whole diff — fix commits included — before opening or merging a PR. The lesson itself already
existed (`tasks/lessons/2026-09-08-a-security-fix-needs-an-adversarial-pass-of-its-own…`); it was
in `tasks/lessons/` and not in the list I follow at close, so it did not run.

## Third code review — of the uncommitted fix round (`/code-review xhigh`, 2026-09-16)

Run on the fix round *before* committing it, by the step added above. Fourteen candidates; **ten
real**, one of them a crash this round had introduced.

**The crash.** `PetCard` had switched from a ternary to `t(GENDER_LABEL_KEYS[pet.gender], …)`.
`gender` is a free-text column, only cast by the mapper, so any stored value other than exactly
`Male`/`Female` gave an `undefined` key — and `t()` calls `.split` on its key. One mistyped row
would have taken down the whole catalogue and the home page's featured strip. Replaced by
`genderLabelArgs`, total over any string; the three other places that label a sex (detail dialog,
detail page, donation carousel) now call it too, with identical output, so the four cannot
disagree. A render test reproduces the crash on revert:
`TypeError: Cannot read properties of undefined (reading 'split')`.

Also fixed, each shown red on revert:

- **The case-variant test arranged no archive.** It mocked `findUnique` to return `null` for every
  id, pinning "a variant URL 404s" rather than "an archive stays hidden". It now models Postgres —
  the archived row exists and is returned only for the exact id — and reads the variants *first*,
  because reading `pet-001` syncs the archived row into the mirror and would hide the bypass on its
  own.
- **`resolveFilters` made the filter schema load-bearing, and the schema hand-copied its enums.** A
  band added to `AGE_BANDS` but not re-typed there would have rendered in the select and been
  silently reset to "all". The filter and form schemas now build their enums from `AGE_BANDS`,
  `SPECIES_VALUES` and `SIZE_VALUES`.
- **The search rule was two copies that had already drifted once**; fixing the drift by editing one
  copy only reset the clock. Both now call `matchesPetSearch` in `src/lib/domain/petSearch.ts`.
- **A status and a track change in one batch** judged the track against the pre-batch status, so
  "Pending" could survive a switch to Rehabilitation. `updateFilters` now takes a function of the
  live filters in local mode.
- The Adoption Form preselect now tries the first adoptable animal in the shelter when none is on
  screen, and its comment no longer promises what `resolveDefaultPet`'s `allPets[0]` fallback
  cannot keep. Still untested — see above.
- `buildVisibleTrackOptions` and `buildPetTrackOptions` are one loop over the track sequence instead
  of a build, a rebuild and a sort.
- Two stale "step 6" citations in this stream now name the step; a misplaced `describe` separated
  a comment from the blocks it described.

**Not fixed here, recorded:**

- Sponsorship checkout (`src/actions/sponsorships.ts`) reads `findServerPetByIdAsync` too, so a
  posted `PET-001` pledges against fixture `pet-001`. Same repository fallback as the profile, so it
  went into `tasks/open/pet-profile-falls-back-to-a-fixture-the-database-lacks.md`, whose settling
  fix — return `null` after a successful read that finds no row — closes every caller at once
  instead of guarding each.
- `useSearchParams()` still runs on the home page even though `syncUrl: false` no longer reads it,
  which client-renders the featured strip up to its Suspense boundary. Pre-existing; the fix is
  splitting the URL and local controllers. Added to
  `tasks/open/gallery-filters-navigate-the-server-on-every-change.md`.
- A case-variant URL for a *live* animal now 404s rather than redirecting to its canonical id.
  Accepted: every id this app generates is canonical, and a redirect is a routing change, not a
  read fix.

Where the loop stops: review rounds keep producing findings, and past this point most are
cleanups. A further round blocks the merge only for a correctness defect, a security gap, or a
claim this PR makes that is false; anything else is recorded, not chased.

## Fourth code review — of rounds two and three (`/code-review xhigh`, 2026-09-16)

Rounds two and three were committed as `03accc5` once this review had covered them, so what
follows is its own small diff. Thirteen candidates, triaged against the bar above.

**The one that met it: a stored XSS on every pet profile.** The JSON-LD block on `/pets/[id]` was
`dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}`. `JSON.stringify` leaves `<` alone,
and the HTML parser ends a script element at the first `</script>` whatever its `type`, so a pet
named `</script><script>…</script>` — 38 characters, inside the form's 60 — ran as script for every
visitor to that profile, staff included. Anyone with `MANAGE_PETS` could plant it. Pre-existing on
master, not introduced here; fixed here because this PR edits that function and it is the only
JSON-LD block in the codebase. `serializeJsonLd` replaces every `<` with its six-character JSON
unicode escape (backslash, u, 003c), which is what the Next 16 JSON-LD guide prescribes and which
`JSON.parse` reads back unchanged. *(This line first printed that escape literally, and the file
tool decoded it to `<` — "escapes `<` as `<`". The fifth review caught it in three files; the
code itself was checked byte-for-byte and by running it, and was never affected.)* Its test fails on the raw
payload when the escape is disabled. (Getting that mutation to apply took three tries: `sed` and
Windows argv both mangle a backslash beside a quote, and Git Bash rewrote the argument `/</g` into a
Windows path. A mutation that silently does not apply proves nothing, so the script used refuses
unless its pattern occurs exactly once.)

**Corrected, all small and all mine from the previous round:**

- `genderLabelArgs` moved from `validations/pet.ts` to `src/lib/presentation/petLabels.ts`. It
  builds display arguments; living in the validation module pulled zod schemas into four display
  components for a one-line label.
- The Adoption Form preselect's second fallback, `pets.find(isAdoptable)`, was dead:
  `resolveDefaultPet` already picks the first Available animal from the same array, and
  `isAdoptable` is true for exactly that status. Removed.
- `SPECIES_VALUES` and `SIZE_VALUES` now `satisfies` their domain types, and their docstrings — and
  the filter schema's — stop claiming the gallery renders from them. It does not: the species toggle
  and size select still hand-list.
- The `resolveFilters` comment said the schema "cannot drift from what the server … accept". The
  server never resolves its input through that schema; the comment now says so.
- `buildPetTrackOptions` is documented as the no-selection form the gallery no longer calls directly.
- Two knowingly-shipped limits gained the `ceiling:` marker AGENTS.md asks for.
- The gender tests stopped asserting that a stored `"male"` should display as Female. It does, and
  that is wrong for such a row; it is kept only so four components agree, and a test should not make
  it a requirement. They now pin what matters — a real key, no crash — and both still go red on the
  crash-shaped lookup.

**Not fixed — below the bar.** Each is an open question, so each lives in `tasks/open/`, not here
(this section first held them inline, which `tasks/README.md` forbids; the fifth review caught it):

- Tab counts vs the grid, a stale track-plus-status link, junk values left in the URL —
  `tasks/open/gallery-filter-url-state-edge-cases.md`.
- Non-canonical `gender` rows label wrongly and escape the filter —
  `tasks/open/pet-gender-column-accepts-values-the-labels-cannot-show.md`.
- `getPublicPets` does not validate its public input and disagrees with the gallery about bad
  values — `tasks/open/get-public-pets-trusts-its-filter-input.md`.

Accepted rather than open: `matchesPetSearch` re-normalises its query per pet, and in local mode
the setters change identity on each filter change. Neither is measurable at shelter scale.

## Fifth code review — of round four (`/code-review xhigh`, 2026-09-16)

Twelve candidates, same bar. **No security gap and no defect in the XSS fix itself** — but the one
that mattered most was about it.

**The comments on the security fix described a no-op.** Every place this round wrote the escape
sequence literally — `jsonLd.ts`, its test, and this file — the file-writing tool decoded it back
into `<`, so the comment read "escape `<` as `<`". The code was checked byte-for-byte and by running
the serialiser on `</script>` — it emits the six-character escape and no raw `<` — and was never
affected. But a comment on a security fix that describes a no-op invites someone to delete the fix.
Rewritten to spell the escape out in words, with a warning not to tidy it back.

**A preselect fix removed on one review's word was load-bearing.** The fourth review called the
gallery's second fallback, `pets.find(isAdoptable)`, dead because `resolveDefaultPet` picks the same
animal when handed `null`. It does — but the form copies a selection into its fields only when it
receives an actual pet (`if (selectedPet && open)`). Handed `null`, its title follows
`resolveDefaultPet` while `petId` keeps the last opening's value. Two reviews contradicted each
other, and the effect was not read before acting on the first. Restored, with a comment saying why.

Also corrected: the gender test checked key and fallback separately, so a mismatched pair would
pass — now checked as a pair; `serializeJsonLd` took `unknown`, and `JSON.stringify(undefined)`
returns `undefined`, not a string — now typed `object`; and four claims of mine that did not hold
(the label helper making every surface agree, moving it keeping zod out of components, `satisfies`
implying the lists are exhaustive, and a "tests below" pointer into another file).

Recorded, pre-existing: `resolveDefaultPet` falls back to `allPets[0]` whatever its status and
defines "adoptable" separately from `getPetStatusPresentation` — added to
`tasks/open/submit-application-checks-a-fixture-and-no-status.md`, the same adoption-flow thread;
and the JSON-LD price is built by deleting every non-digit from free text —
`tasks/open/pet-profile-json-ld-price-fuses-digits.md`, latent since every fixture fee is "Free".
