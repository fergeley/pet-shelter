# Production's issued receipts are not append-only below the ORM

**Status:** open · opened 2026-09-16 · measured 2026-09-17 · awaiting a human decision

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

## Decide the 3 rows before installing the guard

PR #47's ledger (`production-schema-has-drifted-ahead-of-master.md`, unmerged as of writing)
reports that local e2e runs on 2026-09-14 wrote donations that **persisted to this branch**. If any
of the 3 is a test receipt, what happens to it comes first. Once the trigger is on, `DELETE` is
refused and the guard must be lifted to remove a row. Receipt numbering is gapless per month
(`ReceiptSequence`, `schema.prisma`), so deleting one leaves a hole in a statutory series. An
offsetting record, as the trigger file recommends, keeps the series whole. That is a bookkeeping
call, not an engineering one.

A human can tell without exporting personal data: e2e runs use `@example.test` addresses.

    SELECT "receiptNumber", "issuedAt", "donorEmail" LIKE '%@example.test' AS is_e2e
      FROM donations ORDER BY "issuedAt";

## Applying it, when decided

The file is idempotent re-creation, not additive: it runs `DROP TRIGGER IF EXISTS` before
`CREATE TRIGGER`. So it takes its own yes, and a human types it. `.claude/settings.json` denies
agents `npx prisma db execute*`. Either paste it into the Neon SQL Editor on the production branch,
or run it from the main checkout, where `.env.local` resolves to production as intended here:

    npx prisma db execute --file prisma/sql/donation_append_only.sql

Then re-run the trigger query. Expected: one row, `donations_no_mutation`, `O`.

    SELECT tgname, tgenabled FROM pg_trigger
     WHERE tgrelid = '"donations"'::regclass AND NOT tgisinternal;

No agent can run either query. On 2026-09-17 the auto-mode classifier refused an agent's
read-only probe as `[Production Reads]`, `BEGIN TRANSACTION READ ONLY` notwithstanding. Production
reads go through a human: the Neon SQL Editor, or `!` in the session.

**Settles when:** a human has decided what happens to any test receipts among the 3, and whether to
apply `donation_append_only.sql`. The decision is recorded in `tasks/decisions/`. If applied, the
trigger query's result is pasted there.
