-- Pet birth date: replace production's `pets.age` / `pets.ageCategory` text columns with the
-- `birthDate` / `birthDateIsEstimate` pair prisma/schema.prisma has declared since 6108d82
-- (2026-08-28), backfilling each row from its own age prose rather than a constant.
--
-- Why now: this is not schema tidiness. The deployed client selects every scalar column of
-- `pets` — captured with no database, over a pg pool that records the statement and throws:
--
--   SELECT "public"."pets"."id", ..., "public"."pets"."birthDate",
--          "public"."pets"."birthDateIsEstimate", ... FROM "public"."pets" ...
--
-- Production has neither column, so `getServerPetsAsync` (src/lib/server/petRepository.ts:64)
-- fails 42703 on every call, `handlePersistenceError(…, "read")` swallows it outside
-- STRICT_PERSISTENCE, and the site serves the `src/data/pets.json` fixture. Writes fail from the
-- other side: production's `age` and `ageCategory` are TEXT NOT NULL with no default, and the
-- deployed client never supplies them. Evidence:
-- tasks/open/production-schema-has-drifted-ahead-of-master.md.
--
-- Why not `prisma db push`: push emits
--   ALTER TABLE "pets" DROP COLUMN "age", DROP COLUMN "ageCategory",
--     ADD COLUMN "birthDate" TEXT NOT NULL DEFAULT '2024-01-01', ADD COLUMN "birthDateIsEstimate" …
-- which gives every animal in the shelter the same invented birthday — a date the UI renders as a
-- real age, indistinguishable from a known one. The '2024-01-01' is not Prisma's invention; it is
-- the `@default` on prisma/schema.prisma:78. This file keeps that default on the COLUMN, so the
-- drift check comes out clean, while no existing ROW ever receives it.
--
-- Backfill rule — a transcription of `approximateBirthDate` in src/lib/domain/petAge.ts:150, the
-- function the application itself uses for exactly this conversion:
--
--   * `age` matching /(\d+)\s*y/  -> intakeDate with that many years subtracted.
--   * else /(\d+)\s*m/            -> intakeDate with that many months subtracted.
--   * else                        -> intakeDate verbatim.
--   * unparseable intakeDate      -> today in UTC (the JS returns `new Date().toISOString()`,
--                                    which is the UTC day, not the session's local one).
--   * isEstimate is true on every one of those paths, so EVERY backfilled row gets
--     "birthDateIsEstimate" = true. No row is ever presented as a known birthday.
--
-- Two cases deliberately do NOT follow the application, and abort instead:
--
--   * An `intakeDate` that matches the shape but is not a real day, such as '2024-02-31'. The
--     application rolls it forward to 2024-03-02 without telling anyone. Rolling an intake date
--     is a data correction, and a migration should not make one silently.
--   * An `age` over 60 years or 720 months. The application would happily compute a birth date in
--     the 1500s. Both refusals name the offending animals so the data can be fixed first.
--
-- The year/month subtraction is built as make_date(y, m, 1) + (day - 1) rather than
-- `- interval '1 year'` on purpose: that reproduces JavaScript's Date overflow, where
-- 2024-02-29 minus one year rolls FORWARD to 2023-03-01. Postgres interval arithmetic would clamp
-- it back to 2023-02-28 and silently disagree with the running application by a day.
--
-- Reversibility: DROP COLUMN cannot be undone, and `birthDate` cannot reconstruct an operator's
-- free-text "2 years" or their hand-picked `ageCategory` band. Both columns are therefore copied
-- to "public"."pets_age_archive_20260922" BEFORE they are dropped, and rollback.sql restores from
-- it. The archive also records what each row derived and whether its age actually parsed, so the
-- conversion can be audited afterwards with plain SQL rather than trusted.
--
-- The archive is a table prisma/schema.prisma does not declare, so until it is dropped
-- `npm run db:check-drift` reports one extra destructive statement, `DROP TABLE
-- "pets_age_archive_20260922"`. That is expected and is the price of a real rollback. Run
-- cleanup.sql beside this file to drop it once the conversion has been live long enough to trust;
-- drift reaches zero at that point and not before.
--
-- Safety:
--   * One transaction. Any failure leaves `age`, `ageCategory` and the table exactly as they were.
--   * Nothing is coerced and nothing is guessed: a row whose `birthDate` did not get a value
--     aborts the file rather than falling back to a constant.
--   * Safe to re-run. Already-migrated columns are detected and the file becomes a no-op; the
--     archive insert is ON CONFLICT DO NOTHING; the backfill only touches NULL "birthDate".
--   * Takes the same advisory lock key as the other manual migrations, so appliers queue.
--   * ALTER TABLE takes an ACCESS EXCLUSIVE lock. `pets` holds tens of rows; expect milliseconds.
--     The 5-second lock_timeout is set with set_config(..., true) inside the block rather than
--     SET LOCAL at the top, so it still holds if an editor runs each statement in its own
--     transaction — the point 20260917_status_enums' review landed on.
--   * Every table is schema-qualified, so the result does not depend on search_path.
--
-- Apply: take the "before" reading, paste this whole file into the Neon SQL editor for the
-- production branch, then take the "after" one.
--
--   SELECT count(*) AS pets, count(*) FILTER (WHERE "age" IS NULL) AS null_age FROM pets;
--   SELECT "id", "name", "age", "ageCategory", "intakeDate" FROM pets ORDER BY "id";
--
-- Before that, run the pre-check. It changes nothing and names every row this file would refuse,
-- so a data problem is found in a read rather than in an aborted write:
--
--   SELECT "id", "name", "age", "intakeDate",
--          CASE WHEN NOT ("intakeDate" ~ '^\d{4}-\d{2}-\d{2}') THEN 'intakeDate unreadable -> today'
--               WHEN substring("intakeDate" FROM 6 FOR 2)::int NOT BETWEEN 1 AND 12 THEN 'REFUSED: month'
--               WHEN substring("intakeDate" FROM 9 FOR 2)::int > EXTRACT(DAY FROM (
--                      make_date(substring("intakeDate" FROM 1 FOR 4)::int,
--                                substring("intakeDate" FROM 6 FOR 2)::int, 1)
--                      + INTERVAL '1 month' - INTERVAL '1 day'))::int THEN 'REFUSED: no such day'
--               WHEN substring(lower(btrim(coalesce("age",''))) FROM '(\d+)\s*y')::numeric > 60
--                    THEN 'REFUSED: age too large'
--               WHEN substring(lower(btrim(coalesce("age",''))) FROM '(\d+)\s*y') IS NOT NULL THEN 'ok: years'
--               WHEN substring(lower(btrim(coalesce("age",''))) FROM '(\d+)\s*m')::numeric > 720
--                    THEN 'REFUSED: age too large'
--               WHEN substring(lower(btrim(coalesce("age",''))) FROM '(\d+)\s*m') IS NOT NULL THEN 'ok: months'
--               ELSE 'age unreadable -> intake date' END AS verdict
--     FROM pets ORDER BY 5, "id";
--
-- Anything beginning REFUSED stops the migration. Fix those rows, then apply.
--
-- After — every row carries a derived date, every row is flagged an estimate, and no row got the
-- column default:
--
--   SELECT count(*) AS pets,
--          count(*) FILTER (WHERE "birthDateIsEstimate") AS estimated,
--          count(*) FILTER (WHERE "birthDate" = '2024-01-01') AS got_the_default
--     FROM pets;
--   SELECT a."id", a."age", a."ageCategory", a."derivedBirthDate", a."ageParsed"
--     FROM pets_age_archive_20260922 a ORDER BY a."ageParsed", a."id";
--
-- `got_the_default` should be 0 unless an animal genuinely entered on 2024-01-01, and any row with
-- "ageParsed" = false is one whose age prose the rule could not read — check those by hand.
--
-- Undo: rollback.sql beside this file. Drop the archive: cleanup.sql.
--
-- Rehearsed 2026-09-22 against PostgreSQL 17 (pglite), on a `pets` table shaped like production's
-- — text `age`/`ageCategory` NOT NULL, no `birthDate` — seeded with the ten fixture animals plus
-- the awkward cases: a leap-day intake, a month-end intake, "2 years 3 months", "18 months",
-- unparseable prose, and an unparseable intake date. Every derived date was compared against
-- src/lib/domain/petAge.ts's own `approximateBirthDate` output for the same input, and the forward
-- migration, the rollback and a second forward run were all checked. Results are in
-- tasks/decisions/2026-09-22-pet-birth-date-backfill-derives-from-intake-and-age.md.
-- Not rehearsed: production's actual rows, and any view or constraint there that references `age`.
-- Either would abort the transaction rather than damage anything.

BEGIN;

SELECT pg_advisory_xact_lock(4210771001);

DO $$
DECLARE
  has_age        boolean;
  has_birth_date boolean;
  archived_count bigint;
  unparsed_count bigint;
  still_null     bigint;
  bad_intakes    text;
  implausible    text;
BEGIN
  -- Give up rather than queue: an ALTER waiting behind a long-open transaction holds every later
  -- read of `pets` behind it, the live catalogue's included.
  PERFORM set_config('lock_timeout', '5s', true);

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'age'
  ) INTO has_age;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'birthDate'
  ) INTO has_birth_date;

  IF NOT has_age AND has_birth_date THEN
    RAISE NOTICE 'pets.age is already gone and pets.birthDate is present: nothing to do.';
    RETURN;
  END IF;

  IF NOT has_age AND NOT has_birth_date THEN
    RAISE EXCEPTION 'pets has neither "age" nor "birthDate"; refusing to guess what happened here';
  END IF;

  -- Refuse an intakeDate that looks like a date and is not one, naming the animals. '2024-02-31'
  -- satisfies the shape regex, and the ::date cast further down would then abort the file with
  -- `date/time field value out of range` and no row number, leaving the operator to find it by
  -- hand. The application would instead roll it forward to 2024-03-02 — `new Date` does that
  -- silently — but rolling an intake date is a data correction, not a migration's decision to
  -- take, so this stops and asks. CASE evaluates its WHEN conditions in order, which is what
  -- keeps make_date from being handed a month of 13.
  SELECT string_agg("id" || ' (' || "intakeDate" || ')', ', ' ORDER BY "id") INTO bad_intakes
    FROM "public"."pets"
   WHERE "intakeDate" ~ '^\d{4}-\d{2}-\d{2}'
     AND NOT (
       CASE
         WHEN substring("intakeDate" FROM 1 FOR 4)::int < 1 THEN false
         WHEN substring("intakeDate" FROM 6 FOR 2)::int NOT BETWEEN 1 AND 12 THEN false
         ELSE substring("intakeDate" FROM 9 FOR 2)::int BETWEEN 1 AND
              EXTRACT(DAY FROM (
                make_date(substring("intakeDate" FROM 1 FOR 4)::int,
                          substring("intakeDate" FROM 6 FOR 2)::int, 1)
                + INTERVAL '1 month' - INTERVAL '1 day'))::int
       END
     );
  IF bad_intakes IS NOT NULL THEN
    RAISE EXCEPTION 'pets rows have an intakeDate that is not a real calendar day: %', bad_intakes;
  END IF;

  -- Refuse an age no animal has. Without this, "500 years" backfills to a birth date in 1526 with
  -- ageParsed = true, so it is not even flagged for the archive review, and a digit string too
  -- long for an integer aborts with `value out of range for type integer` naming no row. Compared
  -- as numeric for exactly that reason. 60 years and 720 months are both far beyond any animal a
  -- shelter rehomes; the point is to catch a typo, not to adjudicate longevity.
  SELECT string_agg("id" || ' (' || coalesce("age", '') || ')', ', ' ORDER BY "id") INTO implausible
    FROM "public"."pets"
   WHERE CASE
     WHEN substring(lower(btrim(coalesce("age", ''))) FROM '(\d+)\s*y') IS NOT NULL
       THEN substring(lower(btrim(coalesce("age", ''))) FROM '(\d+)\s*y')::numeric > 60
     WHEN substring(lower(btrim(coalesce("age", ''))) FROM '(\d+)\s*m') IS NOT NULL
       THEN substring(lower(btrim(coalesce("age", ''))) FROM '(\d+)\s*m')::numeric > 720
     ELSE false
   END;
  IF implausible IS NOT NULL THEN
    RAISE EXCEPTION 'pets rows have an age no animal has: %', implausible;
  END IF;

  -- Holds the two dropped columns verbatim, plus what this migration derived from them and
  -- whether the age prose actually parsed. rollback.sql reads it; cleanup.sql drops it.
  CREATE TABLE IF NOT EXISTS "public"."pets_age_archive_20260922" (
    "id"               text PRIMARY KEY,
    "age"              text,
    "ageCategory"      text,
    "intakeDate"       text,
    "derivedBirthDate" text        NOT NULL,
    "ageParsed"        boolean     NOT NULL,
    "archivedAt"       timestamptz NOT NULL DEFAULT now()
  );

  ALTER TABLE "public"."pets" ADD COLUMN IF NOT EXISTS "birthDate" text;
  ALTER TABLE "public"."pets" ADD COLUMN IF NOT EXISTS "birthDateIsEstimate" boolean;

  -- Derive once, into the archive; the backfill below then reads the archive rather than
  -- recomputing, so the stored row and the audit trail cannot disagree.
  INSERT INTO "public"."pets_age_archive_20260922"
    ("id", "age", "ageCategory", "intakeDate", "derivedBirthDate", "ageParsed")
  SELECT
    d."id",
    d."age",
    d."ageCategory",
    d."intakeDate",
    to_char(
      CASE
        -- UTC, not CURRENT_DATE: the JS returns `new Date().toISOString().split("T")[0]`, which is
        -- the UTC day. In Malaysia (UTC+8) the session's CURRENT_DATE is a day ahead of that for
        -- eight hours out of every twenty-four, and the rehearsal caught exactly that.
        WHEN d.intake IS NULL THEN timezone('UTC', now())::date
        WHEN d.years IS NOT NULL THEN
          make_date(
            EXTRACT(YEAR FROM d.intake)::int - d.years,
            EXTRACT(MONTH FROM d.intake)::int,
            1
          ) + (EXTRACT(DAY FROM d.intake)::int - 1)
        WHEN d.months IS NOT NULL THEN
          make_date(
            ((EXTRACT(YEAR FROM d.intake)::int * 12 + EXTRACT(MONTH FROM d.intake)::int - 1)
              - d.months) / 12,
            ((EXTRACT(YEAR FROM d.intake)::int * 12 + EXTRACT(MONTH FROM d.intake)::int - 1)
              - d.months) % 12 + 1,
            1
          ) + (EXTRACT(DAY FROM d.intake)::int - 1)
        ELSE d.intake
      END,
      'YYYY-MM-DD'
    ) AS "derivedBirthDate",
    (d.intake IS NOT NULL AND (d.years IS NOT NULL OR d.months IS NOT NULL)) AS "ageParsed"
  FROM (
    SELECT
      "id",
      "age",
      "ageCategory",
      "intakeDate",
      CASE
        WHEN "intakeDate" ~ '^\d{4}-\d{2}-\d{2}'
        THEN substring("intakeDate" FROM 1 FOR 10)::date
        ELSE NULL
      END AS intake,
      -- Matches src/lib/domain/petAge.ts: years win outright, so "2 years 3 months" is two years.
      NULLIF(substring(lower(btrim(coalesce("age", ''))) FROM '(\d+)\s*y'), '')::int AS years,
      NULLIF(substring(lower(btrim(coalesce("age", ''))) FROM '(\d+)\s*m'), '')::int AS months
    FROM "public"."pets"
  ) d
  ON CONFLICT ("id") DO NOTHING;

  GET DIAGNOSTICS archived_count = ROW_COUNT;

  UPDATE "public"."pets" p
     SET "birthDate"           = a."derivedBirthDate",
         "birthDateIsEstimate" = true
    FROM "public"."pets_age_archive_20260922" a
   WHERE a."id" = p."id"
     AND p."birthDate" IS NULL;

  -- A row the app wrote between the ADD COLUMN and now would already carry a date; only the
  -- estimate flag could still be missing. Default it honestly rather than leave it NULL.
  UPDATE "public"."pets" SET "birthDateIsEstimate" = true WHERE "birthDateIsEstimate" IS NULL;

  SELECT count(*) INTO still_null FROM "public"."pets" WHERE "birthDate" IS NULL;
  IF still_null > 0 THEN
    RAISE EXCEPTION
      '% pets row(s) still have no birthDate after the backfill; refusing to invent one', still_null;
  END IF;

  SELECT count(*) INTO unparsed_count
    FROM "public"."pets_age_archive_20260922" WHERE NOT "ageParsed";

  ALTER TABLE "public"."pets" ALTER COLUMN "birthDate" SET NOT NULL;
  ALTER TABLE "public"."pets" ALTER COLUMN "birthDate" SET DEFAULT '2024-01-01';
  ALTER TABLE "public"."pets" ALTER COLUMN "birthDateIsEstimate" SET NOT NULL;
  ALTER TABLE "public"."pets" ALTER COLUMN "birthDateIsEstimate" SET DEFAULT true;

  ALTER TABLE "public"."pets" DROP COLUMN "age";
  ALTER TABLE "public"."pets" DROP COLUMN "ageCategory";

  RAISE NOTICE 'Archived % pets row(s); % had age prose this rule could not read.',
    archived_count, unparsed_count;
END $$;

COMMIT;
