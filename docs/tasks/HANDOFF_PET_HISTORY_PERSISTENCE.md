# Handoff — Persisting Pet History (`updates[]` and `medicalTimeline[]`)

**Date**: 2026-08-19
**Branch**: `master`
**Baseline**: 26 test files / 223 tests green · `npx tsc --noEmit` clean · `npm run build` passing
**Predecessor commit**: `317c333 feat(rehab): propagate In Rehabilitation status through every layer`

> **Scope**: this document resolves open item **P3** in the
> [TNRM & Rehabilitation Sprint handoff](HANDOFF_TNRM_REHABILITATION_SPRINT.md), which left the
> nested-collection modeling choice open. That document remains the authority on overall branch
> state, shipped work, and the full prioritized backlog; this one covers only the decision, the
> reasoning behind it, and the plan that follows from it.

---

## 1. Where things stand

The TNRM / rehabilitation sprint is closed for status and scalar progress fields. `PetStatus`
carries `'In Rehabilitation'` plus the legacy alias `'Rehabilitation'`, and the three rehab
scalars (`rehabStage`, `rehabStageMs`, `rehabProgressPercent`) travel end to end: type →
state machine → Zod validations → Prisma schema → `serverStore` → server actions → admin form.

Two structural improvements landed alongside it and are worth knowing about before you touch
the store:

- **`mapDbPetToPet(row)`** — the database-row → domain-`Pet` translation, extracted from inside
  `getServerPetsAsync` so it can be tested directly. Nullable columns become `undefined`.
- **`buildPetPersistencePayload(pet)`** — the flat column set written on save. `insertServerPet`
  and `updateServerPet` previously duplicated ~24 lines of column mapping each; they now share
  this one builder, so a new column cannot be added to one path and forgotten on the other.

### One defect fixed, worth remembering

`updateServerPet` / `updatePet` merged new data over old with `{...existing, ...validated}`.
Zod omits absent optional keys from its output, so a payload that simply *left out*
`rehabStage` did not clear it — a cleared animal kept a stale progress bar indefinitely.

This was caught only because a test that passed on its first run was re-examined: it had passed
for the wrong reason (`createPet` was dropping the fields entirely, so there was no stale value
to leave behind). The fix makes the submitted payload authoritative for rehab fields, matching
how every other form field already behaves.

**This same trap applies directly to the next task.** Removing a timeline event by omitting it
from the payload must actually delete the row.

---

## 2. What remains: nested collections

`Pet.updates[]` and `Pet.medicalTimeline[]` are declared in `src/types/pet.ts` and render
correctly today, but they exist **only** in the `src/data/pets.json` fixture. They are absent
from `prisma/schema.prisma`, `DbPetRecord`, `mapDbPetToPet` and `buildPetPersistencePayload`.

Consequences:

- Clinical events entered through the admin portal do not survive.
- A pet that exists only in the database — created after launch — has no stored timeline, so
  `getPetMedicalTimeline` falls back to its synthetic generated timeline instead of real history.

Current fixture coverage: all 10 seeded pets carry `medicalTimeline`; `pet-009` (Tuah) and
`pet-010` (Comel) carry `updates`.

---

## 3. Decision: relational tables, not `Json` columns

**Use two tables — `PetUpdate` and `MedicalTimelineEvent` — each with a `petId` foreign key and
`onDelete: Cascade`.** This decision is settled; do not re-open it without new information.

### Why this is the more elegant option, not merely the more correct one

The `Json`-column alternative looks like half the work. It is not, once this project's own rules
are honored:

1. **It would not actually be type-safe.** Prisma types a `Json` column as `JsonValue`, which is
   not `MedicalTimelineEvent[]`. `AGENTS.md` mandates strict TypeScript with no `any`, so every
   read would need a Zod parse at the boundary to recover the real type. The "cheap" option adds
   a runtime validation layer rather than removing one.
2. **It would introduce a second persistence idiom.** `AdoptionApplication` is already a
   relational child of `Pet`. Adding two more child tables reuses the one pattern the codebase
   has. Mixing blobs and rows means future readers must ask which kind of child they are dealing
   with — elegance here is one idiom applied consistently.
