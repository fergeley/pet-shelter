-- Enforces the append-only guarantee on `donations` below the ORM.
--
-- `src/lib/donationLedger.ts` exports no update or delete path, so the
-- application cannot mutate an issued receipt. This script closes the remaining
-- gap: a psql session, an admin tool, or a future contributor reaching for
-- `prisma.donation.update` directly.
--
-- OPT-IN. It is deliberately not applied by `npm run db:seed`, because it also
-- blocks the routine "wipe my local data and re-seed" loop, and surprising a
-- developer's local database is a poor trade for a guarantee that matters in
-- production. Apply it where receipts are real:
--
--     psql "$DATABASE_URL" -f prisma/sql/donation_append_only.sql
--
-- Corrections are issued as new offsetting rows, the way an accounting ledger
-- handles them — never by editing the original receipt.
--
-- To lift it (e.g. to reset a staging database), see the DROP statements at the
-- bottom of this file.

CREATE OR REPLACE FUNCTION donations_append_only() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION
    'donations is append-only: % is not permitted on receipt %. Issue an offsetting record instead.',
    TG_OP,
    COALESCE(OLD."receiptNumber", NEW."receiptNumber", '(unknown)');
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS donations_no_mutation ON donations;

CREATE TRIGGER donations_no_mutation
  BEFORE UPDATE OR DELETE ON donations
  FOR EACH ROW
  EXECUTE FUNCTION donations_append_only();

-- `receipt_sequences` is intentionally NOT covered. Its rows are updated on every
-- issuance by design — that update is the allocation. Its integrity comes from
-- being written only inside the same transaction as the insert it numbers, plus
-- the @@unique([sequenceScope, sequenceValue]) index on `donations`.

-- ---------------------------------------------------------------------------
-- To lift the guard:
--
--   DROP TRIGGER IF EXISTS donations_no_mutation ON donations;
--   DROP FUNCTION IF EXISTS donations_append_only();
--
-- `prisma db push --force-reset` drops the table outright and bypasses the
-- trigger, so it does not need the guard lifted first.
-- ---------------------------------------------------------------------------
