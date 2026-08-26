# Engineering Handoff: TNRM & Rehabilitation Sprint

- **Status as of**: 2026-08-19
- **Branch**: `feat/tnrm-rehabilitation` — 4 commits ahead of `master` (`077eed6`), **not pushed**
- **Quality gates**: `npx tsc --noEmit` clean · **26 Vitest suites, 223 tests, 100% passing** · `eslint src` 0 errors, 4 warnings
- **Fast-forward**: `git checkout master && git merge --ff-only feat/tnrm-rehabilitation`

The sprint's *status* work is complete end to end. What remains is the nested-collection modeling
decision, the read paths for two new fixtures, and the UI that presents rehabilitating animals.

---

## 1. 📦 What Shipped

| Commit | Scope |
|---|---|
| `317c333` | `feat(rehab)`: propagate `In Rehabilitation` status through every layer |
| `b268b66` | `refactor(donations)`: move the sponsorship tier catalog into the domain layer |
| `3caa738` | `feat(data)`: bilingual rehabilitation needs and FAQ fixtures |
| `0bdb1b7` | `docs`: layer map, project guide, refreshed documentation portal |

### Starting point

`src/types/pet.ts` had been widened ahead of every layer beneath it — `PetStatus` gained
`'In Rehabilitation'` and `'Rehabilitation'`, and `Pet` gained `rehabStage`, `rehabStageMs`,
`rehabProgressPercent`, and `updates[]`. Nothing below the type knew about any of it, so
`npx tsc --noEmit` failed in four places. The fix propagated the widening downward rather than
narrowing the contract back.

### Layer-by-layer result

| Layer | File | Change |
|---|---|---|
| Domain | `src/lib/domain/stateMachine.ts` | `normalizePetStatus()` + rehab entries in `PET_TRANSITION_GRAPH` |
| Validation | `src/lib/validations/pet.ts` | `PET_STATUS_VALUES` / `PET_STATUS_FILTER_VALUES`, rehab field schemas |
| Actions | `src/actions/pets.ts` | canonical status comparison in `getPublicPets` |
| Store | `src/lib/serverStore.ts`, `src/lib/petStore.ts` | rehab scalars read and written |
| Schema | `prisma/schema.prisma`, `prisma/seed.ts` | `rehabStage` / `rehabStageMs` / `rehabProgressPercent` columns, seeded |
| Admin UI | `src/components/admin/PetFormDialog.tsx` | status option + conditional rehab fields |
| Fixtures | `src/data/pets.json` | `pet-009` (Tuah), `pet-010` (Comel) |
| Tests | `tests/unit/rehabilitation.test.ts`, `stateMachine.test.ts`, `layerBoundaries.test.ts` | lifecycle, persistence, and layer-boundary guards |

---

## 2. 🧭 Decisions Worth Knowing

**`Rehabilitation` is a legacy alias of `In Rehabilitation`.** Both spellings appear in the
architecture contract, so both remain valid input. `In Rehabilitation` is canonical. **Never compare
pet statuses as raw strings** — run them through `normalizePetStatus()` first, or filtering for one
spelling silently drops rows stored under the other. `getPublicPets` already does this.

**Transition rules** follow the clinical workflow in
[`RUNBOOK_TNRM_AND_SPONSORSHIP_OPERATIONS.md`](../runbooks/RUNBOOK_TNRM_AND_SPONSORSHIP_OPERATIONS.md):
an animal enters rehabilitation from `Available` or `Pending`, and leaves **only** via veterinary
clearance back to `Available`. There is deliberately no direct path from rehabilitation to `Adopted`
or `Pending` — an animal under care is not adoptable. Illegal moves throw `DomainValidationError`.

**Rehab detail is conditional on status.** `petFormSchema` rejects `rehabStage` / `rehabStageMs` /
`rehabProgressPercent` on a pet that is not under care, and `PetFormDialog` clears those fields when
the status is changed away. This prevents stale "Stage 2: Orthopaedic Recovery" text surviving on an
adopted animal.

**Sponsorship tiers moved to the domain layer.** `submitDonationPledgeAction` was importing
`SPONSORSHIP_TIERS` from `sponsorshipStore.ts`, a `"use client"` module — a Server Action depending
on client code to resolve a tier name for an LHDN receipt. The catalog now lives in
`src/lib/domain/sponsorshipTiers.ts`, and `tests/unit/layerBoundaries.test.ts` enforces the boundary
rather than merely documenting it.

---

## 3. 🔐 Uncommitted On Purpose

Five things were left dirty in the working tree. Three of them are the same credential.

| Item | Why it was not committed |
|---|---|
| `AGENTS.md`, `.mcp.json`, `obsidian-api.http` | All three contain the **Obsidian Local REST API bearer token**. Committing writes it into history permanently; removing it later needs a history rewrite. |
| `package.json`, `package-lock.json` | Add `claude@^0.1.1` to runtime `dependencies` with **zero importers** anywhere in `src/`, `tests/`, or `prisma/`. Looks like a stray `npm i`. |
| `.claude/`, `.vscode/`, `scratch/` | Local editor and scratch state. |

**Recommended**: rotate the Obsidian token, move it to `.env.local`, and have `.mcp.json` read it
from the environment. Run `npm rm claude` if the dependency was accidental. Add `scratch/`,
`.vscode/`, and `.claude/settings.local.json` to `.gitignore` — `scratch/` especially, since it sits
inside `tsconfig`'s `**/*.ts` include and its errors break the project typecheck.

---

## 4. 🎯 Open Items, Prioritized

