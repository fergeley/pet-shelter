-- Remove the three e2e test receipts from production, keeping the receipt counter where it is.
--
-- Why: on 2026-09-14 three local `npx playwright test` runs wrote RM30 donations to the
-- production branch, because playwright.config.ts loaded .env.local
-- (tasks/decisions/2026-09-16-local-e2e-cannot-reach-a-remote-database.md). They hold the real
-- receipt numbers HFS-DON-202609-0001 to 0003, for e2e-*@example.test donors who gave nothing.
-- A statutory ledger must not carry receipts for money that never moved.
--
-- Why the counter is NOT reset: every receipt also wrote a DONATION_RECEIVED audit row whose
-- entityId is the receipt number (src/actions/donations.ts). Resetting would issue 0001 again
-- to a real donor, and the audit log would then name two different donations under one number.
-- Leaving receipt_sequences at 3 makes the first real September receipt HFS-DON-202609-0004,
-- and no number is ever issued twice. The 0001–0003 gap is explained by those audit rows and by
-- tasks/decisions/2026-09-18-e2e-test-receipts-removed-counter-kept.md.
--
-- Safety:
--   * One statement, one DO block, so it is all-or-nothing in any SQL editor mode.
--   * Aborts, deleting nothing, unless ALL of these hold: exactly these 3 receipts exist, all
--     for @example.test donors; no other receipt exists; September's counter stands at 3.
--     A real donation arriving first makes it abort; re-run it only after re-checking.
--   * Holds September's counter row FOR UPDATE, so no receipt can be issued mid-run. Gives up
--     after 5 s rather than stalling live checkouts if something else holds it.
--   * Aborts if the append-only trigger (prisma/sql/donation_append_only.sql) is already
--     installed, because the trigger refuses the DELETE. Apply that file AFTER this one.
--   * Names every table with its schema, so it does not depend on search_path.
--   * Audit rows are deliberately left alone: they are the record that these receipts existed.
--
-- Apply: take the "before" check, paste this whole file into the Neon SQL editor for the
-- production branch, run the "after" check, then apply prisma/sql/donation_append_only.sql.
--
-- Before (expect 3 rows, all is_e2e = true; and the counter at 3):
--
--   SELECT "receiptNumber", "donorEmail" LIKE '%@example.test' AS is_e2e FROM public.donations;
--   SELECT scope, "lastValue" FROM public.receipt_sequences;
--
-- After: the first query returns no rows, and the counter still reads HFS-DON-202609 | 3.
--
-- Rehearsed 2026-09-18 on a throwaway local PostgreSQL 18.4 (embedded-postgres), with the
-- tables built from prisma/sql/2026-09-04_donations_ledger_additive.sql:
--   * the production case deletes 3 and leaves the counter at 3; a re-run then aborts;
--   * with the trigger applied afterwards, the next allocation is HFS-DON-202609-0004, and
--     the trigger blocks UPDATE and DELETE on it;
--   * five abort cases each delete nothing: a real receipt already issued, one of the three
--     belonging to a real donor, the counter moved, the trigger already installed, and the
--     counter row locked by another transaction (gave up after about 5 s).
-- Production's PostgreSQL version was not checked; the block uses nothing newer than 9.x.

DO $$
DECLARE
    e2e_receipts CONSTANT text[] := ARRAY[
        'HFS-DON-202609-0001', 'HFS-DON-202609-0002', 'HFS-DON-202609-0003'
    ];
    counter_value integer;
    total_receipts integer;
    matching_receipts integer;
    deleted_receipts integer;
BEGIN
    PERFORM set_config('lock_timeout', '5s', true);

    -- Hold September's counter so no receipt can be issued while this runs.
    SELECT "lastValue" INTO counter_value
      FROM public.receipt_sequences
     WHERE scope = 'HFS-DON-202609'
       FOR UPDATE;

    SELECT count(*) INTO total_receipts FROM public.donations;

    SELECT count(*) INTO matching_receipts
      FROM public.donations
     WHERE "receiptNumber" = ANY (e2e_receipts)
       AND "donorEmail" LIKE '%@example.test';

    IF matching_receipts <> 3 THEN
        RAISE EXCEPTION 'Nothing deleted: expected the 3 e2e test receipts, found %.',
            matching_receipts;
    END IF;
    IF total_receipts <> 3 THEN
        RAISE EXCEPTION 'Nothing deleted: expected no other receipts, found % in total.',
            total_receipts;
    END IF;
    IF counter_value IS DISTINCT FROM 3 THEN
        RAISE EXCEPTION 'Nothing deleted: expected the HFS-DON-202609 counter at 3, found %.',
            counter_value;
    END IF;

    DELETE FROM public.donations
     WHERE "receiptNumber" = ANY (e2e_receipts)
       AND "donorEmail" LIKE '%@example.test';
    GET DIAGNOSTICS deleted_receipts = ROW_COUNT;

    IF deleted_receipts <> 3 THEN
        RAISE EXCEPTION 'Rolled back: deleted % rows instead of 3.', deleted_receipts;
    END IF;

    RAISE NOTICE 'Deleted 3 e2e test receipts. Counter left at 3: the next receipt is HFS-DON-202609-0004.';
END
$$;
