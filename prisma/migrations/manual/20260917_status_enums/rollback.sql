-- Undoes migration.sql: both status columns back to text, values kept.
--
-- This restores the state in which every application insert and status write fails, so
-- run it only if the conversion itself turns out to break something else. The two types
-- are left in place; they are harmless, and their absence is what broke the writes.

BEGIN;

SELECT pg_advisory_xact_lock(4210771001);

ALTER TABLE "adoption_applications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "adoption_applications" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "adoption_applications" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

ALTER TABLE "pets" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "pets" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "pets" ALTER COLUMN "status" SET DEFAULT 'Available';

COMMIT;
