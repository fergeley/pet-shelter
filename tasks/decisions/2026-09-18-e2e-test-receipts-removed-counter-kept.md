# The e2e test receipts are removed, and the receipt counter is not reset

**Decided:** 2026-09-18 · applied by the owner 2026-09-21, verified in
`tasks/decisions/2026-09-21-production-receipts-are-append-only.md`

## Context

Production's `donations` held three rows, `HFS-DON-202609-0001` to `0003`, issued 2026-09-14 13:35,
15:41 and 16:01. The owner ran this read-only query in the Neon SQL editor on 2026-09-18:

    SELECT "receiptNumber", "issuedAt", "donorEmail" LIKE '%@example.test' AS is_e2e
      FROM donations ORDER BY "issuedAt";

All three returned `is_e2e = true`. They are the three RM30 donations that local Playwright runs
wrote to production (`tasks/decisions/2026-09-16-local-e2e-cannot-reach-a-remote-database.md`). No
money moved; the donors are `e2e-*@example.test`.

The append-only trigger (`prisma/sql/donation_append_only.sql`) was about to be installed. Once it
is, removing them means lifting it first. So this was decided before the trigger.

## Decision

Delete the three rows with
`prisma/migrations/manual/20260918_remove_e2e_test_receipts/cleanup.sql`. **Leave
`receipt_sequences` at 3**, so the first real September receipt is `HFS-DON-202609-0004`. Leave
their `audit_logs` rows untouched.

## Why

- **Not kept.** A statutory ledger carrying receipts for money that never moved would flow into
  the LHDN receipts export, which reads the ledger (`fetchDonationReceiptsAction` in
  `src/actions/donations.ts`).
- **Not an offsetting record.** `donationLedger.ts` states that corrections are offsetting
  records, but no code path issues one. Hand-writing negative receipts for money that never
  arrived would add two false documents to remove one.
- **Counter not reset, although that was recommended first.** It was proposed because it leaves
  no gap. Before anything ran, it turned out every receipt also writes a `DONATION_RECEIVED`
  audit row with `entityId` = the receipt number (`src/actions/donations.ts`). A reset would issue
  `0001` again to a real donor, and the audit log would name two different donations under one
  number. A gap at the start of one month's series is explainable by this entry and those audit
  rows. A number used twice is not.
- **Audit rows kept.** They are the record that the three receipts existed and why the series
  starts at 0004.

## How it was made safe

One `DO` block, all-or-nothing in any editor mode. It aborts, deleting nothing, unless: exactly
those three receipts exist, all `@example.test`; no other receipt exists; and the counter reads 3.
It holds the counter row `FOR UPDATE` with a 5 s lock timeout. Rehearsed on a throwaway local
PostgreSQL 18.4, all as intended:

- **Production case:** deletes 3, counter stays 3. A re-run aborts. With the trigger applied, the
  next allocation is `0004`, and `UPDATE` and `DELETE` on it are blocked.
- **Five abort cases, each deleting nothing:** a real receipt already issued, one row belonging to
  a real donor, the counter moved, the trigger already installed, and the counter row locked.

## What would reverse this

Nothing restores the rows; they were test data. If an auditor objects to the gap, it is explained
here and by the three 2026-09-14 `DONATION_RECEIVED` audit rows, whose `actorEmail` is an
`@example.test` donor and whose `entityId` is the receipt number.
