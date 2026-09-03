-- Additive supporter-account migration, for the sponsor portal.
--
-- Written by hand rather than taken from `prisma db push`, for the reason set out in
-- tasks/open/production-schema-has-drifted-ahead-of-master.md: push resolves its target
-- from `.env.local` (which holds NEON_BRANCH=production), has no local-only guard, and a
-- full diff against production currently carries 12 destructive statements belonging to
-- other branches' drift. Running it here would take the FAQ tables, the donation QR
-- configuration, and the status of every pet and adoption application with it.
--
-- Companion to 2026-09-03_pet_sponsorships_additive.sql, which created
-- `pet_sponsorships`. This adds the account that claims those commitments.
--
-- Every statement below is additive and idempotent: re-running it is a no-op.
--
--     psql "$DATABASE_URL" -f prisma/sql/2026-09-03_sponsor_accounts_additive.sql

BEGIN;

-- A supporter's portal account.
--
-- Deliberately separate from `users`, which is staff. Sponsors authenticate through their
-- own cookie namespace; see src/lib/security/sponsorSession.ts for why the two are not
-- unified, and note that `loginAction` accepts a development password for any `users` row.
CREATE TABLE IF NOT EXISTS "sponsors" (
    "id"            TEXT NOT NULL,
    "email"         TEXT NOT NULL,
    "name"          TEXT NOT NULL,
    "passwordHash"  TEXT NOT NULL,
    -- The account's current answer on public listing. Each commitment also records the
    -- answer given at its own checkout, in "pet_sponsorships"."displayOnWall".
    "displayOnWall" BOOLEAN NOT NULL DEFAULT false,
    "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"     TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sponsors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "sponsors_email_key"
    ON "sponsors" ("email");

CREATE INDEX IF NOT EXISTS "sponsors_displayOnWall_idx"
    ON "sponsors" ("displayOnWall");

-- Sponsor Wall consent as given at checkout.
--
-- Recorded per commitment rather than per account because checkout is guest-only: most
-- supporters have no account at the moment they give. The account inherits the answer when
-- the commitment is claimed, in registerSponsorAction.
ALTER TABLE "pet_sponsorships"
    ADD COLUMN IF NOT EXISTS "displayOnWall" BOOLEAN NOT NULL DEFAULT false;

-- `pet_sponsorships"."userId"` already exists — it was created by the companion migration
-- and reserved for exactly this. Only the foreign key and its index are new.
--
-- ON DELETE SET NULL because a commitment outlives an account: closing the account must
-- not erase the record that the money was pledged, nor the animal's funding total.
CREATE INDEX IF NOT EXISTS "pet_sponsorships_userId_idx"
    ON "pet_sponsorships" ("userId");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'pet_sponsorships_userId_fkey'
    ) THEN
        ALTER TABLE "pet_sponsorships"
            ADD CONSTRAINT "pet_sponsorships_userId_fkey"
            FOREIGN KEY ("userId") REFERENCES "sponsors" ("id")
            ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END
$$;

COMMIT;

-- To verify, expecting one row for the table and one for each column:
--
--     SELECT table_name, column_name FROM information_schema.columns
--      WHERE table_name IN ('sponsors', 'pet_sponsorships')
--        AND column_name IN ('passwordHash', 'displayOnWall', 'userId')
--      ORDER BY table_name, column_name;
