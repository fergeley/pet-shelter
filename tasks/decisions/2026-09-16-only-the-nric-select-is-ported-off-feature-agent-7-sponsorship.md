# Only the NRIC `select` is ported off `feature/agent-7-sponsorship`

**Decided:** 2026-09-16

This closes `tasks/open/agent-7-branch-duplicates-the-reconciliation-queue-master-already-has.md`,
an entry that only ever existed on `feature/agent-7-sponsorship` (last at `a2fc835`) and was
deliberately not carried to `master`. It is the place two dead paths resolve.
`2026-09-08-admin-sponsorship-reconciliation.md`, carried alongside this entry, ends by pointing
at that open entry and cites `open/reconciliation-mints-the-receipt-before-it-claims-the-pledge.md`,
which the branch deleted once
`2026-09-14-reconciliation-issues-the-receipt-inside-the-pledge-transaction.md` settled it. Neither
path exists on `master`, and the carried record is left as written.

## What was ported

The branch built the coordinator reconciliation queue three minutes after `6fd1435` built the same
thing, and PR #36 took `6fd1435` to `master`. By `5b2672a`, `master` had fixed three of the four
defects the branch's reviews found. The fourth was live: `listPendingSponsorships` ran `findMany`
with no `select`, so every pending supporter's `taxIdOrIc` — an NRIC or tax reference — was read
into server memory on each queue render. The DTO already dropped it, so this is defence in depth,
not a leak to the browser.

Ported: an explicit `select`, with `SponsorshipRow.taxIdOrIc` optional. Carried verbatim: the
branch's four process lessons and its decision record. Not ported: the screen, the action, the
read and their tests, all superseded.

Added, not ported: the in-memory branch now returns the same shape. `/code-review` found that
the fix as briefed left `listPendingSponsorships` returning the identifier whenever
`DATABASE_URL` is unset, a function whose shape depended on the mode. Memory mode already holds
every row in the process, so the privacy argument there is weak, but this module already keeps
its branches in step (see its ordering comment). The queue now returns a copy with the
identifier set to `undefined`, as `toRecord` does. It never deletes the identifier from the
stored pledge, which the receipt still needs.

## An allow-list, not `omit`

Prisma 7's `omit: { taxIdOrIc: true }` is one line where the `select` is eighteen. Declined because
a deny-list reads every column added after it, so the next sensitive column would land in server
memory without anyone choosing that. The allow-list fails closed, and the compiler holds the other
direction: `SponsorshipRow` requires every column `toRecord` maps, so a `select` missing one does
not build. Observed, not assumed — dropping `createdAt: true` fails `tsc` with TS2345 at
`rows.map(toRecord)`.

## Where the guard lives

The brief assumed the Prisma branch had never met a real Postgres. On `master` it had:
`tests/integration/db/sponsorshipLedger.postgres.test.ts` covers the queue, and CI's
"Strict persistence against Postgres" job runs it on every pull request. So the behavioural
assertion went there: store a pledge with an identifier, show the column holds it, list the queue,
find the identifier absent.

The branch's unit test was ported too, as the signal `npm test` gives with no database, with one
change. Its Prisma double returned a fixed row that had no `taxIdOrIc`, so its record-level
assertion could not fail whatever the query selected — see
`tasks/lessons/2026-09-11-an-experiment-whose-input-equals-its-control-can-only-pass.md`. The
double now honours `select` as Prisma does.

## Evidence

- **Before the fix,** both new cases failed with `expected '880101-14-5523' to be undefined`:
  unit `1 failed | 1 passed`; `test:db` on `embedded-postgres` 18.4, `1 failed | 26 passed`.
- **With the fix:** unit `2 passed`; `test:db` `27 passed (27)`, including the existing case that
  asserts a settled receipt still carries the identifier.
- **Mutation** — `taxIdOrIc: true` put back in the `select`: `test:db` `1 failed | 26 passed`,
  unit `1 failed | 1 passed`, the new case each time; reverted.
- **Memory branch, before its fix:** unit `1 failed | 2 passed`, the new in-memory case, with
  its control (the stored pledge holds the identifier) passing. After: `3 passed`. `test:db`
  was not rerun for this: it sets `DATABASE_URL`, so it never takes that branch, and the Prisma
  branch is unchanged since its 27-pass run.
- **Offline, Postgres stopped first, on the final code:** `npm run check` exit 0 (0 errors,
  14 warnings, none in changed files); `test:all` `1617 passed (1617)` in 103 files;
  `npm run build` exit 0 with throwaway secrets inline and no env file.

- **CI on PR #44:** all seven checks passed, including "Strict persistence against Postgres",
  which runs `test:db` on Postgres 17. The local run above was 18.4.

**Not verified:** nothing this change claims. Production, Neon, was not exercised and does not
need to be for a column projection.

## Not done, deliberately

- **`feature/agent-7-sponsorship` is not deleted.** Deleting a remote branch is a one-way door, and
  the human reserved it for after this merges. Once it is gone, `a2fc835` and the open entry are
  unreachable, and this entry and the carried decision are the only record.
- **No `tasks/todo.md` stream.** PR #38 edits that file, and a conflict there costs a pull request
  its CI run. This entry and the pull request body hold the review instead.