3. **The data is compliance data.** Medical events carry `verified` and `veterinarian`. This
   project already produces ROS AGM audit exports and LHDN tax receipts. Rows can be queried
   across pets ("surgeries funded this quarter"); a blob cannot.

### A tempting variant, rejected

A single `PetHistoryEvent` table with a `kind` discriminator would share roughly 60% of the
columns. Reject it: the two shapes have *different closed category sets* (`intake` /
`diagnostic` / `treatment` / `vaccination` / `surgery` / `clearance` versus `medical` /
`rehabilitation` / `milestone` / `socialization`), so a single category column would be only
conditionally valid, and every query would filter by `kind`. Two tables mirroring the two
existing domain types keep storage aligned with the domain.

---

## 4. Plan

Work test-first. Write the tests, run them, and confirm they fail before implementing.

| # | Step | Files |
|---|------|-------|
| 1 | Write failing tests | `tests/unit/petHistory.test.ts` |
| 2 | Add `PetUpdate` + `MedicalTimelineEvent` models | `prisma/schema.prisma` |
| 3 | Extend row type, mapper, and save paths | `src/lib/serverStore.ts` |
| 4 | Zod schemas for both event shapes | `src/lib/validations/pet.ts` |
| 5 | Carry history through create/update | `src/actions/pets.ts`, `src/lib/petStore.ts` |
| 6 | Preserve the synthetic-timeline fallback | `src/lib/domain/medicalTimeline.ts` |
| 7 | Run the full gate | — |
| 8 | Apply to a real database (**manual**) | `npm run db:push` |

### Implementation notes

- **Keep the fixture IDs.** `tl-001-1`, `up-009-1` — use them as the primary key (`String @id`)
  rather than switching to `cuid()`, so existing seed data round-trips unchanged.
- **Keep `date` as `String`** in `YYYY-MM-DD` form. It matches the current TypeScript type and
  the bilingual formatting in `src/lib/domain/medicalTimeline.ts`, and avoids timezone drift.
- **Order by date on read.** Fixture order is currently incidental; make it explicit.
- **`buildPetPersistencePayload` needs deliberate splitting.** It returns one flat column set
  shared by create and update. Nested relations cannot travel that way — create nests a
  `create`, update must clear-then-write. Split it consciously; do not reintroduce the
  insert/update duplication the builder was added to remove.
- **`getPetMedicalTimeline` must keep working unchanged.** A pet with stored events shows those;
  a pet without still gets the synthetic timeline. `tests/unit/medicalTimeline.test.ts` must stay
  green with no edits.

### Test coverage to require

- Round-trip: save a pet with history, read it back, nothing dropped.
- Events return ordered by date.
- Bilingual fields survive (`titleMs`, `contentMs`, `descriptionMs`, `badgeMs`).
- Deleting an event actually deletes it — **including when the payload omits the key entirely**,
  not just when it is set to `undefined`. See §1.
- A pet with no stored events still receives the synthetic timeline.

### Gate

```bash
npm test           # 223 existing + new, all green
npx tsc --noEmit   # must be silent (it typechecks tests/ too)
npm run lint       # 1 pre-existing error in scratch/ — leave it, per AGENTS.md
npm run build
```

---

## 5. Blockers and scope

Repository-wide open items — the `AGENTS.md` token exposure, the stray `claude@^0.1.1`
dependency, and the unwired `faqs.json` / `rehabNeeds.json` readers — are tracked in the
[sprint handoff](HANDOFF_TNRM_REHABILITATION_SPRINT.md) and are not restated here. Two items
bear directly on this task:

- **`npm run db:push` is still outstanding.** The three rehabilitation columns from `317c333`
  exist in `prisma/schema.prisma` but not in any live database, and the two new tables will
  extend that gap. Tests pass regardless, because every read falls back to in-memory fixtures —
  which means **the test suite cannot tell you whether the migration has been applied**. Applying
  it needs a live `DATABASE_URL` and is a deliberate human decision.
- **Scope is persistence only.** Whether the admin portal also gains an editor for timeline
  events is undecided. If it does, the Zod schemas from step 4 are the natural contract for it.

Since `06f7a26`, `.gitignore` covers `.mcp.json`, `.vscode/`, `.claude/settings.local.json`,
`/scratch/`, and `obsidian-api.http`. `AGENTS.md` is tracked and therefore still exposed.
