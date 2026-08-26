# Plan: `src/lib/` Restructure — Split the Repository, Surface the Runtime Boundary

**Status**: approved, **not started**. Blocked on the TNRM sprint landing (see §1).
**Decision date**: 2026-08-26
**Scope**: `src/lib/` only. No file outside `src/lib/` moves. No feature folders are created.

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

Its one real benefit is making the RSC boundary physically visible. §3 below buys that for six
file moves instead of 123, and §4 enforces it mechanically rather than by convention.

### Chosen — targeted split, layer contract preserved

`docs/architecture/LAYERS.md` already names every layer, assigns ownership, and fixes legal
dependency directions; `tests/unit/layerBoundaries.test.ts` already fails CI on violations. That
contract is an asset. This plan **splits the one module that outgrew it** and **moves six files
so the tree stops contradicting it** — it does not replace it.

---

## 1. Precondition — do not start before this is true

```bash
git status --porcelain    # must be empty
npm test && npx tsc --noEmit && npm run lint
```

At time of writing the branch carries ~1,300 modified lines across 20 files plus ~1,850
untracked lines, and **the sprint diff itself touches `src/lib/serverStore.ts` (+91)**. Starting
Phase 1 before those land guarantees conflicts in the exact file being split.

Record the pre-move baseline and assert it unchanged at each phase gate:

```bash
npm test 2>&1 | tail -5   # baseline: all green
```

---

## 2. Phase 1 — split `src/lib/serverStore.ts` (883 lines into 5 modules)

### Why this file first

It is the only genuine architectural problem in the tree: one module owning pets, applications,
rehab needs and FAQs, plus the fallback lifecycle all four share. Every other complaint about
`src/lib/` is cosmetic by comparison.

### Target

```
src/lib/server/
├── fallbackState.ts          # the shared half — and ONLY the shared half
├── petRepository.ts          # lines 15-380 (mappers/payloads) + 430-450, 490, 573-678
├── applicationRepository.ts  # lines 453-489, 495, 679-882
├── rehabNeedsRepository.ts   # lines 500-536
└── faqRepository.ts          # lines 537-572
```

### `fallbackState.ts` — the only subtle part

The four caches are `let` bindings mutated in place by writers and **reassigned** by
`resetServerStore()`. A plain `export let` cannot survive the split: importers would bind the old
array and silently miss every reset. Export one mutable holder instead, so reset reassigns
properties while repositories keep mutating arrays in place — preserving today's semantics exactly:

```ts
export const fallback = {
  pets: freshPets(),
  applications: freshApplications(),
  rehabNeeds: freshRehabNeeds(),
  faqs: freshFaqs(),
};

export function resetServerStore(): void {
  fallback.pets = freshPets();
  fallback.applications = freshApplications();
  fallback.rehabNeeds = freshRehabNeeds();
  fallback.faqs = freshFaqs();
}
```

The `structuredClone` seeding must be carried over verbatim — the comment at line 389 explains why
a spread corrupts the JSON fixture for the rest of the process, and the hermetic test lifecycle
depends on it.

### What is NOT shared

`byDateAscending`, `mapHistoryRows`, `mapDbPetUpdate`, `mapDbMedicalTimelineEvent` and every
`Db*Record` / `*Payload` type are **pet-only**. They move wholesale into `petRepository.ts`; do
not promote them into a shared module "just in case".

### Importers to update — all 15, in one commit, no barrel

`src/lib/serverStore.ts` is **deleted**, not left as a re-export shim: `CLAUDE.md` forbids
barrels, and `f031b93` already removed the last set.

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

Two need care beyond a path rewrite:

- **`tests/setup/nextMocks.ts`** imports `resetServerStore` **dynamically inside the hook** on
  purpose — a static import would instantiate the real `@/lib/prisma` before a test file's own
  `vi.mock("@/lib/prisma")` registers, making Prisma spies observe zero calls. Keep the dynamic
  import; change only the specifier, now `@/lib/server/fallbackState`.
- **`tests/unit/layerBoundaries.test.ts`** hardcodes the Prisma-importer allowlist. See §4.

### Gate

`npm test` green, `npx tsc --noEmit` clean, no file in `src/lib/server/` over ~400 lines.

---

## 3. Phase 2 — de-junk-drawer `src/lib/` (22 loose files)

Six of those 22 carry `"use client"` and sit indistinguishable from server modules. Moving them
makes the RSC boundary legible in the file tree — and makes §4's guard expressible as a path rule
instead of a hand-maintained list.

### Moves

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
| `lib/userStore.ts` | `lib/server/userStore.ts` | 6 |
| `lib/prisma.ts` | `lib/server/prisma.ts` | 6 |

Use `git mv` so rename detection keeps history followable.

### Deliberately NOT moved

`utils.ts` (11 importers, framework-level `cn`), `medicalTimeline.ts`, `matchEngine.ts`,
`imageOptimization.ts`, `email.ts`, `persistenceMode.ts`, and the `domain/ security/ validations/
i18n/ storage/` directories. `medicalTimeline` and `matchEngine` are pure domain math and are
arguably `domain/` residents — a **separate**, later judgment call, not this plan's.

### Resulting shape

```
src/lib/
├── client/        6 "use client" localStorage stores
├── presentation/  status → badge/label mappers, filters, CSV export
├── server/        5 repository modules + userStore + prisma
├── domain/        unchanged
├── security/      unchanged
├── validations/ i18n/ storage/   unchanged
└── utils.ts  email.ts  matchEngine.ts  medicalTimeline.ts  imageOptimization.ts  persistenceMode.ts
```

---

## 4. Phase 3 — make the new boundaries mechanical

Naming a convention that nothing checks is how `src/lib/` became a junk drawer in the first place.
Extend `tests/unit/layerBoundaries.test.ts` — it already builds the full import graph, so each rule
below is an assertion over data it computes today:

1. **Update the Prisma allowlist** (currently `serverStore.ts`, `userStore.ts`,
   `domain/auditLog.ts`) to the new paths. Phase 1 raises the count from 3 to 6; the test's own
   comment says that is a design decision to be recorded in `LAYERS.md` §L-B2 — do so.
2. **New: `src/lib/client/*` is importable only from client modules.** Any importer whose module
   is not `isClient` is a violation. The graph already carries `isClient`.
3. **New: `src/lib/server/*` is importable only from** `src/actions/`, `src/app/`,
   `src/lib/server/`, and tests. Catches a client component reaching for a repository.
4. **New: `src/lib/presentation/*` must not import `src/lib/server/*`.** Presentation stays pure.

Guard the guards the way the existing suite does — its first test asserts the graph found more than
50 modules precisely so a broken walker cannot make everything pass vacuously. Each new rule needs a
non-empty subject set asserted alongside it.

---

## 5. Documentation to update in the same PR

Structure docs that go stale are worse than none. 46 of 53 doc files reference `src/` paths; these
are the ones this plan actually invalidates:

- `docs/architecture/LAYERS.md` — L-B2 file list, the Prisma allowlist note, L-F4 store paths.
- `docs/architecture/layer-graph.mjs` — verify it still resolves; re-run and paste findings.
- `docs/architecture/GUIDE_PRISMA_AND_NEON_ARCHITECTURE.md` — the fallback subsystem section.
- `CLAUDE.md` — the "Dual-layer store" section names `src/lib/serverStore.ts` throughout.
- `docs/README.md` — add this file to the index.

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
