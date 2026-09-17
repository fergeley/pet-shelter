-- Status enums: convert adoption_applications.status and pets.status, in place, to the
-- "ApplicationStatus" and "PetStatus" types prisma/schema.prisma declares.
--
-- Why: in production both columns are plain text and neither type exists, but the deployed
-- client casts to them — CAST($n::text AS "public"."ApplicationStatus") — on every
-- application insert, application status update and status filter, and on pet status
-- updates. Each of those fails there, and insertServerApplication swallows the failure, so
-- an applicant sees success and nothing is stored. Evidence:
-- tasks/open/production-schema-has-drifted-ahead-of-master.md.
--
-- Why not `prisma db push`: push drops the column and re-adds it with a default, which
-- resets every approval and rejection to SUBMITTED. This converts with a USING cast, so
-- every existing value is kept.
--
-- Scope: these two columns and their types only. The rest of the drift — pets.age to
-- birthDate, the shelter_settings columns, three indexes — is not here.
--
-- Safety:
--   * One transaction. Any failure — a value the type lacks, a NULL, a dependent view or
--     constraint — aborts the file and leaves both columns exactly as they were.
--   * Nothing is coerced. A status the type lacks aborts with the offending values named.
--   * Safe to re-run: the types are created optimistically, and a column that is already
--     the enum type is left alone.
--   * Takes the advisory lock the other manual migrations take.
--   * ALTER COLUMN TYPE rewrites each table under an ACCESS EXCLUSIVE lock. These tables
--     hold tens of rows; expect milliseconds. If the lock is not granted within 5 seconds,
--     because some other transaction holds the table, it gives up instead of stalling the
--     live site's reads behind it. Re-run later.
--   * Every type and table is named with its schema, so the result does not depend on the
--     session's search_path.
--
-- Apply: take the "before" counts below, then paste this whole file into the Neon SQL
-- editor for the production branch, then run the "after" checks.
--
--   SELECT 'adoption_applications' AS t, status::text, count(*) FROM adoption_applications GROUP BY 2
--   UNION ALL SELECT 'pets', status::text, count(*) FROM pets GROUP BY 2 ORDER BY 1, 2;
--
-- After: the same query returns the same counts, and
--
--   SELECT table_name, udt_schema, udt_name, column_default FROM information_schema.columns
--   WHERE table_schema = 'public' AND column_name = 'status'
--     AND table_name IN ('adoption_applications', 'pets');
--
-- reports public."ApplicationStatus" and public."PetStatus". Undo: rollback.sql beside this file.
--
-- If a statement errors part-way, nothing is kept: the transaction is aborted, and the
-- COMMIT at the end of an aborted transaction rolls it back. Even if an editor ran the
-- statements one at a time, each column's value check, lock timeout and conversion share one
-- DO block, so a column is either converted with every value kept or left exactly as it was,
-- and neither waits on a lock for more than 5 seconds. Only the advisory lock stops
-- serialising in that mode.
--
-- Rehearsed 2026-09-17 on a throwaway local PostgreSQL 18.4, with production's shape where it
-- matters (text `status` columns carrying a default and a composite index, neither type
-- present), not against production. Re-rehearsed after two rounds of code review, with the
-- schema qualification and the per-block lock timeout; twenty-nine checks, all passed:
--   * Before: Prisma's own insert fails with `type "public.ApplicationStatus" does not exist`.
--   * After: every status value and count kept; both defaults restored; Prisma's application
--     insert, status update and status filter, and pet status update, all succeed; an
--     unknown status is now refused by the database.
--   * Re-running is a no-op. rollback.sql returns both columns to text with values kept, and
--     this file applies again afterwards.
--   * A pet status the type lacks ("Medical Hold"), a NULL application status, and a
--     pre-existing ApplicationStatus with other labels each abort naming the cause, leaving
--     both columns text and no type created.
--   * With search_path set to another schema first, both types still land in public and
--     Prisma's casts work. The unqualified first version failed this: its types went to the
--     other schema, the columns converted, and Prisma's insert still failed.
--   * With another transaction holding `pets`, it gives up after the 5-second lock timeout
--     and commits nothing, not even the table it had already converted.
--   * Run one statement per transaction, as an editor might, under the same held lock: it
--     gives up in about 6 seconds with `pets` untouched, and re-running once the lock is free
--     finishes the job. The previous version, with SET LOCAL at the top, was still waiting at
--     20 seconds. rollback.sql run the same way also gives up without changing either column.
-- Not rehearsed: production's actual values and any constraint or view there that references
-- `status`. Either would abort the transaction rather than damage anything.

