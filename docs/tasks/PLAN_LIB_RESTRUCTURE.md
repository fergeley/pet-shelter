# Plan: `src/lib/` Restructure — Split the Repository, Surface the Runtime Boundary

**Status**: approved, **not started**. Revision 2 (2026-08-26).
**Blocked on**: §1. The TNRM sprint has landed (`68b1981`), but a concurrent session is actively
writing in `src/lib/` — including the repository layer and the guard test this plan rewrites.
**Scope**: `src/lib/` only. No file outside `src/lib/` moves. No feature folders are created.

> **Revision 2 changelog.** Rev 1 was reviewed against the tree and five of its decisions were
> wrong. Phase order caused double-churn; the shared `fallback` holder re-created the coupling the
> split exists to remove; two of the five proposed modules touch no database and could not honestly
> be called repositories; the Prisma allowlist count was off; and the size gate was unsatisfiable by
> the plan's own layout. Two guard rules were unenforceable as written. All corrected below; §8
> records the reasoning so the same mistakes are not re-proposed.

---

## 0. The decision, and what it rejected

Three restructures were evaluated against the tree as it actually stands (123 source files,
22,462 LOC). Two were rejected on evidence, not taste.

### Rejected — full feature-slice migration (`src/features/{pets,applications,…}`)

| Claim made for it | What this repo shows |
|---|---|
| "Delete a feature = delete one folder" | `src/components/admin/` is a **delivery surface, not a feature**. `PetDataTable`, `PetFormDialog`, `ApplicationDataTable`, `ApplicationDetailDialog` consume pets *and* applications; `PetDataTable.tsx` already imports `@/components/features/pets/PetStatusIcon`. `features/admin/` would have to import `features/pets/` and `features/applications/` — the cross-slice import the pattern exists to forbid. |
| "Adding a field touches one folder" | Adding `vaccinationCertificate` touches `prisma/schema.prisma`, `src/data/pets.json`, `src/types/pet.ts`, `src/lib/validations/pet.ts`, **three** mappers in `serverStore.ts`, and both dictionaries in `src/lib/i18n/translations.ts`. The schema, the fixture JSON and the i18n dictionary **cannot be sliced into a feature folder**. Seven folders becomes four, not one. |
| "Feature folders own their data access" | `serverStore.ts` holds four domains behind **one** `resetServerStore()` that the global harness calls in `beforeEach` for every suite. Slicing it either breaks that contract or parks it in `shared/db/` — at which point `features/pets/` does not contain pets. |

Cost that bought none of the above: 123 file moves, **46 of 53 doc files** reference `src/`
paths, 36 test files rewritten, `git blame` reset across a 27-commit branch. Note also that
`21f8011 refactor(lib): add barrel entry points` was reverted by `f031b93 prune the unused
barrels` one commit later — speculative structure has already been tried and backed out here.

### Rejected — runtime-partitioned tree (`src/{server,client,shared}/`)

Its one real benefit is making the RSC boundary physically visible. §3 buys that for ten file
moves instead of 123, and §4 enforces it mechanically rather than by convention.

### Chosen — targeted split, layer contract preserved

`docs/architecture/LAYERS.md` already names every layer, assigns ownership, and fixes legal
dependency directions; `tests/unit/layerBoundaries.test.ts` already fails CI on violations. That
contract is a working asset, not dead prose — while this plan was being written, a concurrent
session added `src/lib/domain/money.ts` and `src/lib/domain/shelterIdentity.ts` **to the correct
layer unprompted**, and widened the Prisma allowlist deliberately with a comment explaining why.
The contract is doing its job. This plan **splits the one module that outgrew it** and **moves ten
files so the tree stops contradicting it** — it does not replace it.

---

## 1. Preconditions — do not start before ALL are true

```bash
git status --porcelain    # must be empty
npm test && npx tsc --noEmit && npm run lint
```

**Additionally: no other session may be writing to `src/lib/`.** This is not boilerplate. At
revision time the tree carried ~1,039 uncommitted lines across 24 files from a concurrent session,
and four of this plan's own target files were in flight simultaneously:

