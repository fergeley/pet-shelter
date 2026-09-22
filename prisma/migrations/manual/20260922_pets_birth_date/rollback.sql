-- Undoes migration.sql: drops the two columns it added and restores the NOT NULLs it removed.
-- `age` and `ageCategory` were never written to, so their values are exactly as they were.
--
-- READ THIS FIRST. Unlike the rollback beside 20260917_status_enums, this one is not free.
--
--   * It re-breaks the public catalogue. With `birthDate` gone, the deployed client's
--     prisma.pet.findMany fails 42703 again on every read and the site falls back to the ten
--     demo animals in src/data/pets.json. That is the state migration.sql was written to end.
--   * It destroys every birthday entered or corrected since. `birthDate` is the only place an
--     exact date lives -- `age` is not updated when staff edit a pet through the admin form --
--     so a date a human typed after go-live is gone with the column and cannot be recovered
--     from anything left in this table. Export first:
--
--       SELECT "id", "name", "birthDate", "birthDateIsEstimate", "age", "intakeDate"
--         FROM "public"."pets" ORDER BY "id";
--
--     Keep that output. It is the whole of what this statement is about to discard.
--
-- So run this only if adding the columns turns out to break something else -- a view, a
-- trigger, a report that reads `pets` positionally. Do not run it to "undo a bad backfill":
-- a wrong date is corrected in place with an UPDATE, which keeps everything else working.
--
-- IT CAN ALSO LEAVE migration.sql INAPPLICABLE, which is the trap worth understanding before
-- you run it. Any pet created after migration.sql went in has `age IS NULL`, because the running
-- release writes neither old column -- that is exactly why migration.sql relaxed them. Dropping
-- `birthDate` leaves such a row with no birthday and no prose to derive one from, and
-- migration.sql refuses a table it cannot fully derive: **one such row aborts the whole file**,
-- so the catalogue cannot be fixed again until every one of them has an `age`. This file names
-- those rows before it drops anything, and the export above is how you get their dates back.
-- Give each one an age from the exported birthDate before re-applying, for example:
--
--       UPDATE "public"."pets" SET "age" = '2 years' WHERE "id" = '...';   -- whole units only
--
-- The NOT NULLs come back only where migration.sql removed them. It marks each column it
-- relaxes with a comment; this file restores the constraint only on a marked column, then
-- clears the mark. Production's nullability was never measured, so if `age` was already nullable
-- there, migration.sql changed nothing and this file must change nothing either -- restoring a
-- constraint that was not there would leave the column stricter than it was found and break
-- every pet creation for a reason nothing here caused.
--
-- Where a marked column has since acquired NULLs -- the post-migration rows above -- the
-- constraint cannot be restored without inventing prose for them. This file then leaves the
-- column nullable and says so, rather than failing the rollback or making something up. The
-- column set still matches what production had; only that one constraint stays relaxed, and it
-- is the harmless direction.
--
-- One DO block, so every change lands together and the 5-second lock timeout holds even if an
-- editor runs each statement in its own transaction.
--
-- Rehearsed 2026-09-22 alongside migration.sql on a throwaway embedded PostgreSQL 18.4: it
-- returns `pets` to its pre-migration shape with every `age` and `ageCategory` value kept,
-- migration.sql applies again cleanly afterwards, a post-migration row whose `age` is NULL keeps
-- the column nullable and is named rather than aborting, and a table whose `age` was already
-- nullable before migration.sql is left nullable rather than tightened.

BEGIN;

-- Bounds the wait on the advisory lock below, which is outside the DO block and so is not
-- covered by the lock_timeout that block sets.
SET LOCAL lock_timeout = '5s';

SELECT pg_advisory_xact_lock(4210771001);

DO $$
DECLARE
  stranded  text;
  marker    constant text := 'NOT NULL removed by 20260922_pets_birth_date%';
  col       text;
  nulls     bigint;
  was_mine  boolean;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  LOCK TABLE "public"."pets" IN ACCESS EXCLUSIVE MODE;

  -- Named before anything is dropped, because after the DROP there is nothing left to name them
  -- by. These are the rows that will have neither a birthday nor prose to derive one from, and
  -- each one of them will abort migration.sql until it is given an `age`.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'birthDate'
  ) AND EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'age'
  ) THEN
    SELECT string_agg(
             format('%L (birthDate=%L, intakeDate=%L)', "id", "birthDate", "intakeDate"),
             E'\n    ' ORDER BY "id")
      INTO stranded
      FROM "public"."pets"
     WHERE "age" IS NULL OR btrim("age") = '';

    IF stranded IS NOT NULL THEN
      RAISE NOTICE E'these pets will be left with no birthday and no age to derive one from, and each will abort migration.sql until it has one:\n    %\nTheir birthDate values are above -- give each an age in whole units before re-applying.',
        stranded;
    END IF;
  END IF;

  ALTER TABLE "public"."pets" DROP COLUMN IF EXISTS "birthDate";
  ALTER TABLE "public"."pets" DROP COLUMN IF EXISTS "birthDateIsEstimate";

  FOREACH col IN ARRAY ARRAY['age', 'ageCategory'] LOOP
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = col
    );

    SELECT coalesce(d.description, '') LIKE marker
      INTO was_mine
      FROM pg_attribute a
      JOIN pg_class c ON c.oid = a.attrelid
      JOIN pg_namespace n ON n.oid = c.relnamespace
      LEFT JOIN pg_description d ON d.objoid = a.attrelid AND d.objsubid = a.attnum
     WHERE n.nspname = 'public' AND c.relname = 'pets' AND a.attname = col;

    IF NOT was_mine THEN
      RAISE NOTICE
        'pets."%" left as it is: migration.sql did not remove a NOT NULL from it, so this file will not add one.',
        col;
      CONTINUE;
    END IF;

    EXECUTE format('SELECT count(*) FROM "public"."pets" WHERE %I IS NULL', col) INTO nulls;

    IF nulls = 0 THEN
      EXECUTE format('ALTER TABLE "public"."pets" ALTER COLUMN %I SET NOT NULL', col);
      EXECUTE format('COMMENT ON COLUMN "public"."pets".%I IS NULL', col);
    ELSE
      RAISE NOTICE
        'pets."%" left nullable: % row(s) created since migration.sql have no value for it, and this file will not invent one.',
        col, nulls;
    END IF;
  END LOOP;
END $$;

COMMIT;
