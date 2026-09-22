-- Undoes migration.sql: `pets.age` and `pets.ageCategory` back, with their original values, and
-- `birthDate` / `birthDateIsEstimate` gone.
--
-- Read this before running it. It restores the state in which the deployed client's every pet
-- read fails 42703 and the site serves the `src/data/pets.json` fixture — that is what production
-- looked like before migration.sql, and undoing a conversion does not undo the deploy that needs
-- it. For almost any problem the conversion turns out to cause, fixing forward is the better
-- move. This file exists because DROP COLUMN is otherwise a one-way door, not because it is the
-- expected next step.
--
-- Nothing is lost in either direction. Values come back verbatim from
-- "public"."pets_age_archive_20260922". Any animal created AFTER the conversion has no row there,
-- so this file writes one first: its real `birthDate` is kept as "derivedBirthDate", and `age` /
-- `ageCategory` are computed from that date as of the animal's intake, mirroring `formatAgeString`
-- and `computeAgeCategory` in src/lib/domain/petAge.ts. Those synthesised rows carry
-- "ageParsed" = false, because no age prose was ever read for them. Re-running migration.sql
-- afterwards therefore restores every birth date exactly, including the ones the app wrote while
-- the conversion was live.
--
-- Requires the archive table. If cleanup.sql has already dropped it, this file aborts rather than
-- invent ages — that is the point at which the conversion stops being reversible, and it is why
-- cleanup.sql is a separate, deliberate step.
--
-- One DO block, so both columns change together and the 5-second lock timeout holds even if an
-- editor runs each statement in its own transaction.

BEGIN;

SELECT pg_advisory_xact_lock(4210771001);

DO $$
DECLARE
  has_age        boolean;
  has_birth_date boolean;
  has_archive    boolean;
  missing_age    bigint;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'age'
  ) INTO has_age;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'birthDate'
  ) INTO has_birth_date;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.tables
     WHERE table_schema = 'public' AND table_name = 'pets_age_archive_20260922'
  ) INTO has_archive;

  IF has_age AND NOT has_birth_date THEN
    RAISE NOTICE 'pets.age is already back and pets.birthDate is already gone: nothing to do.';
    RETURN;
  END IF;

  IF NOT has_birth_date THEN
    RAISE EXCEPTION 'pets has no "birthDate" column; there is nothing here to roll back';
  END IF;

  IF NOT has_archive THEN
    RAISE EXCEPTION
      'pets_age_archive_20260922 is gone (cleanup.sql has run), so the original age values no longer exist; refusing to invent them';
  END IF;

  -- Animals created after the conversion: keep their real birth date in the archive so a later
  -- re-apply restores it, and reconstruct age prose as of intake the way the domain does.
  INSERT INTO "public"."pets_age_archive_20260922"
    ("id", "age", "ageCategory", "intakeDate", "derivedBirthDate", "ageParsed")
  SELECT
    m."id",
    CASE
      WHEN m.months < 12
        THEN greatest(m.months, 1)::text || ' month' || CASE WHEN greatest(m.months, 1) = 1 THEN '' ELSE 's' END
      ELSE (m.months / 12)::text || ' year' || CASE WHEN (m.months / 12) = 1 THEN '' ELSE 's' END
    END,
    -- ceiling: fourth copy of AGE_BAND_MIN_MONTHS, whose own comment in src/lib/domain/petAge.ts
    -- calls itself "the only definition of a band boundary". SQL cannot import it, and this file
    -- must run in the Neon editor with no application around it. It bites only if a boundary
    -- moves AND someone rolls back AND a pet was created after the migration — the synthesised
    -- band for those rows would be stale. If the bands ever change, grep this file.
    CASE
      WHEN m.months >= 96 THEN 'senior'
      WHEN m.months >= 36 THEN 'adult'
      WHEN m.months >= 12 THEN 'young'
      ELSE 'puppy_kitten'
    END,
    m."intakeDate",
    m."birthDate",
    false
  FROM (
    SELECT
      s."id",
      s."intakeDate",
      s."birthDate",
      greatest(
        0,
        CASE
          WHEN s.birth IS NULL THEN 0
          ELSE (EXTRACT(YEAR FROM s.asof)::int - EXTRACT(YEAR FROM s.birth)::int) * 12
             + (EXTRACT(MONTH FROM s.asof)::int - EXTRACT(MONTH FROM s.birth)::int)
             - CASE WHEN EXTRACT(DAY FROM s.asof)::int < EXTRACT(DAY FROM s.birth)::int THEN 1 ELSE 0 END
        END
      ) AS months
    FROM (
      SELECT
        p."id",
        p."intakeDate",
        p."birthDate",
        CASE
          WHEN p."birthDate" ~ '^\d{4}-\d{2}-\d{2}'
          THEN substring(p."birthDate" FROM 1 FOR 10)::date
          ELSE NULL
        END AS birth,
        -- CURRENT_DATE here, where migration.sql uses UTC, and the asymmetry is deliberate: it
        -- mirrors the two JS functions. `approximateBirthDate` formats with toISOString (UTC);
        -- `computeAgeInMonths(…, new Date())` reads getFullYear/getMonth/getDate (local).
        CASE
          WHEN p."intakeDate" ~ '^\d{4}-\d{2}-\d{2}'
          THEN substring(p."intakeDate" FROM 1 FOR 10)::date
          ELSE CURRENT_DATE
        END AS asof
      FROM "public"."pets" p
      WHERE NOT EXISTS (
        SELECT 1 FROM "public"."pets_age_archive_20260922" a WHERE a."id" = p."id"
      )
    ) s
  ) m
  ON CONFLICT ("id") DO NOTHING;

  ALTER TABLE "public"."pets" ADD COLUMN IF NOT EXISTS "age" text;
  ALTER TABLE "public"."pets" ADD COLUMN IF NOT EXISTS "ageCategory" text;

  UPDATE "public"."pets" p
     SET "age"         = a."age",
         "ageCategory" = a."ageCategory"
    FROM "public"."pets_age_archive_20260922" a
   WHERE a."id" = p."id";

  SELECT count(*) INTO missing_age
    FROM "public"."pets" WHERE "age" IS NULL OR "ageCategory" IS NULL;
  IF missing_age > 0 THEN
    RAISE EXCEPTION
      '% pets row(s) have no archived age; refusing to restore a NOT NULL column with a guess', missing_age;
  END IF;

  ALTER TABLE "public"."pets" ALTER COLUMN "age" SET NOT NULL;
  ALTER TABLE "public"."pets" ALTER COLUMN "ageCategory" SET NOT NULL;

  ALTER TABLE "public"."pets" DROP COLUMN "birthDate";
  ALTER TABLE "public"."pets" DROP COLUMN "birthDateIsEstimate";
END $$;

COMMIT;
