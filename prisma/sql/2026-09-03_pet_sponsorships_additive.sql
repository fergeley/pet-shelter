-- Additive sponsorship migration, extracted by hand from
--   prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script
-- and reduced to ONLY the sponsorship objects.
--
-- The full diff also contained 12 destructive statements against live data —
-- DROP TABLE faqs / notification_preferences, DROP TYPE FaqCategory, and
-- DROP COLUMN on pets.status, pets.age, pets.ageCategory, pets.customQrUrl,
-- adoption_applications.status and four shelter_settings QR columns. Those exist
-- in the database because other branches pushed them and have not merged; they
-- are drift to be reconciled deliberately, not collateral of this feature.
-- Running `prisma db push` here would execute them.
--
-- Every statement below is additive and idempotent: re-running it is a no-op.

BEGIN;

-- Per-animal care-cost target. Nullable: null means "use the shelter default".
ALTER TABLE "pets"
  ADD COLUMN IF NOT EXISTS "sponsorshipGoalSen" INTEGER;

-- Shelter-wide fallback target, RM 1,500.00 in sen.
ALTER TABLE "shelter_settings"
  ADD COLUMN IF NOT EXISTS "defaultSponsorshipGoalSen" INTEGER NOT NULL DEFAULT 150000;

-- A supporter's standing commitment to fund one animal's care. Distinct from
-- `donations`, which is the append-only issued receipt.
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

-- One pledge reference per commitment, and at most one receipt attached to it:
-- the unique index is what stops a second reconciliation minting a second
-- receipt for the same money.
CREATE UNIQUE INDEX IF NOT EXISTS "pet_sponsorships_pledgeRef_key"
  ON "pet_sponsorships"("pledgeRef");
CREATE UNIQUE INDEX IF NOT EXISTS "pet_sponsorships_receiptNumber_key"
  ON "pet_sponsorships"("receiptNumber");

-- Serves the per-animal supporter count and funding total.
CREATE INDEX IF NOT EXISTS "pet_sponsorships_petId_status_idx"
  ON "pet_sponsorships"("petId", "status");
CREATE INDEX IF NOT EXISTS "pet_sponsorships_sponsorEmail_idx"
  ON "pet_sponsorships"("sponsorEmail");

-- Nullable FK with ON DELETE SET NULL: an archived animal must not take its
-- supporters' records with it, which is why petName is snapshotted alongside.
-- Dropped first so this script stays idempotent without a DO block.
ALTER TABLE "pet_sponsorships"
  DROP CONSTRAINT IF EXISTS "pet_sponsorships_petId_fkey";
ALTER TABLE "pet_sponsorships"
  ADD CONSTRAINT "pet_sponsorships_petId_fkey"
  FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE CASCADE;

COMMIT;
