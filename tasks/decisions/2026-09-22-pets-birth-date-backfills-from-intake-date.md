# A legacy pet's birthday is reckoned from its intake date, and the old columns are kept

**Decided:** 2026-09-22

`prisma/migrations/manual/20260922_pets_birth_date/` closes the `pets.age` half of
`tasks/open/production-schema-has-drifted-ahead-of-master.md`. Four choices in it are reversible
and are written down here rather than only in the file's header.

## 1. `birthDate := intakeDate - age`, not `today - age`

Production's `age` is prose an intake volunteer typed when the animal arrived — `"2 years"`,
`"4 months"`, `"2 tahun"`. The birthday it implies is reckoned from `intakeDate`, because that is
when the sentence was true. Reckoning from today would understate every animal's age by however
long it has been in the shelter, which is the same rot PS-114 removed from the fixtures.

This is not a new rule. `approximateBirthDate` in `src/lib/domain/petAge.ts` already does exactly
this for a legacy row, and the `birthDate` values in `src/data/pets.json` are that rule applied by
hand. The rehearsal uses that fixture as its expectation and gets 10/10 — an independent check,
since the fixture was written long before this SQL and the SQL was not derived from it.

**The confusing part, worth stating plainly:** `tasks/open/pet-form-has-no-birth-date-field.md`
calls intake-relative ageing *wrong*, and PR #42 exists to stop it. Both are right, because they
are about different moments. For a legacy row the age string was recorded **at** intake, so intake
is the correct anchor. For a form an operator is filling in **today**, anchoring to a past intake
date is the defect that entry describes. A future reader who sees this file and that entry and
thinks one of them is stale should read this paragraph before changing either.

`birthDateIsEstimate` is `true` for every backfilled row, with no exception: a date derived from
prose is an estimate, whatever the prose claimed.

## 2. Expand now, contract later — `age` and `ageCategory` are not dropped

`prisma db push` would emit one statement that adds `birthDate` *and* drops `age`/`ageCategory`.
The add is reversible; the drop destroys the only record of what staff typed and cannot be undone.
They are separated:

- **Now (this file).** Add both columns, backfill, relax the two old NOT NULLs. Nothing is lost,
  and `rollback.sql` restores the previous shape exactly because `age` was never written to.
- **Later, its own file.** Drop `age` and `ageCategory`, once this has been applied and the
  catalogue is confirmed serving real rows. Deliberately not written yet: it buys nothing while
  the release ignores both columns, and writing it now invites applying it in the same sitting.

So `npm run db:check-drift` will still report one destructive statement for `pets` after this is
applied. That is correct and expected, not a failed migration.

## 3. Relaxing the two NOT NULLs is part of the fix, not tidying

`age` and `ageCategory` were declared `String` — NOT NULL, no default — in the schema production
was built from (`6108d82^`), and `PetPersistencePayload` (`src/lib/server/petMappers.ts:117-149`)
has no such fields. Adding `birthDate` alone therefore fixes every pet *read* and leaves every pet
*creation* failing. Checked, not assumed: with the columns added and `age` still NOT NULL, the
same generated client refuses the same `create`, and Prisma reports

    Null constraint violation on the (not available)

naming no column — a failure nobody could diagnose from a production log. Whether production's
copies are still NOT NULL is **not measured**: a `migrate diff` DROP clause does not report
nullability. The file relaxes them whichever way it finds them, and the statement is a no-op if
they are already nullable.

## 4. Month-end subtraction clamps, and every clamped row is named

PostgreSQL clamps `2026-03-31 - interval '1 month'` to `2026-02-28`. The app's JS rolls the same
arithmetic forward to `2026-03-03`, because `Date.UTC(2026, 1, 31)` overflows into March. The two
rules disagree only when the day of the month cannot survive the subtraction, so the migration
names exactly those rows in a `NOTICE`.

Clamping is kept: a date inside the intended month beats one in the next. The divergence is made
visible rather than silently resolved, because it is the one place where the backfilled value is
not what the app would have computed.

## What was rehearsed

Fifty-one checks, all passing, on a throwaway embedded PostgreSQL 18.4 started by
`prisma/migrations/manual/20260922_pets_birth_date/rehearse.mjs` with its connection string inline
— never against production, and resolving nothing from `.env.local` or `prisma.config.ts`. **The
script is kept beside the migration**, which the `20260917_status_enums` rehearsal did not do: its
twenty-nine checks can be re-read but never re-run, and a reviewer who doubts a claim should be
able to re-take the measurement.

- **A1–A12** the happy path: before, `SELECT birthDate` fails 42703 and an insert without `age`
  fails 23502; after, both columns are NOT NULL with master's defaults, both old columns are
  nullable with every value present, all ten fixtures backfill to the `birthDate` `pets.json`
  carries, `birthDateIsEstimate` is true throughout, and an insert without `age` succeeds.
- **B1–B3** re-running changes nothing, **including a `birthDate` corrected by hand in between** —
  the file must never overwrite a date a human typed into the admin form.
- **C1–C8** every refusal leaves the table untouched, with the offending rows named: unparseable
  age, empty age, NULL age, a non-date `intakeDate`, `2024-02-31`, month 13, `"500 years"`, and a
  fourteen-digit age.
- **D1** neither `birthDate` nor `age` present: refuses rather than giving every animal the same
  invented birthday.
- **E1** English and Malay units, `"1 year 6 months"` taking the year, `"2y"`, and an age embedded
  in a sentence all derive what `approximateBirthDate` derives.
- **F1–F4** the two clamping cases land on the month end and are named; the row that did not clamp
  is not named.
- **G1–G5** `rollback.sql` restores the previous shape with every `age` kept, the migration applies
  again afterwards, and a post-migration row with a NULL `age` leaves the column nullable with a
  notice instead of aborting.
- **H1–H5** under a foreign `search_path` the columns still land on `public.pets` and nothing is
  created elsewhere; under a held ACCESS EXCLUSIVE lock it gives up at 5 s having committed
  nothing, and finishes on a re-run.
- **K1–K2** a table carrying only one of `birthDate` / `birthDateIsEstimate` is refused rather
  than reported as already migrated -- the client selects both, so half the pair is still broken,
  and which of exact-or-estimate the stored dates are is not knowable from here.
- **I1** the TEMP scratch table exists nowhere afterwards.
- **J1–J2** the pre-check query printed in the header — the thing the owner actually runs first —
  returns the right verdict for each row and changes nothing.
- **P1–P7** master's own generated Prisma client against a production-shaped `pets`: before,
  `findMany` and `create` both fail on `pets.birthDate`; after, both succeed, the archive update
  succeeds, and the backfilled date is right. **P7** puts the NOT NULL back to prove choice 3 is
  load-bearing rather than dead weight.

Two things the rehearsal found that were wrong in the first draft, both now fixed and both worth
knowing: `to_date` does not roll an impossible date forward, it raises — see
`tasks/lessons/2026-09-22-to-date-raises-on-an-impossible-date-it-does-not-roll-it-forward.md`;
and a failing multi-statement file leaves the editor session in an aborted transaction, which the
header now tells the reader to expect.

## Not rehearsed, and not knowable from here

Production's actual `age` values, and any view, constraint or trigger there that references `age`
or `ageCategory`. Either would abort the transaction rather than damage anything — which is why
the header's "before" query exists and is the one step not to skip. **The owner applies this in
the Neon SQL editor.** Nothing in this session has touched production.
