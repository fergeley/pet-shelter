-- Additive migration: adoption application reference codes, intake detail, and
-- workflow milestones.
--
-- Created: 2026-09-08
-- Model: AdoptionApplication
--
-- Every statement below is additive and idempotent: re-running it is a no-op.
-- Nothing here drops, retypes, or rewrites an existing column, and no existing
-- row changes value — every new column is nullable with no default.
--
--     npx prisma db execute --file prisma/sql/2026-09-08_adoption_application_milestones_additive.sql
--
-- DO NOT reach for `npm run db:push` to apply this. Per
-- tasks/open/production-schema-has-drifted-ahead-of-master.md, push resolves to
-- the production Neon branch with no local-only guard, and its diff still
-- carries twelve destructive statements — including a DROP/ADD of
-- "adoption_applications"."status" that would reset the status of every
-- application in the table. This file exists so that these nine columns can be
-- applied WITHOUT dragging that pending conversion along with them.
--
-- Note on the status enum: this migration deliberately does not touch
-- "ApplicationStatus". Interview and home-visit progress are recorded as the
-- timestamps below instead, so the enum needs no new members and the pending
-- conversion stays untouched and out of scope.

BEGIN;

-- 1. Public reference code (HFS-APP-YYYYMM-XXXX).
--    Nullable: rows predating the code are still addressed by "id", and both
--    remain valid lookups in the tracking portal.
ALTER TABLE "adoption_applications"
    ADD COLUMN IF NOT EXISTS "referenceCode" TEXT;

-- Postgres permits many NULLs under a UNIQUE index, so unapplied legacy rows
-- coexist with the constraint that makes the code safe to look up by.
CREATE UNIQUE INDEX IF NOT EXISTS "adoption_applications_referenceCode_key"
    ON "adoption_applications"("referenceCode");

-- 2. Additional intake detail collected by the multi-step application form.
--    "identification" holds an NRIC or passport number and is restricted: it is
--    excluded from the public tracking DTO and from every notification email.
ALTER TABLE "adoption_applications"
    ADD COLUMN IF NOT EXISTS "identification" TEXT;

ALTER TABLE "adoption_applications"
    ADD COLUMN IF NOT EXISTS "landlordApproval" TEXT;

ALTER TABLE "adoption_applications"
    ADD COLUMN IF NOT EXISTS "vetClinic" TEXT;

ALTER TABLE "adoption_applications"
    ADD COLUMN IF NOT EXISTS "dailyAloneHours" TEXT;

-- 3. Workflow milestones.
--    Timestamps rather than enum members: an application can be at the
--    home-visit stage and still be UNDER_REVIEW, so progress and decision are
--    independent axes. Setting one of these lights a step in the public
--    tracking portal, which previously recovered the same facts by regex from
--    the free-text "adminReviewNotes" column.
ALTER TABLE "adoption_applications"
    ADD COLUMN IF NOT EXISTS "interviewAt" TIMESTAMP(3);

ALTER TABLE "adoption_applications"
    ADD COLUMN IF NOT EXISTS "interviewLocation" TEXT;

ALTER TABLE "adoption_applications"
    ADD COLUMN IF NOT EXISTS "interviewMeetingType" TEXT;

ALTER TABLE "adoption_applications"
    ADD COLUMN IF NOT EXISTS "homeVisitAt" TIMESTAMP(3);

COMMIT;
