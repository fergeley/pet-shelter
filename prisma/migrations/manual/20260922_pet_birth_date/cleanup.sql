-- Drops "public"."pets_age_archive_20260922", the copy of `pets.age` / `pets.ageCategory` that
-- migration.sql took before dropping them.
--
-- **Running this makes the conversion irreversible.** rollback.sql reads this table and aborts
-- without it, and no other copy of the original age prose exists anywhere — the values were never
-- in a Prisma migration, a dump, or a fixture that matches production.
--
-- Run it only once the conversion has been live long enough to trust, and only after reading
-- what is about to be destroyed:
--
--   SELECT count(*) AS rows,
--          count(*) FILTER (WHERE NOT "ageParsed") AS age_prose_not_understood
--     FROM pets_age_archive_20260922;
--   SELECT "id", "age", "ageCategory", "intakeDate", "derivedBirthDate", "ageParsed"
--     FROM pets_age_archive_20260922 ORDER BY "ageParsed", "id";
--
-- Any row with "ageParsed" = false took its birth date from the intake date rather than from the
-- age prose, because the prose held no readable year or month figure. Those are the rows worth a
-- human's eye before the originals go.
--
-- Until this runs, `npm run db:check-drift` reports one destructive statement,
-- `DROP TABLE "pets_age_archive_20260922"`, because prisma/schema.prisma does not declare this
-- table. That single statement is the whole of the remaining drift and is expected. Drift reaches
-- zero when this file runs.
--
-- Keeping the archive costs a few kilobytes and nothing else: no application code reads it, and
-- Prisma never touches a table absent from the schema.

BEGIN;

SELECT pg_advisory_xact_lock(4210771001);

DROP TABLE IF EXISTS "public"."pets_age_archive_20260922";

COMMIT;
