# Production's issued receipts are not append-only below the ORM

**Status:** open · opened 2026-09-16 · measured 2026-09-17 · decided 2026-09-18 · awaiting the
owner's two applies

`prisma/sql/donation_append_only.sql` installs `donations_no_mutation`, a `BEFORE UPDATE OR DELETE`
trigger that makes an issued receipt immutable to psql sessions, admin tools and future code, not
only to `donationLedger.ts`, which exports no update or delete path. The file calls itself
**opt-in**: "Apply it where receipts are real."

## Measured 2026-09-17 — the guard is not installed

A read-only probe, run by the human with `!` in the session. Every query ran inside
`BEGIN TRANSACTION READ ONLY` and was rolled back. Raw output:

    endpoint: ep-broad-band-b36iq50r-pooler
    read_only: [{"transaction_read_only":"on"}]
    donations triggers: []
    append-only function: []
    donations rows: [{"n":3}]
    pet_sponsorships by status: []

- **No `donations_no_mutation` trigger, no `donations_append_only()` function.** Production holds
  3 receipts that any SQL session can edit or delete.
- **That branch is what live visitors write to.** Vercel production's `DATABASE_URL` names
  `ep-broad-band-…` (the human checked the Vercel dashboard, 2026-09-16).
- **`pet_sponsorships` is empty,** so none of the 3 came through reconciliation.

`npm run db:check-drift` could never have found this. Prisma's diff does not see triggers or
functions.

## The 3 rows are e2e test receipts — decided 2026-09-18

The owner's read-only query in the Neon SQL editor returned `HFS-DON-202609-0001`, `0002` and
`0003`, all `is_e2e = true`. They are the local Playwright runs of 2026-09-14. The decision to
delete them and **keep the counter at 3** is
`tasks/decisions/2026-09-18-e2e-test-receipts-removed-counter-kept.md`. The first real September
receipt will be `0004`.

## What the owner applies, in this order

A human types both: `.claude/settings.json` denies agents `npx prisma db execute*`, and on
2026-09-17 the auto-mode classifier refused even an agent's `BEGIN TRANSACTION READ ONLY` probe as
`[Production Reads]`. Paste each file into the Neon SQL editor on the production branch.

1. `prisma/migrations/manual/20260918_remove_e2e_test_receipts/cleanup.sql`. It aborts, deleting
   nothing, unless the ledger is exactly the three test rows and the counter reads 3. It must run
   before step 2, because the trigger refuses the delete.
2. `prisma/sql/donation_append_only.sql`. It is idempotent re-creation (`DROP TRIGGER IF EXISTS`,
   then `CREATE TRIGGER`), not additive, so it takes this yes of its own.

Both were rehearsed together on a throwaway local PostgreSQL 18.4 on 2026-09-18. Results are in
the cleanup file's header and the decision entry.

## After, read-only

    SELECT count(*) FROM donations;                                  -- expect 0
    SELECT scope, "lastValue" FROM receipt_sequences;               -- expect HFS-DON-202609 | 3
    SELECT tgname, tgenabled FROM pg_trigger
     WHERE tgrelid = '"donations"'::regclass AND NOT tgisinternal;  -- expect donations_no_mutation | O

**Settles when:** the three results above are pasted here. Then this entry moves to `decisions/`,
naming the date both files were applied.
