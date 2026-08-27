# Test Tiers 3, 4 & 5 — what landed, and what the specs got wrong

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Commit**: `edffe74`
**Supersedes**: the four `TEST_TASK_0*.md` specs, now in `docs/archives/tasks/`

---

## 1. What landed

| Tier | Location | Count | Runs via |
|---|---|---|---|
| 3a — strict persistence, no database | `tests/integration/*.test.ts` | 3 files / 39 tests | `npm run test:integration` |
| 4 — client components | `tests/components/` | 4 files / 53 tests | `npm run test:components` |
| 5 — browser golden paths | `e2e/specs/` | 5 files / 23 tests | `npm run test:e2e` |
| CI | `.github/workflows/ci.yml` | 4 parallel jobs | GitHub Actions |

`npm run test:all` — 51 files / 638 tests. `test:e2e` — 23 passed. `tsc` clean,
`lint` 0 errors, `layer-graph.mjs` exit 0.

Tier 3b (`tests/integration/db/`, real Postgres) belongs to the parallel
donation-ledger workstream and is untouched here.

---

## 2. Where the archived specs were wrong

They were written 2026-08-26, before the `src/lib/` restructure landed in
`d554edb`. Anyone reading them should know:

- **Modules moved.** `src/lib/serverStore.ts` and `src/lib/prisma.ts` are now
  `src/lib/server/{petRepository,applicationRepository,prisma}.ts`.
- **Every action name in TASK_03 is wrong.** There is no `createPetAction`,
  `updatePetAction`, `archivePetAction`, `getPetsAction`,
  `submitApplicationAction` or `trackApplicationAction`. The real names are
  `createPet`, `updatePet`, `toggleArchivePet`, `getPublicPets` / `getAdminPets`,
  `submitApplication`, `lookupApplicationStatusAction`.
- **`AdoptionModal.tsx` does not exist** — it is `AdoptionForm.tsx`, and it is a
  **single-step** form (three labelled sections plus a confirmation screen). The
  brief's "multi-step progress" describes a feature nobody built.
- **Roving tabindex is not in `PetChooserCarousel`.** It is in
  `PetDetailView.tsx:251-280`. The carousel is a scroll region of plain buttons.
- **URL deep linking is not in `PetChooserCarousel` either.** It is in
  `DonationWidget.tsx:38-85`, which reads `?pet`, `?sponsorPetId`, `?tier` and
  `?freq`. Each behaviour is now tested where it actually lives.
- **TASK_03 §2.A's blocker is stale.** It says the integration lane cannot reach
  a database. Neon was reachable throughout this work.

---

## 3. The traps worth knowing

### 3.1 The repositories are cache-authoritative for lookups

`findServerPetById` and `findServerApplicationById` read the in-memory fixture
array, **not** Postgres, and `atomicUpdateApplicationStatus` returns
`"Application not found"` for any id absent from it. A Tier 3 test that asserts
through those finders proves nothing about persistence. Round-trip through
`getServerPetsAsync()` / `getServerApplicationsAsync()` / `getPublicPets()` or
direct Prisma instead. This is the single easiest way to write a
green-but-worthless integration suite.

### 3.2 `getServerPetsAsync` only trusts a non-empty result

It falls through to fixtures when the query returns zero rows. An empty table is
not a failure and strict mode does not make it one — which is what keeps the app
usable with no database. A test arranging zero rows is therefore exercising the
fallback, not the database.

### 3.3 Node 26 shadows jsdom's `localStorage`

Node 26 ships a built-in `localStorage` global that throws unless started with
`--localstorage-file`, and it shadows the working one jsdom installs. Every
access from `usePetStore` / `useApplicationStore` threw and was swallowed by
their own `try/catch`, so the stores silently served fixture data.
`tests/setup/componentSetup.ts` probes with a real round-trip and installs a
shim when the global is unusable.

### 3.4 `type="email"` hides your validation from your tests

Native constraint validation cancels the submit event before React sees it, so
an obviously-malformed address never reaches Zod and no message renders. To test
the *application's* validation, use a value that passes the browser and fails the
schema (`nurul@example` — no dot in the domain).

### 3.5 The donation companion card is conditional

The headline that names the dedicated animal renders only for monthly giving or
the kibble tier. It is the widget's only textual rendering of the selection, so
assertions about the carousel's chosen animal must set one of those first.

---

## 4. Defect fixed here

`AdoptionForm.tsx` offered `housingType` values —
`own_house_yard | rent_house_yard | apartment | condo` — that
`adoptionFormSchema` rejects, and the select renders no validation message.
Choosing anything but "Other" failed Zod silently and the submit button appeared
dead. Options are now derived from a `Record` keyed on the schema's own union,
so adding a value without labelling it is a compile error. Locked by a contract
test in `tests/components/AdoptionForm.test.tsx`.

---

## 5. Open findings — reported, not fixed

1. **Schema drift on Neon.** `donations` and `receipt_sequences` are declared in
   `prisma/schema.prisma` but do not exist in the Neon database; `db:push`
   predates those models. The sponsorship E2E therefore exercises the in-memory
   ledger fallback, which is what the running app does today.
2. **`PetChooserCarousel` has no accessible selected state.** The chosen card is
   marked with colour and a check icon only — no `aria-pressed` or
   `aria-current`. A keyboard or screen-reader user cannot tell which animal is
   selected, and tests must assert through `DonationWidget`'s text instead.
   Adding `aria-pressed` to the cards would fix both.
3. **`AdoptionFormData` in `src/types/pet.ts` is dead code** carrying the same
   wrong `housingType` union that was just fixed in the component. Nothing
   imports it. It is a landmine for the next author.
4. **Deep-link precedence is order-dependent.** `DonationWidget` resolves the
   animal with a single `find` over an OR of `sponsorPetId` and `pet`, so on a
   disagreeing pair the earlier animal in the catalogue wins regardless of which
   key matched. Nothing the app generates produces a disagreeing pair. Current
   behaviour is pinned by a test that says so explicitly.
5. **Pre-existing lint warnings** (5, all `react-hooks/incompatible-library`
   React Compiler advisories) in `src/components/admin/*` and elsewhere. Not
   introduced here.

---

## 6. Running them

```bash
npm run test:unit          # tiers 1-2
npm run test:components    # tier 4, jsdom
npm run test:integration   # tier 3a, STRICT_PERSISTENCE=true, no database needed
npm run test:all           # tiers 1-4; deliberately excludes integration-db
npm run test:e2e           # tier 5; starts its own dev server on port 3100
```

E2E writes to whatever `DATABASE_URL` points at and cleans up after itself: the
lifecycle spec archives then restores, and the review spec winds its status
change back and deletes the applications the adoption spec submits. Verified
against Neon — 8 pets / 0 archived / 3 applications, identical before and after.

The suites were mutation-checked rather than assumed: removing the archive
filter from `getPublicPets` turns three soft-delete tests red.
