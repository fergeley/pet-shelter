# Target — Admin Status Parity

**Date**: 2026-08-26
**Branch**: `feat/tnrm-rehabilitation`
**Baseline**: 30 test files / 357 tests green · `npx tsc --noEmit` clean
**Predecessor commit**: `bf941c5 chore: update settings.json`

> **Scope**: this document records open item **P7** in the
> [TNRM & Rehabilitation Sprint handoff](HANDOFF_TNRM_REHABILITATION_SPRINT.md), newly identified —
> it was not in the P1–P6 list. It is the **admin-side follow-on to P5**, which covered only the
> public catalog (`PetCard`, `PetGallery`) and was resolved by
> `4e9bdf4 feat(ui): surface rehabilitating animals across the catalog`.
>
> Found while auditing every `badgeClass` render site during the lucide import refactor
> (`b48d712 refactor(ui): tighten lucide-react icon imports`).

---

## 1. 🔴 Why this is the next target

Every claim below was read from the source on the date above.

**The public catalog now presents rehabilitating animals correctly. The admin portal does not —
it renders them as green "Available".** Staff running the sprint's own feature see the wrong state.

`src/types/pet.ts:4` defines five members:

```ts
export type PetStatus = 'Available' | 'Pending' | 'Adopted' | 'In Rehabilitation' | 'Rehabilitation';
```

`src/components/admin/PetDataTable.tsx:169-181` branches on three of them, with the **default arm
styled as Available**:

```ts
let badgeClass = "bg-emerald-800 text-white dark:bg-emerald-950 …";  // ← the fallthrough
let Icon = CheckCircle2;

if (status === "Pending") { … }
else if (status === "Adopted") { … }
```

There is no rehab branch, so both `'In Rehabilitation'` and the legacy `'Rehabilitation'` alias fall
through to emerald + `CheckCircle2`.

| Defect | Location | Consequence |
|---|---|---|
| No rehab branch; default arm is Available | `PetDataTable.tsx:169-181` | Animals under veterinary care display to staff as adoptable |
| Raw string comparison | `PetDataTable.tsx:173,177` | Violates the `normalizePetStatus()` rule in `CLAUDE.md`; the two rehab spellings can never be handled |
| Renders the raw union member | `PetDataTable.tsx:189` | One state prints under two different spellings depending on which alias the row carries |
| Status filter omits rehab; counts compare raw strings | `PetDataTable.tsx:297-306` | Rehab pets are unreachable by filter and belong to no bucket — present in the "All Statuses" total, absent from every option |

The last row means the counts do not sum to the total. A staff member reconciling the tabs against
`All Statuses ({pets.length})` finds animals that exist but appear nowhere.

### Secondary — the same shape, duplicated

`src/components/admin/ApplicationDataTable.tsx:131-146` is the identical inline `let badgeClass` /
`let Icon` if-else chain for application status. It **is** exhaustive over its states, so it is not
buggy — but it is the second copy of a decision the codebase already models properly, and it will
drift the same way the pet table did the moment a status is added.

---

## 2. What already exists to reuse

The public side solved this. Nothing new needs designing:

| Module | Provides |
|---|---|
| `src/lib/petStatusPresentation.ts` | `getPetStatusPresentation(status)` → `{ tone, labelKey, labelFallback, badgeClass, isAdoptable, isInRehabilitation }`, normalized through `normalizePetStatus()` so both aliases collapse to one tone |
| `src/components/features/pets/PetStatusIcon.tsx` | `<PetStatusIcon tone={…} />` — exhaustive `Record<PetStatusTone, LucideIcon>`, so a new tone fails the typecheck until a glyph is chosen |
| `src/lib/petStatusPresentation.ts` (`matchesStatusFilter`) | Filter comparison that normalizes **both** sides — exactly what the `<select>` counts need |
| `tests/unit/petStatusPresentation.test.ts` | Already covers alias-equivalence, tone distinctness, and adoptability |

---

## 3. ⚠️ The one real decision

**The two badge palettes are not the same, and this is not a detail.**

| | Light | Dark |
|---|---|---|
| `petStatusPresentation.badgeClass` | `bg-emerald-800` (caller adds `text-white`) | `dark:bg-emerald-900` |
| `PetDataTable` inline | `bg-emerald-800 text-white` | `dark:bg-emerald-950 dark:text-emerald-200 dark:border dark:border-emerald-800` |

The public badge is a solid fill in both themes; the admin badge is a tinted, bordered chip in dark
mode. Reusing `badgeClass` verbatim **will change the admin table's dark-mode appearance.**

Pick one before writing code:

- **(a) Extend the record** with a second variant (e.g. `chipClass`) so both surfaces share one
  source and keep their own treatment. Preserves appearance; widens the interface.
- **(b) Converge on the public treatment.** Simpler interface, but it is a deliberate visual change
  to the admin portal and should be called out as such, not slipped in under a refactor.

**(a) is recommended** — the admin chip style is used by `ApplicationDataTable` too, so converging
would change two surfaces to settle a question nobody asked.

---

## 4. Step plan

1. Resolve §3. If (a), add the variant to `PetStatusPresentation` and both dictionaries of tone data.
2. Replace `PetDataTable.tsx:169-181` with `getPetStatusPresentation(pet.status)` + `<PetStatusIcon>`.
   Render `t(labelKey, labelFallback)`, not the raw union member.
3. Replace the `PetDataTable.tsx:297-306` filter options and counts with `matchesStatusFilter()`,
   and add the rehab option. Derive the options from the tone list rather than hand-listing them, so
   a new status cannot be omitted again.
4. Apply the same treatment to `ApplicationDataTable.tsx:131-146`. Application status is a different
   union (`SUBMITTED | UNDER_REVIEW | APPROVED | REJECTED`, see `src/lib/domain/stateMachine.ts`) and
   needs its own presentation module — do **not** force it through the pet one.

Steps 1–3 are the bug. Step 4 is the duplication and can land separately.

---

## 5. Acceptance criteria

- A pet with `'In Rehabilitation'` **and** one with the legacy `'Rehabilitation'` alias both render
  the indigo rehab badge with the stethoscope glyph in the admin table, in light and dark mode.
- The status filter offers a rehab option and returns both alias spellings.
- The per-status counts sum to the unarchived total — assert this, since it is the symptom a staff
  member would actually notice.
- No raw `status === "…"` comparison remains in `src/components/admin/`.
- `npx tsc --noEmit` clean, `npm test` green, `npm run lint` no new warnings.

Extend `tests/unit/petStatusPresentation.test.ts` for tone/variant coverage. The admin tables
themselves are React rendering, which `tests/unit/` does not cover (node environment, no jsdom) —
that belongs to
[Test Task 02](TEST_TASK_02_COMPONENT_AND_UI_SUITE.md).

---

## 6. Out of scope

- Translating admin-portal copy. The admin surface is English-only throughout; routing its status
  labels through i18n is a separate decision from fixing which label appears.
- `BulletinFeed.tsx:27` — `CATEGORY_LABELS` is already a proper `Record` and is not affected.
- P6 (barrels). Unrelated, tracked separately.
