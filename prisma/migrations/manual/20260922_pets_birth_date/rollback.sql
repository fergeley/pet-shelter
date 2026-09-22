-- Undoes migration.sql: drops the two columns it added and restores the two NOT NULLs it
-- relaxed. `age` and `ageCategory` were never written to, so their values are exactly as they
-- were and this returns `pets` to the column set production had before.
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
-- The NOT NULLs come back only if they can. Any pet created after migration.sql ran has a NULL
-- `age`, because the running release does not write that column -- which is precisely why
-- migration.sql relaxed it. Where such a row exists the constraint cannot be restored without
-- inventing prose for it, so this file leaves the column nullable and says so rather than
-- failing the rollback or making something up. The column set still matches what production
-- had; only that one constraint stays relaxed, and it is the harmless direction.
--
-- One DO block, so every change lands together and the 5-second lock timeout holds even if an
-- editor runs each statement in its own transaction.
--
-- Rehearsed 2026-09-22 alongside migration.sql on a throwaway embedded PostgreSQL 18.4: it
-- returns `pets` to its pre-migration shape with every `age` and `ageCategory` value kept,
-- migration.sql applies again cleanly afterwards, and with a post-migration row whose `age` is
-- NULL it keeps that column nullable and reports it instead of aborting.

BEGIN;

SELECT pg_advisory_xact_lock(4210771001);

DO $$
DECLARE
  null_ages       bigint;
  null_categories bigint;
BEGIN
  PERFORM set_config('lock_timeout', '5s', true);

  ALTER TABLE "public"."pets" DROP COLUMN IF EXISTS "birthDate";
  ALTER TABLE "public"."pets" DROP COLUMN IF EXISTS "birthDateIsEstimate";

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'age'
  ) THEN
    SELECT count(*) INTO null_ages FROM "public"."pets" WHERE "age" IS NULL;
    IF null_ages = 0 THEN
      ALTER TABLE "public"."pets" ALTER COLUMN "age" SET NOT NULL;
    ELSE
      RAISE NOTICE
        'pets."age" left nullable: % row(s) created since migration.sql have no value for it, and this file will not invent one.',
        null_ages;
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'ageCategory'
  ) THEN
    SELECT count(*) INTO null_categories FROM "public"."pets" WHERE "ageCategory" IS NULL;
    IF null_categories = 0 THEN
      ALTER TABLE "public"."pets" ALTER COLUMN "ageCategory" SET NOT NULL;
    ELSE
      RAISE NOTICE
        'pets."ageCategory" left nullable: % row(s) created since migration.sql have no value for it.',
        null_categories;
    END IF;
  END IF;
END $$;

COMMIT;
