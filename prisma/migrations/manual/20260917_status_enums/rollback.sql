-- Undoes migration.sql: both status columns back to text, values kept.
--
-- This restores the state in which every application insert and status write fails, so
-- run it only if the conversion itself turns out to break something else. The two types
-- are left in place; they are harmless, and their absence is what broke the writes.
--
-- NOT NULL stays, because it was there before: both columns were declared
-- `String @default(...)`, which is required, from the first schema production was built from
-- (e0884e9). migration.sql re-asserts it rather than introducing it.

BEGIN;

SELECT pg_advisory_xact_lock(4210771001);
SET LOCAL lock_timeout = '5s';

ALTER TABLE "public"."adoption_applications" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."adoption_applications" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "public"."adoption_applications" ALTER COLUMN "status" SET DEFAULT 'SUBMITTED';

ALTER TABLE "public"."pets" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "public"."pets" ALTER COLUMN "status" TYPE text USING "status"::text;
ALTER TABLE "public"."pets" ALTER COLUMN "status" SET DEFAULT 'Available';

COMMIT;
