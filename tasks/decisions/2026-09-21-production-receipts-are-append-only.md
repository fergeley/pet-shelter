# Production's receipts are append-only below the ORM

**Decided and applied:** 2026-09-21 · closes `tasks/open/production-receipts-are-not-append-only.md`
(opened 2026-09-16; its text is in `git log -- tasks/open/production-receipts-are-not-append-only.md`)

## What was wrong

`prisma/sql/donation_append_only.sql` has existed since 2026-09-04, deliberately opt-in: "Apply it
where receipts are real." Nobody had recorded applying it, and `npm run db:check-drift` cannot see
triggers, so the usual instrument said nothing either way.

A read-only probe on 2026-09-17, run by the owner because agents are refused production reads,
found no `donations_no_mutation` trigger and no `donations_append_only()` function, alongside
3 receipts and an empty `pet_sponsorships`. Any SQL session could have edited or deleted an issued
statutory receipt.

## What was done, in order

1. **The three receipts were removed** as e2e test rows, with the counter left at 3:
   `tasks/decisions/2026-09-18-e2e-test-receipts-removed-counter-kept.md` and
   `prisma/migrations/manual/20260918_remove_e2e_test_receipts/cleanup.sql`. Cleanup had to come
   first, because the trigger refuses `DELETE`.
2. **`prisma/sql/donation_append_only.sql` was applied** to the production branch in the Neon SQL
   editor.

Both by the owner. `.claude/settings.json` denies agents `npx prisma db execute*`, and the
auto-mode classifier refuses agent production reads, so an agent rehearsed and prepared while the
owner typed.

## Verified on production, 2026-09-21

    Deleted 3 e2e test receipts. Counter left at 3: the next receipt is HFS-DON-202609-0004.
    Trigger "donations_no_mutation" for relation "donations" does not exist, skipping
    [{ "scope": "HFS-DON-202609", "lastValue": 3 }]
    [{ "tgname": "donations_no_mutation", "tgenabled": "O" }]

- The cleanup's notice fires only after deleting exactly 3 rows, having first established the
  ledger held exactly 3. So `donations` is empty.
- The second notice is the file's `DROP TRIGGER IF EXISTS` finding nothing, which is what a first
  install prints. On its own it proves nothing; the `pg_trigger` row is what settles it.
- `donations_no_mutation` exists and is enabled (`O` = enabled, origin). `CREATE TRIGGER` requires
  its function, so `donations_append_only()` exists too. That was not queried separately.

## Consequences

- An issued receipt cannot be updated or deleted by any session, including a future contributor
  reaching for `prisma.donation.update`. Corrections must be new offsetting records — which no
  code path issues yet, so the first correction needs that built or the guard lifted deliberately.
- Removing a row now means dropping the trigger first. The file's footer carries both statements.
- `prisma db push --force-reset` still drops the table outright and bypasses the trigger, as the
  file says. That is unrelated to this decision and remains guarded by the drift check.

## What would reverse this

    DROP TRIGGER IF EXISTS donations_no_mutation ON donations;
    DROP FUNCTION IF EXISTS donations_append_only();

Reasonable for a staging branch reset. On production it would need its own decision.