| File | This plan's use | Concurrent state |
|---|---|---|
| `tests/unit/layerBoundaries.test.ts` | Phase 3 rewrites it | modified — allowlist widened |
| `tests/setup/nextMocks.ts` | Phase 2 changes its reset import | modified |
| `src/lib/petStatusPresentation.ts` | Phase 1 moves it | modified |
| `src/lib/applicationStatusPresentation.ts` | Phase 1 moves it | modified |

Plus `src/lib/donationLedger.ts` (new, untracked) imports `from "./prisma"` **relatively** — a
`prisma.ts` move breaks it silently until typecheck.

A restructure is a rename-everything operation. Interleaving it with feature work does not produce
merge conflicts so much as a tree where neither party can tell which change broke what.

### Baseline

Assert unchanged at every phase gate. Measured 2026-08-26 at `68b1981` + concurrent work:

```
npm test         →  35 files, 458 tests, all passing
npx tsc --noEmit →  clean (exit 0)
```

(`CLAUDE.md` claims 30 files / 357 tests — stale. Refresh it in the §5 doc sweep.)

---

## 2. Phase 1 — moves only, no logic changes

**This phase runs first specifically so Phase 2 is written once against final paths.** Rev 1 had
these reversed, which meant five brand-new repository modules would be edited again one commit
later purely to chase `prisma.ts` to its new home.

Use `git mv` throughout so rename detection keeps history followable. Nothing but import
specifiers changes.

| From | To | Importers |
|---|---|---|
| `lib/petStore.ts` | `lib/client/petStore.ts` | 4 |
| `lib/applicationStore.ts` | `lib/client/applicationStore.ts` | 2 |
| `lib/bulletinStore.ts` | `lib/client/bulletinStore.ts` | 1 |
| `lib/settingsStore.ts` | `lib/client/settingsStore.ts` | 1 |
| `lib/sponsorshipStore.ts` | `lib/client/sponsorshipStore.ts` | 3 |
| `lib/adminAuth.ts` | `lib/client/adminAuth.ts` | 2 |
| `lib/petStatusPresentation.ts` | `lib/presentation/petStatusPresentation.ts` | 11 |
| `lib/applicationStatusPresentation.ts` | `lib/presentation/applicationStatusPresentation.ts` | 4 |
| `lib/adminPetFilters.ts` | `lib/presentation/adminPetFilters.ts` | 2 |
| `lib/exportCsv.ts` | `lib/presentation/exportCsv.ts` | 4 |
| `lib/prisma.ts` | `lib/server/prisma.ts` | 3 |
| `lib/userStore.ts` | `lib/server/userStore.ts` | 3 |
| `lib/donationLedger.ts` | `lib/server/donationLedger.ts` | *(coordinate — see below)* |

`donationLedger.ts` belongs in `lib/server/` by the same rule as `userStore.ts`: it is a Prisma
repository. It is also brand-new work from another session and imports `./prisma` relatively, so
**move it only with that author's agreement**, and fix the relative specifier in the same edit.

### Deliberately NOT moved

`utils.ts` (11 importers, framework-level `cn`), `medicalTimeline.ts`, `matchEngine.ts`,
`imageOptimization.ts`, `email.ts`, `persistenceMode.ts`, and the `domain/ security/ validations/
i18n/ storage/` directories. `medicalTimeline` and `matchEngine` are pure domain math and are
arguably `domain/` residents — a **separate**, later judgment call, not this plan's.

### Gate

`npm test` green, `npx tsc --noEmit` clean, `git status` shows only renames plus specifier edits.

---

## 3. Phase 2 — split `src/lib/serverStore.ts` (883 lines)

### Why this file at all

It is the only genuine architectural problem in the tree: one module owning pets, applications,
rehab needs and FAQs, plus the fallback lifecycle all four share. Every other complaint about
`src/lib/` is cosmetic by comparison.

### Target

```
src/lib/server/
├── petMappers.ts             # Db*Record types, mapDbPetToPet, build*Payload  (~380 lines, zero Prisma)
├── petRepository.ts          # pet cache + reads + writes                     (prisma.pet)
├── applicationRepository.ts  # application cache + reads + writes             (prisma.adoptionApplication)
├── rehabNeedsCatalog.ts      # fixture-backed reader                          (no Prisma)
├── faqCatalog.ts             # fixture-backed reader                          (no Prisma)
└── fallbackState.ts          # re-exports resetServerStore() only
```

