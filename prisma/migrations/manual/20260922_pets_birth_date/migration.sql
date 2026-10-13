-- pets.birthDate: add the two columns prisma/schema.prisma declares, backfill them from the
-- prose `age` production still carries, and relax `age`/`ageCategory` so the running release
-- can insert. Nothing is dropped and no existing value is overwritten.
--
-- Why: production's `pets` still has `age` and `ageCategory` and has neither `birthDate` nor
-- `birthDateIsEstimate`. Measured 2026-09-18 by `npm run db:check-drift` from the main
-- checkout, after the owner applied 20260917_status_enums; recorded in
-- tasks/open/production-schema-has-drifted-ahead-of-master.md. Master swapped the columns on
-- 2026-08-28 (6108d82) and the deployed client has selected `birthDate` ever since:
-- src/lib/server/petRepository.ts:65 runs prisma.pet.findMany({ include: PET_INCLUDE }) with
-- no `select`, so Prisma asks Postgres for pets."birthDate" on every catalogue read.
--
-- That the read fails is not reasoning. Master's own generated client, run against a
-- throwaway PostgreSQL carrying the `pets` shape production is measured to have, answers:
--
--   prisma.pet.findMany()  ->  The column `pets.birthDate` does not exist in the current database.
--   prisma.pet.create(...) ->  The column `birthDate of relation pets` does not exist ...
--
-- What happens next in production is the part nobody has watched: handlePersistenceError(...,
-- "read") swallows that failure -- src/lib/persistenceMode.ts:67-81 rethrows only P2002 or
-- under STRICT_PERSISTENCE, and its warn is gated on NODE_ENV === "development", so production
-- logs nothing -- and the reader returns `serverPets`, which petRepository.ts:38-44 initialises
-- from src/data/pets.json. If the deployed build is this schema's, the public catalogue has
-- been answering from the ten bundled demo animals since 2026-08-28, silently.
--
-- The cheap probe nobody has run, worth one minute before applying this: open /pets on the live
-- site. Exactly the ten fixture animals, at fixture ids (pet-001 ... pet-010), means the
-- fallback and confirms the whole chain. Anything else means the read works, and the drift
-- measurement above wants re-reading before this file is applied to anything.
--
-- Writes are the other half, and this is the part a "rename age to birthDate" framing misses.
-- `age` and `ageCategory` were declared `String` -- NOT NULL, no default -- in the schema
-- production was built from (6108d82^), and the running release inserts a pet without either
-- column: PetPersistencePayload (src/lib/server/petMappers.ts:117-149) has no such fields.
-- Adding `birthDate` alone therefore fixes every read and leaves pet creation failing. That was
-- checked rather than assumed: with the columns added but `age` still NOT NULL, the same client
-- refuses the same create, and Prisma reports it as
--
--   Null constraint violation on the (not available)
--
-- naming no column -- so this is also a failure nobody could diagnose from a production log.
-- A `migrate diff` DROP clause does not report nullability, so whether production's copies are
-- still NOT NULL is not measured; the file relaxes both columns whichever way it finds them,
-- and the statement is a no-op if they are already nullable. Their values are kept regardless.
--
-- Why not `prisma db push`: push emits
--   ALTER TABLE "pets" DROP COLUMN "age", DROP COLUMN "ageCategory",
--     ADD COLUMN "birthDate" TEXT NOT NULL DEFAULT '2024-01-01', ...
-- which does not migrate anything. Every animal's recorded age is discarded and every row is
-- given the same invented birthday, which the site then renders as a real age. This file reads
-- `age` before adding the column and writes a date derived from it.
--
-- THE BACKFILL RULE
--
--   birthDate := intakeDate - age            birthDateIsEstimate := true
--
-- `age` is prose an intake volunteer typed when the animal arrived ("2 years", "4 months",
-- "2 tahun"), so the birthday it implies is reckoned from `intakeDate`, not from today.
-- Reckoning from today would understate every animal's age by however long it has been in the
-- shelter. This is the rule src/lib/domain/petAge.ts `approximateBirthDate` already implements
-- for legacy rows, and the rule that produced the `birthDate` values in src/data/pets.json --
-- in all ten of those fixtures birthDate is exactly intakeDate minus age. `birthDateIsEstimate`
-- is true for every backfilled row without exception: a date derived from prose is an estimate,
-- whatever the prose claimed.
--
-- Two units are recognised, and only in the spellings the app itself reads:
--   years   [0-9]+ followed by year | years | yr | yrs | y
--   months  [0-9]+ followed by month | months | mth | mths | mo | mos | m
-- Each must end at a word boundary, so "3 minggu" (Malay for three weeks) is refused rather
-- than read as three months on its leading `m`. Years are tried first, so "1 year 6 months"
-- backfills as 1 year -- which is what the app does with the same string.
--
-- THE INVARIANT THIS FILE KEEPS
--
--   For every row it writes, the stored birthDate is what
--   src/lib/domain/petAge.ts `approximateBirthDate(age, intakeDate)` computes on a UTC server.
--
-- The two halves of that are held with different strength, and the difference is worth knowing.
--
-- *Which number and unit* is enforced, row by row. The app's patterns are unanchored --
-- /(\d+)\s*y/ takes the first number followed by any word beginning with y -- and this file's
-- are whole-word tokens, so the two can pick different numbers out of one string:
--
--   "2 young pups, 6 months"   the app reads 2 years; these tokens read 6 months
--   "6 months, 2 yo"           the app reads 2 years; these tokens read 6 months
--   "3 males, 2 mo"            the app reads 3 months; these tokens read 2 months
--
-- So the file reads every `age` a second time with the app's own two patterns and refuses any
-- row where the answers differ, naming both readings. Nothing is stored for a row the two
-- disagree about.
--
-- *The date arithmetic* is measured, not enforced: the rehearsal's O2 compares the stored date
-- against the app rule for a fixed corpus of shapes, both rollover cases included. It is the
-- app's arithmetic as a UTC process runs it. Master's function subtracts with setFullYear and
-- setMonth in the server's local time, and west of UTC that lands elsewhere -- under
-- America/Los_Angeles, 2026-03-01 minus one month is 2026-01-29, not 2026-02-01. The deployment
-- is Vercel, whose functions run in UTC, and PR #42 rewrites the function onto Date.UTC, which
-- removes the dependence altogether.
--
-- That is the property anything re-deriving these rows later depends on -- a report, a test,
-- the next migration. Two more consequences follow, and both are deliberate.
--
-- **Malay age words are refused, not translated.** `approximateBirthDate` matches only
-- /(\d+)\s*y/ and /(\d+)\s*m/, so "2 tahun", "3 thn", "4 bulan" and "6 bln" match nothing
-- there and it returns the intake date itself -- "born the day we took it in". Reading them as
-- years and months would be *more correct* and was this file's first behaviour, but it would
-- store a value the app does not compute, and anything that re-derives these rows later would
-- then disagree with what is stored. So they are refused here and named in the pre-check instead, for a human to
-- rewrite in the same sitting. The refusal covers a number beside a Malay age word wherever it
-- sits, including beside an English unit: "2 tahun 6 months" reads as 6 months to master's app
-- and as 2 years to PR #42's, so there is no date for it that both would compute. If your rows
-- carry Malay ages, this is the normalisation to run first -- read it, then run it yourself;
-- this file will not do it for you. It rewrites the ordinary spellings only. The refusal is
-- wider than these two statements on purpose, so a row they leave alone -- a longer word such as
-- "2 tahunan", or a non-breaking space between the number and the word -- is still refused
-- afterwards and has to be retyped by hand:
--
--   UPDATE "public"."pets" SET "age" = regexp_replace("age", '(tahun|thn)\M', 'years', 'gi')
--    WHERE "age" ~* '[0-9]+[[:space:]]*(tahun|thn)\M';
--   UPDATE "public"."pets" SET "age" = regexp_replace("age", '(bulan|bln)\M', 'months', 'gi')
--    WHERE "age" ~* '[0-9]+[[:space:]]*(bulan|bln)\M';
--
-- **The date rolls forward rather than clamping.** See the note beside the UPDATE below.
--
-- Either half of the invariant can be moved from the app's side, and both are PR #42's
-- (feat/pet-form-birth-date) to move. Read at its tip 3c2a691 on 2026-10-13: it widens
-- approximateBirthDate to read tahun/thn/bulan/bln, and it keeps the roll-forward, with a
-- comment there naming this file as the reason. So the clamp this header used to warn about is
-- not coming from that branch as it stands, and once the widening is on master this file may
-- widen with it -- until then it refuses strictly more than the app reads, which is the safe
-- side. The app moves first either way. One limit on the check: O2 compares against a
-- transcription of the function, pinned by O1 to the English ages in src/data/pets.json, so it
-- catches a change of arithmetic and does not catch a change of vocabulary. The Malay refusal
-- above is what covers vocabulary.
--
-- Scope: `pets` only, and only the two added columns plus the two relaxed constraints. The
-- drop of `age`/`ageCategory` is deliberately NOT here. It destroys the only record of what
-- staff typed and cannot be rolled back, and it buys nothing while the release ignores both
-- columns. It is the contract half of an expand/contract pair and belongs in its own file once
-- this one has been applied and the catalogue is confirmed serving real rows. Until then
-- `db:check-drift` will still report one destructive statement for `pets`, and that is correct.
-- The `shelter_settings` columns are not here either.
--
-- Safety:
--   * One transaction. Any failure leaves `pets` exactly as it was -- no column added, no
--     constraint relaxed, no value written.
--   * Nothing is coerced. A row whose `age` the two units cannot parse, or whose `intakeDate`
--     is not a real calendar date and nothing more, aborts the file naming that row's id and
--     both values. A time is refused too, unless it is exactly UTC midnight: the app parses the
--     whole string and an offset can put it on a different day. The
--     column's '2024-01-01' default is never allowed to stand as an answer.
--   * Implausible ages abort too: over 60 years or 720 months is a typo or junk, not an animal.
--   * A fractional or ranged age aborts, rather than being rounded or narrowed. These are the
--     inputs that parse cleanly and mean something else: the rule takes the digit run beside
--     the unit, so "1.5 years" reads as 5 and "3-4 years" reads as 4, and nothing downstream
--     could tell. Choosing a number for either is a claim about an animal nobody here has met.
--     Any second number within five non-digit characters before the unit -- "1.5", "3-4",
--     "1 - 2", "6 to 8", "between 2 and 3" -- is refused and named. A number *after* the unit
--     is not a range, so "2 years, 12.5 kg" backfills normally. Nor is a year quantity
--     followed by a month quantity: "1 yr 6 mo" and "2 y 3 m" are two quantities, and they
--     backfill as the year exactly as "1 year 6 months" does.
--   * More than one quantity aborts, with that one exception. An age holding two
--     number-and-unit quantities is read as a single age only when it is years then months
--     with nothing between them but spaces, commas or full stops. Everything else is refused
--     however it is spelled and however far apart the numbers sit: "2 years - 3 years",
--     "6 months - 1 year", "1 yr - 18 mo", "6 months 1 year", "1 year and 6 months". This is
--     counted, not looked for within a distance, because the five-character guard above let
--     the long spellings through -- "6 months - 1 year" was stored as one year, its upper
--     bound. "1 year and 6 months" is refused on purpose: "and" also joins the two ends of
--     "between 1 year and 18 months", and this file will not guess which was meant.
--   * An age the app would read as a different number aborts, naming both readings. See "THE
--     INVARIANT THIS FILE KEEPS".
--   * Safe to re-run. A `pets` that already has **both** new columns is left completely alone --
--     this file will not overwrite a date a human has since corrected through the admin form.
--     The two DROP NOT NULLs are no-ops the second time. A table carrying only one of the pair
--     is refused rather than treated as done: the client selects both, so one without the other
--     is still broken, and which of exact-or-estimate the stored dates are is not knowable here.
--   * Refuses rather than invents: if `birthDate` is absent AND `age` is absent, there is
--     nothing to derive from and the file aborts instead of defaulting every row.
--   * The advisory lock serialises this against the other manual migrations only when the file
--     is run as one transaction. Run statement by statement, `pg_advisory_xact_lock` is its own
--     transaction and releases at once -- the same caveat 20260917_status_enums carries. The
--     per-block `lock_timeout` and the all-or-nothing DO block do not depend on it.
--   * ADD COLUMN with a constant default does not rewrite the table on PostgreSQL 11+. The
--     UPDATE and the two DROP NOT NULLs do take an ACCESS EXCLUSIVE lock; this table holds tens
--     of rows, so expect milliseconds. If the lock is not granted within 5 seconds it gives up
--     rather than stalling the live site's reads behind it. Re-run later.
--   * `lock_timeout` is set inside the DO block, not with SET LOCAL at the top, so it holds
--     even if an editor runs each statement in its own transaction.
--   * Every table is named with its schema, so the result does not depend on search_path.
--   * The Prisma-level checks drive findMany({ include: PET_INCLUDE }) -- the query
--     petRepository.ts:65 actually sends, relations and all -- not a simpler bare findMany.
--   * The arithmetic half of the invariant is checked, not asserted, and on a corpus, not on
--     your rows: the O2 strings in rehearse.mjs are each stored and compared against
--     approximateBirthDate's own output, both rollover cases included, and the transcribed
--     rule is itself pinned against src/data/pets.json so a drifted copy fails first.
--   * The scratch table is TEMP and ON COMMIT DROP. It never exists in `public`.
--   * If a statement does fail, an editor that sends this whole file as one query skips the
--     rest of it, so the COMMIT on the last line never runs and the session is left holding an
--     aborted transaction. Nothing is committed either way -- but the next statement you type
--     will be refused with `current transaction is aborted` until you run ROLLBACK or open a
--     new query. That is the expected shape of a refusal here, not a second problem.
--
-- Apply: run the "before" query, read what it says about your own rows, then paste this whole
-- file into the Neon SQL editor for the production branch, then run the "after" checks.
--
-- Before -- this is the pre-check, and it is the one step not to skip. It names every row this
-- file would refuse, without changing anything:
--
--   SELECT * FROM (
--        SELECT "id", "name", "age", "intakeDate",
--          CASE
--            WHEN lower(coalesce("age",''))
--                 ~ '[0-9]+[[:space:]\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*(tahun|thn|bulan|bln)'
--                 THEN 'malay age word'
--            WHEN coalesce("intakeDate",'')
--                 !~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])(T00:00:00(\.0+)?Z)?$'
--                 THEN 'bad intakeDate'
--            WHEN substr(left("intakeDate",10),9,2)::int
--                 > extract(day FROM (make_date(substr(left("intakeDate",10),1,4)::int,
--                                               substr(left("intakeDate",10),6,2)::int, 1)
--                                     + interval '1 month' - interval '1 day')) THEN 'bad intakeDate'
--            WHEN lower(coalesce("age",''))
--                 ~ ('[0-9](?![[:space:]]*(years|year|yrs|yr|y|months|month|mths|mth|mos|mo|m)\M)'
--                    || '[^0-9]{1,5}[0-9]+[[:space:]]*(years|year|yrs|yr|y|months|month|mths|mth|mos|mo|m)\M')
--                 OR (SELECT count(*) FROM regexp_matches(lower(coalesce("age",'')),
--                       '[0-9]+[[:space:]]*(years|year|yrs|yr|y|months|month|mths|mth|mos|mo|m)\M', 'g'))
--                    > CASE WHEN lower(coalesce("age",''))
--                                ~ '[0-9]+[[:space:]]*(years|year|yrs|yr|y)\M[[:space:],.]*[0-9]+[[:space:]]*(months|month|mths|mth|mos|mo|m)\M'
--                           THEN 2 ELSE 1 END
--                 THEN 'fractional age'
--            -- What this file's whole-word tokens pick, against what the app's unanchored
--            -- patterns pick. The long bracket is JavaScript's \s, spelled out.
--            WHEN coalesce(
--                   'y' || (regexp_match(lower("age"), '([0-9]+)[[:space:]]*(?:years|year|yrs|yr|y)\M'))[1],
--                   'm' || (regexp_match(lower("age"), '([0-9]+)[[:space:]]*(?:months|month|mths|mth|mos|mo|m)\M'))[1])
--                 <> coalesce(
--                   'y' || (regexp_match(lower("age"), '([0-9]+)[[:space:]\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*y'))[1],
--                   'm' || (regexp_match(lower("age"), '([0-9]+)[[:space:]\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*m'))[1],
--                   '')
--                 THEN 'app reads another number'
--            -- Years first and each bound tested only for the unit it belongs to, because that is
--            -- what the file does. Testing both bounds independently made "2 years 800 months"
--            -- read implausible here and backfill as 2 years there.
--            WHEN lower(coalesce("age",'')) ~ '[0-9]+[[:space:]]*(years|year|yrs|yr|y)\M'
--                 THEN CASE WHEN (regexp_match(lower("age"),
--                       '([0-9]+)[[:space:]]*(?:years|year|yrs|yr|y)\M'))[1]::numeric > 60
--                      THEN 'implausible age' ELSE 'ok: years' END
--            WHEN lower(coalesce("age",'')) ~ '[0-9]+[[:space:]]*(months|month|mths|mth|mos|mo|m)\M'
--                 THEN CASE WHEN (regexp_match(lower("age"),
--                       '([0-9]+)[[:space:]]*(?:months|month|mths|mth|mos|mo|m)\M'))[1]::numeric > 720
--                      THEN 'implausible age' ELSE 'ok: months' END
--            ELSE 'unparseable age'
--          END AS verdict
--     FROM "public"."pets"
--        ) v
--    ORDER BY (verdict LIKE 'ok:%'), verdict, "id";
--
-- Every row should read `ok: years` or `ok: months`. The other six verdicts are the six things
-- this file refuses, and each is a row to correct by hand first, or it will abort naming that row:
--
--   malay age word            a number beside tahun, thn, bulan or bln; run the normalisation
--                             UPDATEs above, or rewrite as "2 years", "4 months"
--   bad intakeDate            not a real calendar date, or a date with a time or anything
--                             else after it; store the bare date, "2026-03-01"
--   fractional age            a decimal, a range, or more than one quantity: "1.5 years"
--                             reads as 5, "3-4 years" as 4, "6 months - 1 year" as 1. Two
--                             quantities are one age only as years then months, "1 yr 6 mo".
--                             Pick one whole number and one unit -- "18 months", "3 years"
--   app reads another number  the app would take a different number from the same words, as in
--                             "2 young pups, 6 months"; rewrite with one number and one unit
--   implausible age           over 60 years or 720 months; a typo, not an animal
--   unparseable age           no number-and-unit the rule recognises; rewrite as "2 years",
--                             "4 months"
--
-- **Read the `age` column itself, not only the verdict.** The rule reads a number and a unit; it
-- cannot read a qualifier around them. "less than 1 year" is taken as exactly 1 year, "about 3
-- years" as exactly 3, and "1 year 6 months" as exactly 1 -- the months are not added. Each is
-- an estimate stored as an estimate, so none is refused -- but if a row's prose hedges in a
-- direction that matters to someone who knows the animal, this listing is the last chance to say
-- so in whole units.
--
-- Keep the output. After the follow-up file drops `age`, it is the only record of what it held.
--
-- After: the same animals, with dates instead of prose.
--
--   SELECT "id", "name", "age", "intakeDate", "birthDate", "birthDateIsEstimate"
--     FROM "public"."pets" ORDER BY "id";
--
--   SELECT column_name, data_type, is_nullable, column_default
--     FROM information_schema.columns
--    WHERE table_schema = 'public' AND table_name = 'pets'
--      AND column_name IN ('age','ageCategory','birthDate','birthDateIsEstimate')
--    ORDER BY column_name;
--
-- **Everything this file tells you, it tells you through RAISE NOTICE** -- the row count it
-- backfilled, the rows whose date rolled into the following month, and the "already migrated,
-- nothing rewritten" line. A psql session prints those; the Neon SQL editor is not documented
-- to, so assume you will not see them and read the answers out of the table instead. The count
-- is the first query above. The rolled rows are stored exactly as the app's own arithmetic
-- produces them; they are worth reading because the month stored is not the month the
-- subtraction names. They are these:
--
--   SELECT "id", "name", "age", "intakeDate", "birthDate"
--     FROM "public"."pets"
--    WHERE right("birthDate", 2) <> right(left("intakeDate", 10), 2)
--    ORDER BY "id";
--
-- Expect none unless an animal was taken in on the 29th, 30th or 31st. Each row it returns has a
-- birthday a few days into the month after the one intended -- 2026-03-31 minus one month is
-- 2026-03-03 -- which is deliberate: see the note beside the UPDATE below.
--
-- `birthDate` and `birthDateIsEstimate` should be NOT NULL; `age` and `ageCategory` should now
-- read YES under is_nullable, with every value still present. Then load the public catalogue:
-- the animals shown should be the shelter's, not the ten demo animals from src/data/pets.json.
-- Undo: rollback.sql beside this file -- read its header first, it is not free after go-live.
--
-- Rehearsed 2026-09-22 on a throwaway embedded PostgreSQL 18.4, started by the rehearsal script
-- itself with its connection string inline -- never against production, and resolving nothing
-- from .env.local or prisma.config.ts. The table carried production's shape where it matters:
-- `age`/`ageCategory` present and NOT NULL, no `birthDate`, `status` already converted to
-- "PetStatus" as the owner applied on 2026-09-18, `intakeDate` as text, and every other scalar
-- master's Pet model declares, so a Prisma select differs from it in exactly the two columns.
--
-- Every check passing when re-taken on 2026-10-13, seven of them driving master's own generated
-- Prisma client and the rest at the SQL level. How many, and which, is rehearse.mjs beside this
-- file and nowhere else: each check prints its own name and the run ends by printing its count.
-- A prose copy of that list has drifted once already, so none is kept here. The reasoning is in
-- tasks/decisions/2026-10-13-expand-refuses-what-the-app-would-read-differently.md, which
-- amends the two 2026-09-22 entries about this migration; read it first. In summary:
--   * The ten src/data/pets.json animals backfill to the exact `birthDate` that file carries,
--     10/10, which is the independent check on the rule -- that fixture was written by hand and
--     this SQL was not derived from it.
--   * Every English unit spelling, "1 year 6 months" and "1 yr 6 mo" taking the year, and an
--     age embedded in a sentence, all derive what the app's approximateBirthDate derives.
--   * Malay units derive nothing: "2 tahun", "3 thn", "4 bulan", "6 bln" and "2 tahun 6 months"
--     each abort the transaction, naming the row, and leave the table untouched.
--   * An age the app reads as a different number aborts the same way, naming both readings.
--   * Before: prisma.pet.findMany and prisma.pet.create both fail on the missing column.
--     After: both succeed, the archive update succeeds, and the backfilled date is the right one.
--   * Every refusal leaves the table untouched: unparseable age, NULL age, empty age, a
--     non-date intakeDate, 2024-02-31, month 13, "500 years", a fourteen-digit age, the three
--     fractional shapes "1.5 years", "1,5 years" and "1 1/2 years", the vulgar fraction
--     "1<1/2> years", every range spelling tried -- "3-4 years", "1 - 2 years", "3 - 4 years"
--     with an en dash, "6 to 8 months", "between 2 and 3 years", "2 or 3 years" -- a
--     non-breaking space between number and unit, and "3 minggu" / "5 hari" / "3 weeks",
--     units this file does not read.
--   * A decimal elsewhere in the string is not a fractional age: "2 years, 12.5 kg" and
--     "3 years (lahir 12/06/2023)" both backfill normally rather than blocking the table.
--   * rollback.sql does not tighten a column this file found already nullable, and it names the
--     rows a rollback would strand with neither a birthday nor an age.
--   * A comment already on `age` or `ageCategory` is carried inside the marker and put back by
--     rollback.sql, rather than overwritten -- and it survives a column being relaxed twice.
--   * rollback.sql drops `birthDate` only if this file's marker says this file created it. A
--     column somebody else added is left alone and said so, because dropping it would destroy
--     birthdays this pair never wrote.
--   * rollback.sql run twice says there is nothing to drop, and a marked `birthDateIsEstimate`
--     left without its `birthDate` is dropped rather than stranded, so this file applies again.
--   * The rehearsal database is created UTF8, as Neon is, rather than inheriting the host
--     locale: [[:space:]] and \M are encoding-dependent, and a non-breaking space between the
--     number and the unit parses under WIN1252 and is refused under UTF8.
--   * The pre-check in this header returns the right verdict for each of those, and each
--     verdict matches what the file then actually does -- so a clean pre-check is not
--     followed by an abort.
--   * Re-running changes nothing, including a `birthDate` corrected by hand in between.
--   * Under a held lock it gives up at 5 s having committed nothing, and finishes on a re-run.
--   * Under a foreign search_path the columns still land on public.pets.
--   * rollback.sql returns the table to its previous shape with every `age` kept, and this file
--     applies again afterwards.
--
-- Not rehearsed: production's actual `age` values, and any view, constraint or trigger there
-- that references `age` or `ageCategory`. Either would abort the transaction rather than
-- damage anything -- which is why the "before" query above is worth running first.

