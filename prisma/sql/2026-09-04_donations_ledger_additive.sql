-- Additive migration: Donation Ledger & Receipt Sequences (PR #18)
--
-- Created: 2026-09-04
-- Models: ReceiptSequence, Donation
--
-- Every statement below is additive and idempotent: re-running it is a no-op.
--
--     npx prisma db execute --file prisma/sql/2026-09-04_donations_ledger_additive.sql

BEGIN;

-- 1. Create receipt_sequences table
CREATE TABLE IF NOT EXISTS "receipt_sequences" (
    "scope"     TEXT NOT NULL,
    "lastValue" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "receipt_sequences_pkey" PRIMARY KEY ("scope")
);

-- 2. Create donations table
CREATE TABLE IF NOT EXISTS "donations" (
    "id"                    TEXT NOT NULL,
    "receiptNumber"         TEXT NOT NULL,
    "sequenceScope"         TEXT NOT NULL,
    "sequenceValue"         INTEGER NOT NULL,
    "donorName"             TEXT NOT NULL,
    "donorEmail"            TEXT NOT NULL,
    "donorPhone"            TEXT,
    "taxIdOrIc"             TEXT,
    "tierId"                TEXT NOT NULL,
    "tierName"              TEXT NOT NULL,
    "amountSen"             INTEGER NOT NULL,
    "currency"              TEXT NOT NULL DEFAULT 'MYR',
    "frequency"             TEXT NOT NULL DEFAULT 'one_time',
    "paymentMethod"         TEXT NOT NULL,
    "targetPetName"         TEXT,
    "notes"                 TEXT,
    "taxDeductibleRef"      TEXT NOT NULL,
    "shelterRegistrationNo" TEXT NOT NULL,
    "issuedAt"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "donations_receiptNumber_key"
    ON "donations"("receiptNumber");

CREATE UNIQUE INDEX IF NOT EXISTS "donations_sequenceScope_sequenceValue_key"
    ON "donations"("sequenceScope", "sequenceValue");

CREATE INDEX IF NOT EXISTS "donations_issuedAt_idx"
    ON "donations"("issuedAt");

CREATE INDEX IF NOT EXISTS "donations_donorEmail_idx"
    ON "donations"("donorEmail");

COMMIT;