### P1 — Authentication secrets fall back to literals

| Secret | Location | Fallback |
|---|---|---|
| `SESSION_SECRET` | `src/lib/security/crypto.ts:3` | hardcoded string |
| `ADMIN_SECRET_KEY` | `src/lib/auth.ts:21` | `"hope_shelter_admin_secret_key_2026"` |
| `STAFF_INVITE_SECRET` | `src/actions/auth.ts:15` | `"1234"` |

Worse, `registerAction` (`src/actions/auth.ts:137`) accepts `"HOPE2026"` or `"1234"` as invite codes
**regardless** of the environment variable. A deploy that forgets these env vars lets anyone
self-register a staff account, and signs session cookies with a key that is in the public repository.
Fail startup on missing secrets in production instead of defaulting.

### P2 — The ROS registration number is inconsistent

Two digit-transposed variants are in use, and the wrong one lands on statutory documents:

| Value | Appears in |
|---|---|
| `PPM-012-10-18042016` | Footer, donate page, privacy, terms, README |
| `PPM-021-10-18082021` | `src/actions/donations.ts:13`, `src/lib/exportCsv.ts:224,257`, `SponsorshipModal.tsx:296` |

The second set feeds **LHDN Section 44(6) tax e-receipts and ROS CSV exports**. Check the actual ROS
certificate and make one of them authoritative — ideally sourced from `ShelterSettings` rather than
duplicated across six files.

### P3 — Nested collections: a modeling decision, not an oversight

`Pet.updates[]` and `Pet.medicalTimeline[]` are typed but have no columns and no mapper, so they are
**fixture-only**. Porting them means choosing between a `Json` column (cheap, unqueryable, no
referential integrity) and a related table (queryable, indexable, migration cost).
[`LAYERS.md §6`](../architecture/LAYERS.md) frames the trade-off. Note the failure mode: an optional
`Pet` field missing from the schema produces no type error, no runtime error, and no data — it
returns `undefined` forever once a real database is serving, while the JSON fallback hides it
completely in development.

### P4 — `faqs.json` and `rehabNeeds.json` have no reader

Both fixtures are committed and bilingual; neither has a Server Action or store reading it
(Backend Module 03). The donate page and `PetsFaqSection` still hardcode their FAQ arrays inline.

### P5 — No UI presents rehabilitating animals

`getPublicPets()` now returns 10 pets including the two in rehab, but `PetCard` only branches on
`isAvailable = status === "Available"`, so they render as ordinary unavailable cards, and the
`PetGallery` status filter offers no rehab option. This is FE-04 / FE-05 in the
[sprint plan](SPRINT_PLAN_BACKEND_AND_FRONTEND.md): the Adoptable vs In Rehab subcategory tabs, the
`rehabStage` badge, and the progress indicator.

### P6 — Barrels with zero adoption

`@/lib/stores`, `@/lib/security`, `@/lib/services`, and `@/components` have no importers; every
module imports concrete paths. `@/lib/security` re-exports a `"use client"` module, so the first
server-side adopter breaks the build. Adopt them or delete them — see
[`LAYERS.md §5`](../architecture/LAYERS.md).

### P7 — The admin portal still shows rehab animals as Available ✅ RESOLVED 2026-08-26

P5 covered the public catalog only. `src/components/admin/PetDataTable.tsx:169-181` branches on raw
status strings with **no rehab arm**, so both `In Rehabilitation` and the legacy alias fall through to
the default emerald "Available" badge; the status filter at `:297-306` omits rehab entirely, so those
animals belong to no bucket and the counts do not sum to the total. See
[Target: Admin Status Parity](TARGET_ADMIN_STATUS_PARITY.md) §7 for what shipped, including three
further defects of the same family found while fixing it (the filter predicate in the controller, the
row quick-status select, and the edit form seeding an aliased status).

---

## 5. 🚀 Picking This Up

```bash
npm install
npx prisma generate      # REQUIRED — see gotcha below
npm run dev

npm test                 # 26 suites, 223 tests
npx tsc --noEmit         # includes scratch/
npm run lint

npm run db:push          # apply the rehab columns to Postgres
npm run db:seed          # writes pet-009 / pet-010 with rehab detail
```

### Gotchas that cost time

1. **Regenerate the Prisma client after pulling.** The schema gained three columns. A stale client
   rejects writes carrying them — and `serverStore` catches the error, falls back to memory, and
   reports success. A save that silently does not persist is almost always this.
2. **The dual-layer store swallows database errors** by design (`console.warn` in development only).
   When data looks wrong, check which layer answered before debugging the caller.
3. **i18n keys must be added in three places** — the `TranslationDictionary` interface plus both
   dictionaries. `tests/unit/i18n.test.ts` enforces parity, so a half-added key fails CI.
4. **Vitest 4 removed the `basic` reporter.** `vitest run --reporter=basic` crashes; use the default.
5. **`prisma/` is excluded from `tsconfig`**, so `seed.ts` is never typechecked by `npm run lint` or
   `tsc`. Check it standalone after editing.
6. The 4 ESLint warnings are all React Compiler "incompatible library" notices from `react-hook-form`
   and TanStack Table. Pre-existing and expected.

### Orientation

Read [`docs/architecture/LAYERS.md`](../architecture/LAYERS.md) first — it names every layer, the
legal dependency directions, and the open violations. [`CLAUDE.md`](../../CLAUDE.md) is the condensed
version for agents. The [sprint plan](SPRINT_PLAN_BACKEND_AND_FRONTEND.md) holds the remaining
backend and frontend task breakdown.
