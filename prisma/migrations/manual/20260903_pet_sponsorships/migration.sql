-- Pet sponsorships: the `pet_sponsorships` table, four indexes, one foreign key,
-- plus `pets.sponsorshipGoalSen` and `shelter_settings.defaultSponsorshipGoalSen`.
--
-- Written by hand rather than applied with `prisma db push`, for the reason the
-- FAQ migration beside this one gives: `db push` reconciles the WHOLE schema and
-- drops anything the database has that prisma/schema.prisma does not. Measured
-- on 2026-09-03, a push against the production branch would have run 12
-- destructive statements — dropping `faqs`, `notification_preferences`, the
-- `shelter_settings` QR columns, and the `status` column of every pet and every
-- adoption application. Run `npm run db:check-drift` before touching any of this.
--
-- Takes the SAME advisory lock key as the FAQ migration, so concurrent appliers
-- from different worktrees queue rather than race.
--
-- Safe to re-run: every statement is idempotent, and BEGIN/COMMIT live in this
-- file so it behaves the same however it is run.
--
-- Applied to the production Neon branch on 2026-09-03, after rehearsing on a
-- branch cut from production (identical 265-line diff, so a faithful copy).
-- Verified by re-running `prisma migrate diff`: 265 -> 220 lines, and every
-- sponsorship reference gone.

BEGIN;

SELECT pg_advisory_xact_lock(4210771001);

-- Per-animal care-cost target. Nullable: null means "use the shelter default".
ALTER TABLE "pets"
  ADD COLUMN IF NOT EXISTS "sponsorshipGoalSen" INTEGER;

-- Shelter-wide fallback target, RM 1,500.00 in sen.
ALTER TABLE "shelter_settings"
  ADD COLUMN IF NOT EXISTS "defaultSponsorshipGoalSen" INTEGER NOT NULL DEFAULT 150000;

-- A supporter's standing commitment to fund one animal's care. Distinct from
-- `donations`, which is the append-only issued receipt: a commitment has a
-- lifecycle and can be cancelled, a receipt cannot.
CREATE TABLE IF NOT EXISTS "pet_sponsorships" (
    "id" TEXT NOT NULL,
    "petId" TEXT,
    "petName" TEXT NOT NULL,
    "sponsorName" TEXT NOT NULL,
    "sponsorEmail" TEXT NOT NULL,
    "sponsorPhone" TEXT,
    "userId" TEXT,
    "tierId" TEXT NOT NULL,
    "tierName" TEXT NOT NULL,
    "frequency" TEXT NOT NULL DEFAULT 'one_time',
    "amountSen" INTEGER NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING_PAYMENT',
    "pledgeRef" TEXT NOT NULL,
    "receiptNumber" TEXT,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "taxIdOrIc" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pet_sponsorships_pkey" PRIMARY KEY ("id")
);

-- One pledge reference per commitment, and at most one receipt attached to it.
-- The unique index on receiptNumber is what stops a second reconciliation
-- minting a second Section 44(6) receipt for the same money.
CREATE UNIQUE INDEX IF NOT EXISTS "pet_sponsorships_pledgeRef_key"
  ON "pet_sponsorships"("pledgeRef");
CREATE UNIQUE INDEX IF NOT EXISTS "pet_sponsorships_receiptNumber_key"
  ON "pet_sponsorships"("receiptNumber");

-- Serves the per-animal supporter count and funding total.
CREATE INDEX IF NOT EXISTS "pet_sponsorships_petId_status_idx"
  ON "pet_sponsorships"("petId", "status");
CREATE INDEX IF NOT EXISTS "pet_sponsorships_sponsorEmail_idx"
  ON "pet_sponsorships"("sponsorEmail");

-- Nullable FK with ON DELETE SET NULL: archiving an animal must not take its
-- supporters' records with it, which is why petName is snapshotted alongside.
-- Dropped first so this stays idempotent without a DO block, which `prisma db
-- execute` would have to split on the inner semicolons.
ALTER TABLE "pet_sponsorships"
  DROP CONSTRAINT IF EXISTS "pet_sponsorships_petId_fkey";
ALTER TABLE "pet_sponsorships"
  ADD CONSTRAINT "pet_sponsorships_petId_fkey"
  FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