**`petMappers.ts` is separate from `petRepository.ts`** because `Db↔domain` translation and cache
+ persistence are different concerns, and because the mappers alone are 380 lines — Rev 1's
"no module over ~400 lines" gate was unsatisfiable by Rev 1's own layout.

**`rehabNeedsCatalog` / `faqCatalog`, not `*Repository`.** Verified: `prisma.rehab*` and
`prisma.faq*` appear **zero** times in `serverStore.ts`. Both are pure fixture readers over
`src/data/*.json`. Naming them repositories would write a falsehood into the very layer map the
guards enforce. (`getServerRehabNeedsAsync` is a bare `async` wrapper over the sync function —
harmless, left alone, noted so the next reader does not assume a DB path exists.)

### The coupling — one-way, and that is the whole design

`atomicUpdateApplicationStatus` **mutates the pet cache**: approving an application cascades to
`prisma.pet.updateMany` and to `serverPets[petIndex]`, then auto-rejects conflicting applications.
Verified in the other direction: pet writes (`insertServerPet`, `updateServerPet`,
`archiveServerPet`, `deleteServerPet`) never touch `serverApplications`.

So the dependency is **acyclic**: `applicationRepository → petRepository`, via one narrow exported
function (`markPetAdopted(petId, actor)` or similar). Rev 1 instead proposed a shared mutable
`fallback` holder exporting all four caches — which would have handed every repository write
access to every other domain's state, re-creating precisely the coupling the split exists to
remove. **Do not reintroduce it.**

Each module therefore owns its own cache and its own `reset*()`. `fallbackState.ts` is a four-line
composition root that imports those four resets and re-exports the single `resetServerStore()`
entry point — preserving the name and behaviour that `tests/setup/nextMocks.ts` and all 35 suites
depend on. Direction is `fallbackState → repositories`; no repository imports `fallbackState`.

The `structuredClone` seeding must be carried over verbatim. The comment at `serverStore.ts:389`
explains why a spread corrupts the JSON fixture for the rest of the process, and the hermetic test
lifecycle depends on it.

### Importers to update — all 15, in one commit, no barrel

`src/lib/serverStore.ts` is **deleted**, not left as a re-export shim: `CLAUDE.md` forbids barrels,
and `f031b93` already removed the last set.

```
src/actions/applications.ts              src/actions/faqs.ts
src/actions/pets.ts                      src/actions/rehabNeeds.ts
src/app/needs/page.tsx                   tests/setup/nextMocks.ts
tests/unit/applicationTracking.test.ts   tests/unit/database.test.ts
tests/unit/faqs.test.ts                  tests/unit/layerBoundaries.test.ts
tests/unit/petHistory.test.ts            tests/unit/rehabilitation.test.ts
tests/unit/rehabNeeds.test.ts            tests/unit/setupMocks.test.ts
tests/unit/softDeleteAndAuth.test.ts
```

**`tests/setup/nextMocks.ts` needs care beyond a path rewrite.** It imports `resetServerStore`
**dynamically inside the hook** on purpose — a static import would instantiate the real
`@/lib/prisma` before a test file's own `vi.mock("@/lib/prisma")` registers, making Prisma spies
observe zero calls. Keep the dynamic import; change only the specifier, to
`@/lib/server/fallbackState`.

### Gate

`npm test` green, `npx tsc --noEmit` clean, no module in `src/lib/server/` over ~400 lines.

---

## 4. Phase 3 — make the new boundaries mechanical

Naming a convention that nothing checks is how `src/lib/` became a junk drawer in the first place.
Extend `tests/unit/layerBoundaries.test.ts` — it already builds the full import graph, so each rule
below is an assertion over data it computes today.

**Scope correction:** the graph is built from `walk(SRC)` — `src/` only. Test files are invisible
to it. Rev 1's rules carved out exemptions for test importers; that was dead text. Removed.

