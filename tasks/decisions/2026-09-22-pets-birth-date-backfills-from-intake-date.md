# A legacy pet's birthday is reckoned from its intake date, and the old columns are kept

**Decided:** 2026-09-22

`prisma/migrations/manual/20260922_pets_birth_date/` closes the `pets.age` half of
`tasks/open/production-schema-has-drifted-ahead-of-master.md`. Seven choices in it are reversible
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

Clamping is kept: a date inside the intended month beats one in the next, and the divergence is
made visible rather than silently resolved.

**A first draft of this section called clamping "the one place where the backfilled value is not
what the app would have computed". That was wrong, and the review caught it.** There is a second,
and it is one this session introduced: the Malay tokens. The token list was taken from PR #42's
`approximateBirthDate`, and then this work was re-based onto master, whose version matches only
`/(\d+)\s*y/` and `/(\d+)\s*m/`. So master's app today reads neither `tahun`/`thn` nor
`bulan`/`bln`, falls through, and returns the **intake date itself** — "born the day we took it
in". The SQL reads them as years and months.

The wider token set is kept, because reading `"2 tahun"` as two years is right whether or not
PR #42 lands, and storing intake-day-as-birthday is wrong either way. What is withdrawn is the
claim of equivalence: for a Malay-worded age this file and today's app disagree, deliberately, and
this file is the one to trust. Those two — month-end clamping and Malay tokens — are the only
places they differ.

## 5. A fractional age is refused, not rounded

`"1.5 years"` is exactly the prose an intake volunteer types, and it is the one input that parses
cleanly and means something else. The unit patterns take the digit run that sits *next to the unit
token*, not the leading number, so `"1.5 years"` yields **5** — a birthday three and a half years
early. `"2.5 months"` yields 5, `"1,5 tahun"` yields 5, `"1 1/2 years"` yields 2. Nothing
downstream could tell: the plausibility bound passes, the clamping notice does not fire, and after
the follow-up file drops `age` the prose that would have revealed it is gone.

Master's `approximateBirthDate` has the same behaviour, so this is not a divergence from the app —
but a one-shot production backfill is not a render that can be corrected next time the page loads.
Rounding in either direction is a claim about an animal nobody here has met, so the file refuses
and names the row, and the pre-check names it in advance. `"18 months"` says what `"1.5 years"`
meant, and the rule reads it.

Found by `/code-review`, not by the rehearsal, which had no fractional fixture.

## 6. A unit token has to be a whole word

The token list was widened to Malay (choice 4), and the alternation was unanchored, so a
single-letter alternative matched the first letter of any word starting with it. `"3 minggu"` --
Malay for three *weeks* -- matched the `m` of the months pattern and was stored as three
**months**, a birthday about two months early for a puppy, reported by the pre-check as
`ok: months`. English `"3 weeks"` was refused all along, so widening the list is precisely what
opened it: adding `bulan` meant nothing on its own, but `m` beside it meant "any m-word".

Every alternative now ends at a word boundary (`\M`), longest first:

    years   (tahun|thn|years|year|yrs|yr|y)\M
    months  (bulan|bln|months|month|mths|mth|mos|mo|m)\M

So `"3 minggu"`, `"5 hari"` and `"3 weeks"` are all refused and named rather than guessed at,
which is what the file's "anything else is not guessed at" promise was already claiming. The cost
is that `"2 yo"` is now refused too, where the app would read it as two years. Refusing is the
safe direction here: the owner sees the row and rewrites it, and nothing is stored wrong.

Found by the second `/code-review` round, not by the rehearsal, whose age fixtures were all
English or well-formed Malay.

## 7. Rollback restores only what this migration removed

`rollback.sql` used to `SET NOT NULL` on `age`/`ageCategory` whenever the column had no NULLs.
That is not symmetric with apply. Production's nullability is **not measured** -- a `migrate diff`
DROP clause does not report it -- so if `age` is already nullable there, `migration.sql`'s
`DROP NOT NULL` is a no-op while the rollback would still tighten it. The column would come out of
a failed apply/rollback cycle *stricter* than it went in, in a state production was never in, and
every `prisma.pet.create` would fail 23502 for a reason nothing in this pair caused.

`migration.sql` now marks each column it actually relaxes with a `COMMENT`, and `rollback.sql`
restores the constraint only on a marked column and then clears the mark. Apply relaxes and marks;
rollback tightens and unmarks; neither touches a column it did not itself change.