BEGIN;

SELECT pg_advisory_xact_lock(4210771001);

-- Every type and table is schema-qualified: Prisma casts to "public"."ApplicationStatus", so a
-- type created wherever search_path pointed would convert the columns and leave writes failing.

-- CreateEnum. Optimistic, as in 20260903_faq_knowledge_base: a pre-check is not race-safe.
DO $$ BEGIN
  CREATE TYPE "public"."ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- "In Rehabilitation" is the database label of the schema's In_Rehabilitation (@map).
DO $$ BEGIN
  CREATE TYPE "public"."PetStatus" AS ENUM ('Available', 'Pending', 'Adopted', 'In Rehabilitation');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- A type that already existed must be the one the client expects, label for label.
DO $$ BEGIN
  IF enum_range(NULL::"public"."ApplicationStatus")::text[] <> ARRAY['SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED'] THEN
    RAISE EXCEPTION 'ApplicationStatus already exists with labels %', enum_range(NULL::"public"."ApplicationStatus");
  END IF;
  IF enum_range(NULL::"public"."PetStatus")::text[] <> ARRAY['Available', 'Pending', 'Adopted', 'In Rehabilitation'] THEN
    RAISE EXCEPTION 'PetStatus already exists with labels %', enum_range(NULL::"public"."PetStatus");
  END IF;
END $$;

DO $$
DECLARE
  current_type text;
  unknown_values text;
BEGIN
  -- Give up rather than queue: an ALTER waiting behind a long-open transaction holds every
  -- later read of the table behind it, the live site's included. Set here, not with SET LOCAL
  -- at the top, so it holds even if an editor runs each statement in its own transaction.
  PERFORM set_config('lock_timeout', '5s', true);

  SELECT udt_schema || '.' || udt_name INTO current_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'adoption_applications' AND column_name = 'status';
  IF current_type IS NULL THEN
    RAISE EXCEPTION 'adoption_applications.status does not exist';
  END IF;

  IF current_type <> 'public.ApplicationStatus' THEN
    SELECT string_agg(DISTINCT coalesce("status"::text, 'NULL'), ', ') INTO unknown_values
      FROM "public"."adoption_applications"
     WHERE "status" IS NULL OR "status"::text <> ALL (enum_range(NULL::"public"."ApplicationStatus")::text[]);
    IF unknown_values IS NOT NULL THEN
      RAISE EXCEPTION 'adoption_applications.status holds values ApplicationStatus lacks: %', unknown_values;
    END IF;

    ALTER TABLE "public"."adoption_applications" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "public"."adoption_applications"
      ALTER COLUMN "status" TYPE "public"."ApplicationStatus" USING "status"::text::"public"."ApplicationStatus";
  END IF;

  ALTER TABLE "public"."adoption_applications" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';
  ALTER TABLE "public"."adoption_applications" ALTER COLUMN "status" SET NOT NULL;
END $$;

DO $$
DECLARE
  current_type text;
  unknown_values text;
BEGIN
  -- Give up rather than queue: an ALTER waiting behind a long-open transaction holds every
  -- later read of the table behind it, the live site's included. Set here, not with SET LOCAL
  -- at the top, so it holds even if an editor runs each statement in its own transaction.
  PERFORM set_config('lock_timeout', '5s', true);

  SELECT udt_schema || '.' || udt_name INTO current_type FROM information_schema.columns
   WHERE table_schema = 'public' AND table_name = 'pets' AND column_name = 'status';
  IF current_type IS NULL THEN
    RAISE EXCEPTION 'pets.status does not exist';
  END IF;

  IF current_type <> 'public.PetStatus' THEN
    SELECT string_agg(DISTINCT coalesce("status"::text, 'NULL'), ', ') INTO unknown_values
      FROM "public"."pets"
     WHERE "status" IS NULL OR "status"::text <> ALL (enum_range(NULL::"public"."PetStatus")::text[]);
    IF unknown_values IS NOT NULL THEN
      RAISE EXCEPTION 'pets.status holds values PetStatus lacks: %', unknown_values;
    END IF;

    ALTER TABLE "public"."pets" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "public"."pets" ALTER COLUMN "status" TYPE "public"."PetStatus" USING "status"::text::"public"."PetStatus";
  END IF;

  ALTER TABLE "public"."pets" ALTER COLUMN "status" SET DEFAULT 'Available';
  ALTER TABLE "public"."pets" ALTER COLUMN "status" SET NOT NULL;
END $$;

COMMIT;
