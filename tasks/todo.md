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
| `npm run build` | **could not run** — see below |

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
touched files) · `docs:check` OK. `npm run build` still cannot run here — unchanged, same reason.