The same round found a second rollback trap, now documented rather than removed because removing
it would mean blocking the emergency exit: any pet created after go-live has `age IS NULL`, so
dropping `birthDate` leaves it with no birthday and nothing to derive one from -- and
`migration.sql` refuses a table it cannot *fully* derive, so one such row blocks re-applying to
the whole table. `rollback.sql` now names those rows before it drops anything, and its header
gives the `UPDATE` that puts an age back. Checks G6-G8 walk that whole cycle: rollback names the
row, the migration then refuses the table over it, and it applies once that row has an age.

## What was rehearsed

Sixty-six checks, all passing, on a throwaway embedded PostgreSQL 18.4 started by
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
- **C1–C11** every refusal leaves the table untouched, with the offending rows named: unparseable
  age, empty age, NULL age, a non-date `intakeDate`, `2024-02-31`, month 13, `"500 years"`, a
  fourteen-digit age, and the three fractional shapes `"1.5 years"`, `"1,5 tahun"`,
  `"1 1/2 years"` — see choice 5.
- **L1–L3** a unit token must be a whole word — `"3 minggu"`, `"5 hari"` and `"3 weeks"` are
  refused, not read as months — a decimal elsewhere in the string is not a fractional age, so
  `"2 years, 12.5 kg"` and `"3 tahun (lahir 12/06/2023)"` backfill normally, and a vulgar
  fraction falls out as unparseable rather than as its leading digit. See choice 6.
- **G6–G10** rollback names the rows it would strand, the migration then refuses the table over
  one of them and applies once it has an age, and a column that was already nullable is not
  tightened — so a pet can still be created after that rollback. See choice 7.
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
- **J1–J3** the pre-check query printed in the header — the thing the owner actually runs first —
  returns the right verdict for each of the four ways the file can refuse and the two it accepts,
  changes nothing, and **each verdict is then checked against what the file actually does**, so a
  clean pre-check cannot be followed by an abort.
- **P1–P7** master's own generated Prisma client against a production-shaped `pets`: before,
  `findMany` and `create` both fail on `pets.birthDate`; after, both succeed, the archive update
  succeeds, and the backfilled date is right. **P7** puts the NOT NULL back to prove choice 3 is
  load-bearing rather than dead weight.

Two things the rehearsal itself found, both fixed: `to_date` does not roll an impossible date
forward, it raises — see
`tasks/lessons/2026-09-22-to-date-raises-on-an-impossible-date-it-does-not-roll-it-forward.md`;
and a failing multi-statement file leaves the editor session in an aborted transaction, which the
header now tells the reader to expect.

**`/code-review` then found six more, every one real**, and a second round on the fixes found six
more again — which is the argument for running it on a file like this rather than trusting a green
rehearsal, and for reviewing the fix round rather than the first draft alone. In severity order: a fractional age read as
the digits beside the unit (choice 5 below); a pre-check that did not list two of the four
refusals, so a clean pre-check could still be followed by an abort; the false equivalence claim in
choice 4; every disclosure being `RAISE NOTICE`, which the Neon editor is not documented to show;
a snapshot taken before any exclusive lock, so a row inserted in the window would keep the
`'2024-01-01'` default while the guard that exists to catch exactly that still passed; and a
rehearsal that reported any Prisma import failure as "no generated client" and exited 0, which
would have silently dropped its seven strongest checks on any machine but this one.

## Not rehearsed, and not knowable from here

Production's actual `age` values, and any view, constraint or trigger there that references `age`
or `ageCategory`. Either would abort the transaction rather than damage anything — which is why
the header's "before" query exists and is the one step not to skip. **The owner applies this in
the Neon SQL editor.** Nothing in this session has touched production.

## The second review round, on the first round's fixes

Six more, all real. The worst was choice 6 above: widening the token list to Malay turned a
one-letter alternative into a prefix match, so `"3 minggu"` became three months. The others: the
rollback asymmetry and the strand-and-block trap (choice 7); the advisory lock at the top of the
file waiting outside the `lock_timeout` the DO block sets, now bounded by a `SET LOCAL` before it;
the fractional guard scanning the whole string, so `"2 years, 12.5 kg"` would have blocked the
entire table with advice that did not fit the row; and `check("J3 …", true, …)` — a summary line
passing a literal `true`, which is the very defect the comment two lines above it says an earlier
revision of J1 had, reintroduced while fixing J1.

That last one is why the suite is now mutation-tested rather than merely green: removing the
fractional guard from `migration.sql` fails C9, C10, C11 and J3, with J3 naming the row it let
through. A check that cannot fail is not a check, and the only way to know which kind you have is
to break the thing it watches.

One claim in that review did not survive checking: it held that `"1½ years"` would be read as 1
year. It is not — the vulgar fraction is not `[0-9]`, so no unit pattern matches and the row is
refused as underivable. L3 pins that, because the reasoning is subtle enough to be worth a test
rather than a paragraph.
