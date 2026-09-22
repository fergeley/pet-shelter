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
-- Two units are recognised, in English and Malay:
--   years   [0-9]+ followed by y | yr | year | thn | tahun
--   months  [0-9]+ followed by m | mo | month | bln | bulan
-- Years are tried first, so "1 year 6 months" backfills as 1 year -- which is what the app does
-- with the same string. Anything else is not guessed at; see "Safety".
--
-- **The Malay tokens are wider than master's app, deliberately.** `approximateBirthDate` on
-- master matches only /(\d+)\s*y/ and /(\d+)\s*m/, so it reads "2 years" and "4 months" but not
-- "2 tahun", "3 thn", "4 bulan" or "6 bln" -- for those it falls through and returns the intake
-- date itself, i.e. "born the day we took it in". PR #42 (feat/pet-form-birth-date) widens the
-- app to exactly the token set above; this file does not wait for it, because reading "2 tahun"
-- as two years is right whether or not that PR lands, and storing intake-day-as-birthday is
-- wrong either way. So for a Malay-worded age this file and today's app disagree, and this file
-- is the one to trust. That is a second place -- alongside month-end clamping below -- where the
-- backfilled value is not what master's arithmetic would produce today. There are no others.
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
--     is not a real calendar date, aborts the file naming that row's id and both values. The
--     column's '2024-01-01' default is never allowed to stand as an answer.
--   * Implausible ages abort too: over 60 years or 720 months is a typo or junk, not an animal.
--   * A fractional age aborts, rather than being rounded. It is the one input that parses
--     cleanly and means something else: the rule takes the digits beside the unit, so
--     "1.5 years" reads as 5 and nothing downstream could tell. Rounding it in either
--     direction is a claim about an animal nobody here has met.
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
--   SELECT "id", "name", "age", "intakeDate",
--          CASE
--            WHEN left(coalesce("intakeDate",''),10)
--                 !~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$' THEN 'bad intakeDate'
--            WHEN substr(left("intakeDate",10),9,2)::int
--                 > extract(day FROM (make_date(substr(left("intakeDate",10),1,4)::int,
--                                               substr(left("intakeDate",10),6,2)::int, 1)
--                                     + interval '1 month' - interval '1 day')) THEN 'bad intakeDate'
--            WHEN lower(coalesce("age",'')) ~ '[0-9][.,/][0-9]' THEN 'fractional age'
--            WHEN lower(coalesce("age",'')) ~ '[0-9]+[[:space:]]*(y|yr|year|thn|tahun)'
--                 AND (regexp_match(lower("age"),
--                       '([0-9]+)[[:space:]]*(?:y|yr|year|thn|tahun)'))[1]::numeric > 60
--                 THEN 'implausible age'
--            WHEN lower(coalesce("age",'')) ~ '[0-9]+[[:space:]]*(m|mo|month|bln|bulan)'
--                 AND (regexp_match(lower("age"),
--                       '([0-9]+)[[:space:]]*(?:m|mo|month|bln|bulan)'))[1]::numeric > 720
--                 THEN 'implausible age'
--            WHEN lower(coalesce("age",'')) ~ '[0-9]+[[:space:]]*(y|yr|year|thn|tahun)'  THEN 'ok: years'
--            WHEN lower(coalesce("age",'')) ~ '[0-9]+[[:space:]]*(m|mo|month|bln|bulan)' THEN 'ok: months'
--            ELSE 'unparseable age'
--          END AS verdict
--     FROM "public"."pets" ORDER BY 5 DESC, 1;
--
-- Every row should read `ok: years` or `ok: months`. The other four verdicts are the four things
-- this file refuses, and each is a row to correct by hand first, or it will abort naming that row:
--
--   bad intakeDate    not a real calendar date; fix the date
--   fractional age    "1.5 years" reads as 5; rewrite in whole units, "18 months"
--   implausible age   over 60 years or 720 months; a typo, not an animal
--   unparseable age   no number-and-unit the rule recognises; rewrite as "2 years", "4 months"
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
-- backfilled, the rows whose date was clamped to a month end, and the "already migrated, nothing
-- rewritten" line. A psql session prints those; the Neon SQL editor is not documented to, so
-- assume you will not see them and read the answers out of the table instead. The count is the
-- first query above. The clamped rows, which are the only ones whose backfilled date is not what
-- the app's own arithmetic would have produced, are these:
--
--   SELECT "id", "name", "age", "intakeDate", "birthDate"
--     FROM "public"."pets"
--    WHERE right("birthDate", 2) <> right(left("intakeDate", 10), 2)
--    ORDER BY "id";
--
-- Expect none unless an animal was taken in on the 29th, 30th or 31st. Each row it returns has a
-- birthday moved back to the end of its month, which is deliberate -- see "THE BACKFILL RULE".
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
-- Fifty-five checks, all passing. Forty-eight at the SQL level and seven driving master's own
-- generated Prisma client. They are listed in
-- tasks/decisions/2026-09-22-pets-birth-date-backfills-from-intake-date.md. In summary:
--   * The ten src/data/pets.json animals backfill to the exact `birthDate` that file carries,
--     10/10, which is the independent check on the rule -- that fixture was written by hand and
--     this SQL was not derived from it.
--   * English and Malay units, "1 year 6 months" taking the year, and an age embedded in a
--     sentence, all derive what the app's approximateBirthDate derives.
--   * Before: prisma.pet.findMany and prisma.pet.create both fail on the missing column.
--     After: both succeed, the archive update succeeds, and the backfilled date is the right one.
--   * Every refusal leaves the table untouched: unparseable age, NULL age, empty age, a
--     non-date intakeDate, 2024-02-31, month 13, "500 years", a fourteen-digit age, and the
--     three fractional shapes "1.5 years", "1,5 tahun" and "1 1/2 years".
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
                               substr(s.intake_txt, 9, 2)::int) END AS intake
      FROM (
        SELECT p."id",
               p."age",
               p."intakeDate",
               CASE WHEN left(coalesce(p."intakeDate", ''), 10)
                         ~ '^[1-9][0-9]{3}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
                    THEN left(p."intakeDate", 10) END AS intake_txt,
               -- A decimal or fraction anywhere in the age. The unit patterns below take the
               -- digit run that sits next to the unit token, so "1.5 years" would yield 5, not
               -- 1 -- a birthday three and a half years wrong, with every other check passing.
               lower(coalesce(p."age", '')) ~ '[0-9][.,/][0-9]' AS fractional,
               CASE
                 WHEN lower(coalesce(p."age", '')) ~ '[0-9]+[[:space:]]*(y|yr|year|thn|tahun)'
                   THEN 'years'
                 WHEN lower(coalesce(p."age", '')) ~ '[0-9]+[[:space:]]*(m|mo|month|bln|bulan)'
                   THEN 'months'
               END AS unit,
               CASE
                 WHEN lower(coalesce(p."age", '')) ~ '[0-9]+[[:space:]]*(y|yr|year|thn|tahun)'
                   THEN (regexp_match(lower(p."age"),
                          '([0-9]+)[[:space:]]*(?:y|yr|year|thn|tahun)'))[1]::numeric
                 WHEN lower(coalesce(p."age", '')) ~ '[0-9]+[[:space:]]*(m|mo|month|bln|bulan)'
                   THEN (regexp_match(lower(p."age"),
                          '([0-9]+)[[:space:]]*(?:m|mo|month|bln|bulan)'))[1]::numeric
               END AS qty
          FROM "public"."pets" p
      ) s;

    SELECT count(*) INTO total FROM _pets_birth_backfill;

    SELECT string_agg(
             format('%L (age=%L, intakeDate=%L)', "id", "age", "intakeDate"),
             E'\n    ' ORDER BY "id")
      INTO offenders
      FROM _pets_birth_backfill
     WHERE intake IS NULL OR unit IS NULL;

    IF offenders IS NOT NULL THEN
      RAISE EXCEPTION E'pets rows whose birthday cannot be derived:\n    %\nCorrect "age" or "intakeDate" for each, then re-run. Nothing has been changed.',
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
     WHERE fractional;

    IF offenders IS NOT NULL THEN
      RAISE EXCEPTION E'pets rows whose "age" is fractional, which this file will not round:\n    %\nThe rule reads the digits next to the unit, so "1.5 years" would be stored as 5 years before intake. Rewrite each in whole units -- "18 months" for "1.5 years" -- then re-run. Nothing has been changed.',
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

    UPDATE "public"."pets" p
       SET "birthDate" = to_char(
             b.intake - make_interval(
               years  => CASE WHEN b.unit = 'years'  THEN b.qty::int ELSE 0 END,
               months => CASE WHEN b.unit = 'months' THEN b.qty::int ELSE 0 END),
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

    -- PostgreSQL clamps 2026-03-31 minus one month to 2026-02-28; the app's JS rolls it forward
    -- to 2026-03-03 instead. The two rules differ only when the day of month cannot survive the
    -- subtraction, and exactly those rows are named here. Clamping is the answer kept: a date
    -- inside the intended month beats one in the next.
    SELECT string_agg(
             format('%L: %s - %s = %s', "id", intake_txt, "age",
                    to_char(intake - make_interval(
                      years  => CASE WHEN unit = 'years'  THEN qty::int ELSE 0 END,
                      months => CASE WHEN unit = 'months' THEN qty::int ELSE 0 END),
                    'YYYY-MM-DD')),
             E'\n    ' ORDER BY "id")
      INTO clamped
      FROM _pets_birth_backfill
     WHERE extract(day FROM (intake - make_interval(
             years  => CASE WHEN unit = 'years'  THEN qty::int ELSE 0 END,
             months => CASE WHEN unit = 'months' THEN qty::int ELSE 0 END)))
           <> extract(day FROM intake);

    IF clamped IS NOT NULL THEN
      RAISE NOTICE E'clamped to the end of the month (the app''s JS would roll these forward instead):\n    %', clamped;
    END IF;
  END IF;

  -- Independent of the backfill, and idempotent. The running release inserts a pet without
  -- `age` or `ageCategory`; while either is NOT NULL every pet creation fails. Values are kept.
  IF has_age THEN
    ALTER TABLE "public"."pets" ALTER COLUMN "age" DROP NOT NULL;
  END IF;
  IF has_age_category THEN
    ALTER TABLE "public"."pets" ALTER COLUMN "ageCategory" DROP NOT NULL;
  END IF;
END $$;

COMMIT;
