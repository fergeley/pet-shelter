# Deleting an adoption application from the admin table does not remove the row

**Status:** open · opened 2026-09-03 · measured, not inferred

`e2e/specs/04_admin_application_review.spec.ts:93` — "clears applications left behind by the
public adoption spec" — clicks the archive/delete control, confirms "Yes, remove record", and
asserts the row count drops. It does not:

    Error: expect(locator).toHaveCount(expected) failed
    Expected: 0
    Received: 1
    24 × locator resolved to 1 element

Reproduced identically on three consecutive CI runs (`bdfc4cc`, `26f0bf3`, `5367676`), with
both retries failing, so it is deterministic rather than flaky. Everything else in the suite
passes: **22 passed, 1 failed**.

## Why nobody saw it before 2026-09-03

The `Playwright golden paths` job had never completed a run. It died at "Apply the schema"
on `prisma db push --skip-generate`, a flag Prisma 7 removed. The first time these specs
executed, this failed — see
`tasks/decisions/2026-09-03-donation-ledger-verified-on-postgres.md` for the full stack of
CI defects that hid it.

## What has been ruled out

- **Not RBAC.** `deleteApplication` requires `ROLES.ADMIN`; `e2e/fixtures/authFixture.ts`
  seals `ADMIN_USER` by default and the `adminPage` fixture uses it.
- **Not the sponsorship branch.** The spec covers adoption applications, a path that branch
  does not touch, and `02_rescue_sponsorship_receipt.spec.ts` passes in the same run.
- **Not a missing seed.** The e2e job has always run `db:seed`.

## Still open

Whether the server action fails silently, or succeeds while the client table keeps the row.
`deleteApplication` calls `revalidatePath("/admin/applications")` inside a try/catch that
swallows, and `ApplicationDataTable` holds its own state, so a successful delete that never
reaches the rendered list is the leading hypothesis. A `Hydration failed because the server
rendered text didn't match the client` error appears in the same log and may or may not be
related.

Not diagnosed further here because it cannot be reproduced on the maintainer's machine:
Docker will not start (WSL broken), so there is no local Postgres to run the golden paths
against, and a blind fix to an assertion that has never passed would be a guess dressed as a
repair.

**Settles when:** the delete is traced to either the action or the table, fixed, and
`04_admin_application_review.spec.ts` passes in CI — or the spec is shown to be asserting
something the product deliberately does not do (e.g. archive-not-delete), and is corrected.
