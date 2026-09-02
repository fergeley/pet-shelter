-- Donation QR codes: shelter-wide defaults + optional per-animal override.
--
-- Applied by hand rather than with `prisma db push`. Live Postgres has drifted
-- ahead of prisma/schema.prisma (Pet.rehabProgressPercent, Pet.rehabStage,
-- Pet.rehabStageMs, and the medical_timeline_events / pet_updates tables belong
-- to an unlanded branch), so a push generated from this schema would DROP them.
--
-- Every statement below is additive, nullable, and default-free: Postgres only
-- updates the catalog, so there is no table rewrite and no lock held on rows.
-- Reverse with the matching DROP COLUMN statements at the bottom.

ALTER TABLE "shelter_settings" ADD COLUMN IF NOT EXISTS "duitNowQrUrl"   TEXT;
ALTER TABLE "shelter_settings" ADD COLUMN IF NOT EXISTS "tngQrUrl"       TEXT;
ALTER TABLE "shelter_settings" ADD COLUMN IF NOT EXISTS "bankQrUrl"      TEXT;
ALTER TABLE "shelter_settings" ADD COLUMN IF NOT EXISTS "paymentPayload" TEXT;

ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "customQrUrl" TEXT;

-- Rollback:
-- ALTER TABLE "shelter_settings" DROP COLUMN IF EXISTS "duitNowQrUrl";
-- ALTER TABLE "shelter_settings" DROP COLUMN IF EXISTS "tngQrUrl";
-- ALTER TABLE "shelter_settings" DROP COLUMN IF EXISTS "bankQrUrl";
-- ALTER TABLE "shelter_settings" DROP COLUMN IF EXISTS "paymentPayload";
-- ALTER TABLE "pets" DROP COLUMN IF EXISTS "customQrUrl";