BEGIN;

-- Bounds the wait on the advisory lock below, which is taken outside the DO block and so is
-- not covered by the lock_timeout that block sets. Another manual migration holding the same
-- key would otherwise make this statement wait under the session default, which is forever.
SET LOCAL lock_timeout = '5s';

SELECT pg_advisory_xact_lock(4210771001);

DO $$
DECLARE
  has_age          boolean;
  has_age_category boolean;
  has_birth_date   boolean;
  has_estimate     boolean;
  offenders        text;
  clamped          text;
  updated          integer;
  total            integer;
  prior            text;
BEGIN
  -- Give up rather than queue: an ALTER waiting behind a long-open transaction holds every
  -- later read of the table behind it, the live site's included.
  PERFORM set_config('lock_timeout', '5s', true);

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'pets'
  ) THEN
    RAISE EXCEPTION 'public.pets does not exist';
  END IF;

  -- Taken here, before the snapshot below reads the table, rather than left to the first ALTER.
  -- The snapshot alone takes only ACCESS SHARE, so a row inserted between it and the ALTER would
  -- be absent from the scratch table, unmatched by the UPDATE, and left holding the '2024-01-01'
  -- default -- while the "did every row get one" guard still passed, because that guard counts
  -- the snapshot. Locking first makes the read and the write see the same table. Subject to the
  -- 5s lock_timeout above, so this still gives up rather than queueing behind a long transaction.
  LOCK TABLE "public"."pets" IN ACCESS EXCLUSIVE MODE;

  SELECT count(*) FILTER (WHERE column_name = 'age')                 > 0,
         count(*) FILTER (WHERE column_name = 'ageCategory')         > 0,
         count(*) FILTER (WHERE column_name = 'birthDate')           > 0,
         count(*) FILTER (WHERE column_name = 'birthDateIsEstimate') > 0
    INTO has_age, has_age_category, has_birth_date, has_estimate
    FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'pets';

  -- "Already migrated" is decided on both columns, not just `birthDate`. The client selects
  -- every scalar, so one of the pair present without the other leaves it failing on the other
  -- one -- and gating the whole backfill on `birthDate` alone would make this file report
  -- "nothing to do" against a table that is still broken. Refuse instead: adding the missing
  -- column here would have to guess whether the dates already stored are exact or estimates.
  IF has_birth_date <> has_estimate THEN
    RAISE EXCEPTION
      'pets has "%" but not "%". This file will not add the missing one: whether the dates already stored are exact or estimates is not something it can know. Add it by hand with the default the schema declares, or drop the stray column and re-run this file.',
      CASE WHEN has_birth_date THEN 'birthDate' ELSE 'birthDateIsEstimate' END,
      CASE WHEN has_birth_date THEN 'birthDateIsEstimate' ELSE 'birthDate' END;
  END IF;

  IF has_birth_date THEN
    -- Both columns are present: already migrated, or a human has since corrected dates through
    -- the admin form. Either way this file has no business rewriting them.
    RAISE NOTICE 'pets already has "birthDate" and "birthDateIsEstimate"; no column added and no value rewritten.';

  ELSIF NOT has_age THEN
    RAISE EXCEPTION
      'pets has neither "birthDate" nor "age": there is nothing to derive a birthday from, and this file will not give every animal the same invented one. Restore "age" from a backup, or decide the dates by hand.';

  ELSE
    -- One pass over the table, so the check below and the write further down cannot disagree
    -- about a row. TEMP and ON COMMIT DROP: it never exists in "public", and it is gone
    -- whether this transaction commits or aborts.
    --
    -- `qty` is numeric, not int, so a junk digit run cannot overflow before it is refused.
    --
    -- `intake` is built with make_date rather than to_date, and only after the day has been
    -- checked against the length of its own month. to_date does not roll 2024-02-31 forward --
    -- it raises `date/time field value out of range`, which would abort this file with a
    -- message naming no row, and the owner could not tell which animal to fix. The regex bounds
    -- the year away from 0 and the month to 01-12, so make_date below cannot raise either: for
    -- a row that fails any part of this, every expression yields NULL and the row is named by
    -- the check that follows.
    CREATE TEMP TABLE _pets_birth_backfill ON COMMIT DROP AS
    SELECT s.*,
           CASE WHEN substr(s.intake_txt, 9, 2)::int
                     <= extract(day FROM (
                          make_date(substr(s.intake_txt, 1, 4)::int, substr(s.intake_txt, 6, 2)::int, 1)
                          + interval '1 month' - interval '1 day'))
                THEN make_date(substr(s.intake_txt, 1, 4)::int,
                               substr(s.intake_txt, 6, 2)::int,
                               substr(s.intake_txt, 9, 2)::int) END AS intake,
           substr(s.intake_txt, 1, 4)::int AS iy,
           substr(s.intake_txt, 6, 2)::int AS im,
           substr(s.intake_txt, 9, 2)::int AS id_
      FROM (
        SELECT p."id",
               p."age",
               p."intakeDate",
               -- The whole string, not its first ten characters. Master's app hands all of it to
               -- `new Date`, so a timestamp with an offset is a different UTC day there
               -- ("2026-03-01T02:00:00+08:00" is 28 February) and trailing prose is no date at all.
               -- A bare date, or one at UTC midnight, is the same day to both.
               CASE WHEN coalesce(p."intakeDate", '')
                         ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])(T00:00:00(\.0+)?Z)?$'
                    THEN left(p."intakeDate", 10) END AS intake_txt,
               -- A decimal or fraction anywhere in the age. The unit patterns below take the
               -- digit run that sits next to the unit token, so "1.5 years" would yield 5, not
               -- 1 -- a birthday three and a half years wrong, with every other check passing.
               --
               -- The lookahead steps over a first number that carries a unit of its own. This guard
               -- is about one quantity written with two numbers -- "1.5 years", "3-4 years" -- and
               -- "1 yr 6 mo" is two quantities, which it used to refuse while accepting the
               -- synonymous "1 year 6 months", whose first unit is merely longer than the
               -- five-character window. Whether two quantities are acceptable is not decided
               -- here: the `quantities` count below decides it, at any distance. Narrowing this
               -- lookahead was tried twice and is redundant with that count -- loosening it again
               -- turned no check red -- so it is kept as simple as it can be.
               lower(coalesce(p."age", ''))
                 ~ ('[0-9](?![[:space:]]*(years|year|yrs|yr|y|months|month|mths|mth|mos|mo|m)\M)'
                    || '[^0-9]{1,5}[0-9]+[[:space:]]*(years|year|yrs|yr|y|months|month|mths|mth|mos|mo|m)\M')
                 AS fractional,
               -- How many number-and-unit quantities the age holds, and whether it holds the one
               -- pair that is read as a single age: years, then months, with nothing between them
               -- but spaces, commas or full stops. The guard above only looks five characters
               -- back, so "6 months - 1 year" walked past it and was stored as one year, the upper
               -- bound. Counting needs no window. Units only, so the kg in "2 years, 12.5 kg" and
               -- the date in "3 years (lahir 12/06/2023)" are not quantities.
               (SELECT count(*) FROM regexp_matches(lower(coalesce(p."age", '')),
                  '[0-9]+[[:space:]]*(years|year|yrs|yr|y|months|month|mths|mth|mos|mo|m)\M', 'g'))
                 AS quantities,
               lower(coalesce(p."age", ''))
                 ~ '[0-9]+[[:space:]]*(years|year|yrs|yr|y)\M[[:space:],.]*[0-9]+[[:space:]]*(months|month|mths|mth|mos|mo|m)\M'
                 AS year_month_pair,
               -- A number beside a Malay age word, anywhere in the string. Unanchored and with
               -- JavaScript's \s, because that is how PR #42's widened approximateBirthDate reads
               -- them: a row this matches is one master's app and that one date differently.
               lower(coalesce(p."age", ''))
                 ~ '[0-9]+[[:space:]\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*(tahun|thn|bulan|bln)'
                 AS malay,
               -- The same string read twice: `sql_pick` with this file's whole-word tokens,
               -- `app_pick` with approximateBirthDate's own unanchored /(\d+)\s*y/ then
               -- /(\d+)\s*m/. The bracket is JavaScript's \s spelled out -- [[:space:]] alone is
               -- narrower, and "3<nbsp>y old, 2 years" is 3 to the app. Compared as unit letter
               -- plus digit run, so a row is refused unless both took the same number.
               coalesce(
                 'y' || (regexp_match(lower(p."age"), '([0-9]+)[[:space:]]*(?:years|year|yrs|yr|y)\M'))[1],
                 'm' || (regexp_match(lower(p."age"), '([0-9]+)[[:space:]]*(?:months|month|mths|mth|mos|mo|m)\M'))[1])
                 AS sql_pick,
               coalesce(
                 'y' || (regexp_match(lower(p."age"), '([0-9]+)[[:space:]\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*y'))[1],
                 'm' || (regexp_match(lower(p."age"), '([0-9]+)[[:space:]\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]*m'))[1])
                 AS app_pick,
               CASE
                 WHEN lower(coalesce(p."age", '')) ~ '[0-9]+[[:space:]]*(years|year|yrs|yr|y)\M'
                   THEN 'years'
                 WHEN lower(coalesce(p."age", '')) ~ '[0-9]+[[:space:]]*(months|month|mths|mth|mos|mo|m)\M'
                   THEN 'months'
               END AS unit,
               CASE
                 WHEN lower(coalesce(p."age", '')) ~ '[0-9]+[[:space:]]*(years|year|yrs|yr|y)\M'
                   THEN (regexp_match(lower(p."age"),
                          '([0-9]+)[[:space:]]*(?:years|year|yrs|yr|y)\M'))[1]::numeric
                 WHEN lower(coalesce(p."age", '')) ~ '[0-9]+[[:space:]]*(months|month|mths|mth|mos|mo|m)\M'
                   THEN (regexp_match(lower(p."age"),
                          '([0-9]+)[[:space:]]*(?:months|month|mths|mth|mos|mo|m)\M'))[1]::numeric
               END AS qty
          FROM "public"."pets" p
      ) s;

    SELECT count(*) INTO total FROM _pets_birth_backfill;

    -- First, because a Malay-only age is also underivable and the next check would name it with
    -- advice that does not fit: the remedy here is the normalisation, not a corrected typo.
    SELECT string_agg(
             format('%L (age=%L)', "id", "age"), E'\n    ' ORDER BY "id")
      INTO offenders
      FROM _pets_birth_backfill
     WHERE malay;

    IF offenders IS NOT NULL THEN
      RAISE EXCEPTION E'pets rows whose "age" carries a Malay age word, which this file will not translate:\n    %\nThe app on master reads none of tahun, thn, bulan or bln, so a date derived from one is a date it would not compute. Run the normalisation UPDATEs in this file''s header, and retype by hand as "2 years" or "4 months" any row they leave unchanged, then re-run. Nothing has been changed.',
        offenders;
    END IF;

    SELECT string_agg(
             format('%L (age=%L, intakeDate=%L)', "id", "age", "intakeDate"),
             E'\n    ' ORDER BY "id")
      INTO offenders
      FROM _pets_birth_backfill
     WHERE intake IS NULL OR unit IS NULL;

    IF offenders IS NOT NULL THEN
      RAISE EXCEPTION E'pets rows whose birthday cannot be derived:\n    %\nCorrect "age" or "intakeDate" for each, then re-run. An age needs a whole number and a unit, "2 years" or "4 months"; if a row already looks like that, retype it, because an invisible character such as a non-breaking space between the number and the unit is refused. An intakeDate must be a real calendar date, "2026-03-01": a time of day, an offset or any other trailing text is refused, because the app reads the whole value. The one exception is exactly UTC midnight, "2026-03-01T00:00:00Z", which is the same day either way. Nothing has been changed.',
        offenders;
    END IF;

    -- Checked before the plausibility bound, because a fractional age passes that bound: the
    -- 5 taken from "1.5 years" is a perfectly plausible number of years. This is the one input
    -- shape that parses cleanly and means something else entirely, so it is refused rather than
    -- rounded -- rounding it either way is a decision about an animal's age that belongs to
    -- whoever knows the animal. "18 months" says what "1.5 years" meant, and this file reads it.
    SELECT string_agg(
             format('%L (age=%L)', "id", "age"), E'\n    ' ORDER BY "id")
      INTO offenders
      FROM _pets_birth_backfill
     WHERE fractional OR quantities > CASE WHEN year_month_pair THEN 2 ELSE 1 END;

    IF offenders IS NOT NULL THEN
      RAISE EXCEPTION E'pets rows whose "age" is fractional, a range, or more than one quantity, which this file will not round, narrow or add up:\n    %\nThe rule reads the digits next to the unit, so "1.5 years" would be stored as 5 years before intake and "3-4 years" as 4. Two quantities are read as one age only when written years then months with nothing but spaces, commas or full stops between them, as in "1 yr 6 mo"; "1 year and 6 months" and "6 months - 1 year" are refused. Rewrite each as one whole number and one unit -- "18 months" for "1.5 years" -- then re-run. Nothing has been changed.',
        offenders;
    END IF;

    -- The invariant, enforced. `unit` is not null for any row that reaches here, so `sql_pick`
    -- is not either. `app_pick` should not be: every whole-word token also satisfies the app's
    -- looser pattern -- as long as this server's [[:space:]] holds nothing JavaScript's \s lacks.
    -- That is true of the C ctype this was rehearsed under and is not promised of an ICU one, so
    -- a NULL there is coalesced and refused rather than letting `<>` yield NULL and pass the row.
    SELECT string_agg(
             format('%L (age=%L: this file reads %s, the app reads %s)', "id", "age",
                    substr(sql_pick, 2) || CASE left(sql_pick, 1) WHEN 'y' THEN ' years' ELSE ' months' END,
                    coalesce(substr(app_pick, 2) || CASE left(app_pick, 1) WHEN 'y' THEN ' years' ELSE ' months' END,
                             'no age at all')),
             E'\n    ' ORDER BY "id")
      INTO offenders
      FROM _pets_birth_backfill
     WHERE sql_pick <> coalesce(app_pick, '');

    IF offenders IS NOT NULL THEN
      RAISE EXCEPTION E'pets rows whose "age" the app reads as a different number from the one this file would store:\n    %\nThe app takes the first number followed by any word beginning with y, then m; this file takes whole unit words. Rewrite each so it carries one number and one unit -- "6 months" -- then re-run. Nothing has been changed.',
        offenders;
    END IF;

    SELECT string_agg(
             format('%L (age=%L)', "id", "age"), E'\n    ' ORDER BY "id")
      INTO offenders
      FROM _pets_birth_backfill
     WHERE (unit = 'years' AND qty > 60) OR (unit = 'months' AND qty > 720);

    IF offenders IS NOT NULL THEN
      RAISE EXCEPTION E'pets rows whose "age" is not a plausible animal age:\n    %\nOver 60 years is a typo or junk. Correct each, then re-run. Nothing has been changed.',
        offenders;
    END IF;

    ALTER TABLE "public"."pets" ADD COLUMN "birthDate" TEXT NOT NULL DEFAULT '2024-01-01';
    ALTER TABLE "public"."pets" ADD COLUMN "birthDateIsEstimate" BOOLEAN NOT NULL DEFAULT true;

    -- Marked for the same reason the NOT NULLs are: rollback.sql must undo what this file did and
    -- nothing else. Without a marker, a rollback run against columns somebody else created -- a
    -- stray `db push`, a hand-applied fix -- would drop them and every exact birthday a human has
    -- since typed, none of which this file put there.
    COMMENT ON COLUMN "public"."pets"."birthDate" IS 'added by 20260922_pets_birth_date';
    COMMENT ON COLUMN "public"."pets"."birthDateIsEstimate" IS 'added by 20260922_pets_birth_date';

    -- Roll forward, not clamp. approximateBirthDate keeps the day of month and lets JavaScript
    -- carry the overflow -- setFullYear/setMonth on master, Date.UTC(year - n, month, day) on
    -- PR #42, the same result on a UTC server -- so 2026-03-31 minus one month is 2026-03-03 and
    -- 2024-02-29 minus one year is 2023-03-01: the day of month is kept and the overflow spills
    -- into the next month. make_date(target month, 1) + (day - 1) reproduces exactly that.
    -- Neither date is more correct -- every row here is an estimate and the two rules differ by
    -- a day or three. What decides it is that this one can be CHECKED: a stored date can be
    -- re-derived with the app's own function and compared, which is a check that can fail, and
    -- the rehearsal's O2 does exactly that. A clamped date could only ever be compared against
    -- hand-typed constants. (The contract migration, PR #94, once did this comparison itself and
    -- no longer does; the reason stands without it.)
    UPDATE "public"."pets" p
       SET "birthDate" = to_char(
             CASE WHEN b.unit = 'years'
                  THEN make_date(b.iy - b.qty::int, b.im, 1)
                  ELSE make_date((b.iy * 12 + b.im - 1 - b.qty::int) / 12,
                                 ((b.iy * 12 + b.im - 1 - b.qty::int) % 12) + 1, 1)
             END + (b.id_ - 1),
             'YYYY-MM-DD'),
           "birthDateIsEstimate" = true
      FROM _pets_birth_backfill b
     WHERE p."id" = b."id";

    GET DIAGNOSTICS updated = ROW_COUNT;
    IF updated <> total THEN
      RAISE EXCEPTION 'backfilled % of % pets; refusing to leave the rest on the default',
        updated, total;
    END IF;
    RAISE NOTICE 'backfilled % pets from "age"', updated;

    -- A day of month that cannot survive the subtraction spills into the next month:
    -- 2026-03-31 minus one month is 2026-03-03. That is what the app computes and so what is
    -- stored, but it is the one case where the stored month is not the month a reader expects,
    -- so those rows are named rather than left to be noticed later.
    SELECT string_agg(format('%L: %s - %s = %s', b."id", b.intake_txt, b."age", p."birthDate"),
                      E'
    ' ORDER BY b."id")
      INTO clamped
      FROM _pets_birth_backfill b
      JOIN "public"."pets" p ON p."id" = b."id"
     WHERE substr(p."birthDate", 6, 2)::int
           <> CASE WHEN b.unit = 'years' THEN b.im
                   ELSE ((b.iy * 12 + b.im - 1 - b.qty::int) % 12) + 1 END;

    IF clamped IS NOT NULL THEN
      RAISE NOTICE E'these rolled into the following month, as the app''s own arithmetic does:
    %', clamped;
    END IF;
  END IF;

  -- Independent of the backfill, and idempotent. The running release inserts a pet without
  -- `age` or `ageCategory`; while either is NOT NULL every pet creation fails. Values are kept.
  --
  -- Each column that is actually relaxed is marked with a comment, and only a marked column is
  -- tightened again by rollback.sql. Production's nullability is not measured -- a `migrate diff`
  -- DROP clause does not report it -- so if `age` is already nullable there, the ALTER below is a
  -- no-op. A rollback that then restored NOT NULL unconditionally would leave the column
  -- *stricter* than it found it, in a state production was never in, and every pet creation would
  -- fail 23502 for a reason this migration never caused. The marker is what keeps the pair
  -- symmetric: apply relaxes and marks, rollback tightens and unmarks, and neither touches a
  -- column it did not itself change.
  IF has_age AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pets'
       AND column_name = 'age' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "public"."pets" ALTER COLUMN "age" DROP NOT NULL;
    -- Any comment already on the column is carried inside the marker, not overwritten: this is
    -- the one place an otherwise strictly non-destructive file writes over something, and
    -- rollback.sql puts the original back when it clears the marker.
    -- Unwrap rather than nest: a column relaxed, re-tightened by hand without clearing the
    -- comment, then relaxed again would otherwise carry a marker inside a marker, and rollback
    -- would restore the inner marker as if it were somebody's note.
    SELECT col_description('"public"."pets"'::regclass, a.attnum) INTO prior
      FROM pg_attribute a
     WHERE a.attrelid = '"public"."pets"'::regclass AND a.attname = 'age';
    IF prior LIKE 'NOT NULL removed by 20260922_pets_birth_date%' THEN
      prior := substring(prior FROM ' \| previous comment: (.*)$');
    END IF;
    -- COMMENT ON takes a literal, not an expression, so the text is built first.
    EXECUTE format(
      'COMMENT ON COLUMN "public"."pets".%I IS %L', 'age',
      'NOT NULL removed by 20260922_pets_birth_date; rollback.sql restores it'
      || coalesce(' | previous comment: ' || nullif(prior, ''), ''));
  END IF;

  IF has_age_category AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pets'
       AND column_name = 'ageCategory' AND is_nullable = 'NO'
  ) THEN
    ALTER TABLE "public"."pets" ALTER COLUMN "ageCategory" DROP NOT NULL;
    SELECT col_description('"public"."pets"'::regclass, a.attnum) INTO prior
      FROM pg_attribute a
     WHERE a.attrelid = '"public"."pets"'::regclass AND a.attname = 'ageCategory';
    IF prior LIKE 'NOT NULL removed by 20260922_pets_birth_date%' THEN
      prior := substring(prior FROM ' \| previous comment: (.*)$');
    END IF;
    -- COMMENT ON takes a literal, not an expression, so the text is built first.
    EXECUTE format(
      'COMMENT ON COLUMN "public"."pets".%I IS %L', 'ageCategory',
      'NOT NULL removed by 20260922_pets_birth_date; rollback.sql restores it'
      || coalesce(' | previous comment: ' || nullif(prior, ''), ''));
  END IF;
END $$;

COMMIT;