1. **Update the Prisma allowlist.** After Phases 1–2 it is five entries, all under the repository
   layer:
   ```
   src/lib/server/petRepository.ts
   src/lib/server/applicationRepository.ts
   src/lib/server/userStore.ts
   src/lib/server/donationLedger.ts     # keep the existing comment on why it is not dual-layer
   src/lib/domain/auditLog.ts
   ```
   Rev 1 predicted 3→6; the true count is 3→5, because the rehab-needs and FAQ modules touch no
   database and `donationLedger.ts` was added concurrently. The test's own comment says widening
   this list is a design decision to record in `LAYERS.md` §L-B2 — do so.
2. **`src/lib/client/*` is importable only from `isClient` modules.**
3. **No `isClient` module may reach `src/lib/server/*`.** Keeps Prisma out of the browser bundle.
4. **`src/lib/presentation/*` must not import `src/lib/server/*`.** Presentation stays pure.

**All four verified to pass on the current tree before being written** — every importer of the six
client stores already carries `"use client"`, no client module reaches `serverStore`/`prisma`/
`userStore`, and no presentation module imports server code. These are ratchets on an already-clean
state, not repairs. A guard introduced red is a guard someone will skip.

Guard the guards the way the existing suite does — its first test asserts the graph found more than
50 modules precisely so a broken walker cannot make everything pass vacuously. Each new rule needs a
non-empty subject set asserted alongside it, or it passes by finding nothing.

---

## 5. Documentation to update in the same PR

Structure docs that go stale are worse than none. 46 of 53 doc files reference `src/` paths; these
are the ones this plan actually invalidates:

- `docs/architecture/LAYERS.md` — L-B2 file list, the Prisma allowlist note, L-F4 store paths.
- `docs/architecture/layer-graph.mjs` — verify it still resolves; re-run and paste findings.
- `docs/architecture/GUIDE_PRISMA_AND_NEON_ARCHITECTURE.md` — the fallback subsystem section.
- `CLAUDE.md` — the "Dual-layer store" section names `src/lib/serverStore.ts` throughout, and the
  test counts are stale.
- `docs/README.md` — index entry for this file.

Then sweep for stragglers:

```bash
grep -rln "lib/serverStore\|lib/petStore\|lib/prisma\|lib/userStore" docs CLAUDE.md AGENTS.md
```

---

## 6. Rollback

Each phase is one commit and changes no runtime behaviour — every edit is a move plus a specifier
rewrite. `git revert` of a single phase commit is clean. Do not squash the three phases.

---

## 7. Explicitly out of scope

- Any `src/features/` directory. Revisit only if, after §2–§4, locality is still the top complaint.
- Moving `admin/` components. They are cross-domain by nature; see §0.
- Splitting `src/lib/i18n/translations.ts` (1,045 lines). Real, but `tests/unit/i18n.test.ts`
  enforces key parity across both dictionaries and splitting risks that guard. Separate plan.
- Re-homing `medicalTimeline.ts` / `matchEngine.ts` into `domain/`. Separate judgment call.
- Collapsing `getServerRehabNeedsAsync` / `getServerFaqsAsync`. Cosmetic; not worth the diff noise
  inside a restructure.

---

## 8. Rejected designs — do not re-propose

Recorded so a future reader (or agent) does not rediscover these as fresh ideas.

| Design | Why it fails here |
|---|---|
| Shared mutable `fallback` holder exporting all four caches | Gives every repository write access to every domain's state — the exact coupling the split removes. Unnecessary: the real coupling is one-way, so a single narrow import expresses it. |
| `export let serverPets` from a shared module | Importers bind the array *identity*. `resetServerStore()` reassigns, so importers would silently keep the pre-reset array and every suite's isolation would rot. |
| Split first, move `prisma.ts` after | Rewrites the five new repository modules one commit later purely to chase a path. Moves first. |
| `rehabNeedsRepository.ts` / `faqRepository.ts` | Zero Prisma calls in either. Encodes a false claim into the layer map the guards enforce. |
| Re-export shim at `src/lib/serverStore.ts` during migration | A barrel. `CLAUDE.md` forbids them and `f031b93` already removed the last set. 15 importers is a one-commit rewrite. |
| Guard rules exempting test-file importers | `layerBoundaries.test.ts` walks `src/` only. Test files never enter the graph, so the exemption guards nothing. |
