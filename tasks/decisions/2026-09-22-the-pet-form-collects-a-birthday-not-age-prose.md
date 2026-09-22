# The pet form collects a birthday, and age prose became derived everywhere

**Decided:** 2026-09-22 · closes `tasks/open/pet-form-has-no-birth-date-field.md`

`PetFormDialog` used to collect `age` as free text ("2 years") and `ageCategory` as a select.
Neither was ever stored: `buildPetPersistencePayload` wrote `intakeDate − age` to `birthDate` and
dropped both, and `mapDbPetToPet` recomputed them from that date on every read. So an operator's
typed "2 years" became a birthday relative to intake, and the displayed age then walked away from
what they typed by one year per year — while the band they picked was never read back at all.

The open entry offered two ways to settle: add a birth date field *and keep the age text as a
display-only estimate*, or have a maintainer confirm intake-relative ageing was intended. This
takes the first, minus the keeping.

## The form collects `birthDate` and `birthDateIsEstimate`, and nothing else about age

- `petBaseFormSchema` drops `age` and `ageCategory`. `birthDate` moves from an unvalidated
  `z.string().optional()` to the required `isoDateSchema` already defined in the same file —
  which was sitting there, used by the history schemas, while the birth date went unchecked.
- `birthDateIsEstimate` stays defaulted to `true`. For a rescue, a known birthday is the
  exception, and a flag that defaults to "we know" would be a lie by default.
- The dialog renders a `type="date"` input capped at the intake date, plus an "Estimated — exact
  date unknown" checkbox, and shows the derived age and band **read-only** beside it, recomputed
  as the operator types.

**Why read-only rather than kept as an editable estimate.** The open entry suggested keeping the
age text for display. A second editable copy of a derived value is the defect, not a mitigation:
it is exactly what went stale before. `src/lib/domain/petAge.ts` is the one place either value is
computed, and the form now shows what the site will show rather than offering to disagree with it.

## The write paths had to change too, or the field would have been inert

Adding the input alone would have done nothing. Three places dropped `birthDate` on the floor and
copied the prose instead:

- `src/actions/pets.ts` — `createPet` built the domain pet with `age: validated.age`, and
  `updatePet`'s `{...existing, ...validated}` left the previous read's prose in place. Both now
  wrap the literal in `withDerivedAge`.
- `src/lib/client/petStore.ts` — `addPet` and `updatePet` did the same for the localStorage
  mirror, so even the offline store lost the birth date on every edit.

The domain `Pet` type keeps `age` and `ageCategory` as required fields. They are still what every
card, table and CSV export reads; they are simply always derived now, never submitted.

## A birth date after the intake date is rejected

New refinement on `petFormSchema`. Worth pinning because the derivation this replaced *could not*
produce such a date — `intakeDate − age` is always on or before intake — so a typed birthday is
the first way one can enter the system, and a future date renders as a plausible "1 month" rather
than as an error.

## Verification

`npm run typecheck` clean; `npm test` 1580 passed / 98 files; `npm run test:integration` 59
passed / 6 files; `npm run lint` 0 errors (`PetFormDialog.tsx` carries the same single
pre-existing `react-hooks/incompatible-library` warning as before, confirmed by linting the
unmodified file in the main checkout); `npm run docs:check` OK.

The type change did the work of finding the callers: `tsc` failed in exactly three test files
whose form fixtures still supplied `age`/`ageCategory`, and nowhere in `src/`.

## What was deliberately not done

- **`Pet.age` was not made bilingual.** `formatAgeString` returns `{ en, ms }` and every caller
  still takes `.en`, so a Malay visitor still reads "2 years".
  `tasks/open/ages-render-in-english-on-malay-site.md` stays open; it is a type-contract change
  across modules and was not a ride-along on this one.
- **`intakeDate` was left as `z.string().min(4)`.** Tightening it to `isoDateSchema` is right but
  is a separate change with its own blast radius through the fixtures.
- **The filter schema's `ageCategory` was left alone.** The gallery's age filter is a band the
  visitor picks, not a value stored on a pet, and `AGE_BANDS` is still its source.

Database half: `tasks/decisions/2026-09-22-pet-birth-date-backfill-derives-from-intake-and-age.md`.
