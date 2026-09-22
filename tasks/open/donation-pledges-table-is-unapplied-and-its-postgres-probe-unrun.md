# The `donation_pledges` table is unapplied, and its PostgreSQL probe has never run

**Status:** open - opened 2026-09-22, on branch `worktree-donation-receipt-reconciliation-boundary`

`tasks/decisions/2026-09-22-general-gifts-become-pending-until-reconciled.md` moves general-gift
receipt issuance from form submission to staff reconciliation, on a new `donation_pledges` table.
Two things it needs are not done, and neither could be done from this session.

## 1. The migration is written and rehearsed nowhere

`prisma/migrations/manual/20260922_donation_pledges/migration.sql` creates one new table with two
unique indexes and two ordinary indexes. It is purely additive — it touches no existing object —
idempotent, advisory-locked in the same series as the FAQ and sponsorship migrations, and has a
`rollback.sql` beside it.

It has not been applied to any database, and it has not been executed against a PostgreSQL server
at all, because no server was reachable from this session (see §2). **Until it is applied, the
deployed application cannot record a general gift**: `recordDonationPledge` will fail against a
missing relation whenever `DATABASE_URL` is set, and the donor is told the outcome is unconfirmed.
The offline in-memory mode is unaffected.

`npm run db:push` must not be used to create it. Measured against the production branch on
2026-09-18, push still proposes two destructive statements unrelated to this change — see
`tasks/open/production-schema-has-drifted-ahead-of-master.md`. Apply the file itself, then
re-run `npm run db:check-drift` to confirm the table comes off the additive list.

## 2. Tier 3b was never executed for this change

`tests/integration/db/donationPledgeLedger.postgres.test.ts` is new in this branch and **has never
been run**. It typechecks and is modelled line-for-line on the proven
`sponsorshipLedger.postgres.test.ts` beside it, but a test that has not been executed is not
evidence, and this one is the only coverage of the properties that matter most here:

- the conditional `PENDING_PAYMENT` update serialising concurrent settlers on the row lock;
- the receipt serial rolling back with each loser's transaction, so a race leaves one receipt and
  one counter increment;
- the unique index on `donation_pledges.receiptNumber` as the backstop behind that guard;
- the queue's `ORDER BY createdAt, id` under the database's own collation.

The unit tier exercises the same state machine through the in-memory branch, which demonstrates
none of them.

It could not be run because Docker is not available on this machine:

    $ npm run db:up
    unable to get image 'postgres:16-alpine': failed to connect to the docker API at
    npipe:////./pipe/dockerDesktopLinuxEngine ... The system cannot find the file specified.

A PostgreSQL server was briefly listening on `localhost:5432` earlier in the same session and had
stopped before it could be used; that also explains a transient run in which 65 unit tests failed
against leftover rows, since `src/lib/server/prisma.ts` falls back to a hardcoded localhost URL
when `DATABASE_URL` is unset. The final unit run, with nothing listening, was fully green.

**Residual risk.** The Prisma branch of `donationPledgeLedger.ts` is unverified by execution. It
is a close mirror of `sponsorshipLedger.ts`, whose equivalent branch is covered, and the two files
cross-reference each other so the pair stays visibly a pair — but that is an argument from
similarity, not a measurement.

**This is not hypothetical.** A code review of the branch found one defect that only this tier
would have caught: `assertGiftRefString` ran inside `transitionPending`, which on the Postgres
path is inside `withReceiptTransaction`, whose catch-all rewrites every non-unique-violation as
`ReceiptIssuanceError`. A malformed reference therefore failed as a `TypeError` in memory mode and
as "we could not confirm whether reconciliation completed" against Postgres — an outage message
for a programming error. It is fixed (the assertion is hoisted above the mode branch) and now
guarded by `tests/unit/donationPledgeRefGuard.test.ts`, which mocks Prisma so it can assert the
persistent branch without a server. One divergence between the two branches was found by reading;
assume others are reachable only by running the tier.

## Settles when

Someone with a local PostgreSQL runs the probe green, and the owner applies the migration:

    npm run db:up
    npm run db:push:local && npm run db:seed:local
    npm run test:db
