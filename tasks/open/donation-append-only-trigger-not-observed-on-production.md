# Nobody has observed whether production's receipts are append-only below the ORM

**Status:** open · opened 2026-09-16 · found auditing the sponsor portal activation brief

`prisma/sql/donation_append_only.sql` installs `donations_no_mutation`, a `BEFORE UPDATE OR DELETE`
trigger that makes an issued receipt immutable to psql sessions, admin tools and future code, not
only to `donationLedger.ts`. The file calls itself **opt-in**: "Apply it where receipts are real."

Whenever `DATABASE_URL` is set, `/donate` writes a real `HFS-DON-…` receipt row, and has since
before 5b2672a: `src/actions/donations.ts` calls `issueDonationReceipt` at `a2f7cf1`, which
`general-donations-issue-receipts-before-payment-is-reconciled.md` calls the pre-existing
contract. 5b2672a (deployed 2026-09-14T16:51Z) added coordinator-issued receipts from
`/admin/donations`. So if production has a database, and whether it does is itself unobserved
(§A of `docs/tasks/TARGET_SPONSOR_PORTAL_PRODUCTION_ACTIVATION.md`), the gap predates this week.
No production receipt row has been observed.

Whether the trigger exists there is **unknown**, and the usual instrument cannot say.
`npm run db:check-drift` compares Prisma-visible objects only; a trigger or function is invisible
to it in both directions. The 2026-09-16 inventory
(`tasks/decisions/2026-09-16-sponsor-portal-activation-applies-nothing-to-production.md`) therefore
proves `donations` present and says nothing about its guard.

It could not ride along on an additive apply. The file runs `DROP TRIGGER IF EXISTS` before
`CREATE TRIGGER`: idempotent re-creation, not data loss, but it needs its own yes. Note that
`isDestructiveStatement` does **not** flag it (no `TRIGGER` pattern). The keyword test in the
decision entry above does. The trigger also blocks every future correction-by-update, which is
the intent ("issue an offsetting record instead") and a behaviour change for anyone used to fixing
a row by hand.

No agent-checkable trigger exists: reading `pg_trigger` on production needs a SQL session with the
production credential. `.claude/settings.json` denies agents `npx prisma db execute*`, and no npm
script runs an arbitrary read-only query. For a human, read-only:

    SELECT tgname, tgenabled FROM pg_trigger
     WHERE tgrelid = '"donations"'::regclass AND NOT tgisinternal;

Expected if applied: one row, `donations_no_mutation`, `O`.

**Settles when:** that query's result on the production branch is recorded here. If the trigger is
absent, a human decides whether to apply `donation_append_only.sql`, and the decision goes to
`tasks/decisions/`.
