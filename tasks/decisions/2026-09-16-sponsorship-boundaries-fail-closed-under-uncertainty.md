# Sponsorship boundaries fail closed on malformed filters, suspended staff, and uncertain receipts

**Decided:** 2026-09-16 · branch `codex/sponsorship-boundary-followup`, cut from and refreshed to
`origin/master` at `446f3d6` after PR #44

## Context

The superseded reconciliation worktree contained a mixture of code already merged to master and a
few unmerged ideas. Replaying that tail would have overwritten newer atomic-receipt and privacy
work. A comparison against master reduced the remaining work to four boundaries:

1. `transitionPending` rejected a runtime pledge-reference object before it reached Prisma, but
   `cancelSponsorshipForUser` constructed a second Prisma filter without the same assertion.
2. The statutory receipt export already re-read live member state, but no export-boundary test
   proved that a suspended administrator's still-valid cookie was refused before donor PII was
   read.
3. Receipt settlement already distinguished a different actor's committed receipt from a
   same-actor result after a lost acknowledgement, but that distinction had no deterministic test.
4. The admin donations page declared 30 seconds even though `withReceiptTransaction` permits one
   retry and each attempt can spend 5 seconds acquiring plus 15 seconds executing a transaction.

The privacy work overlapped the sponsorship ledger, so implementation waited. PR #44 was reviewed,
passed all seven exact-head checks, and merged as `446f3d6` before this branch moved.

## Decision

### Assert the exact reference at each Prisma mutation boundary

A private `assertPledgeRefString` now runs in both `transitionPending` and
`cancelSponsorshipForUser`. TypeScript's `string` annotation does not constrain a value that arrives
from JavaScript or a deserialised RPC call, while Prisma's string field input also accepts filter
objects. `{ not: "" }` therefore has broader meaning than the exact-reference contract promised by
these functions.

The product action already validates with `pledgeRefSchema`, so this is defence in depth at the
repository boundary rather than evidence of a currently reachable public exploit. The direct
ledger guard still matters: exported server functions acquire callers over time, and the layer that
constructs the database filter is the last place that can guarantee its shape.

The assertion is deliberately local. It does not redesign transition ownership, change valid
caller outcomes, or add a generic validation framework.

### Re-read authorization before the statutory export touches the ledger

`fetchDonationReceiptsAction` continues to use `getVerifiedSession`, not cookie-only
`getCurrentSession`. A signed cookie proves what the member was allowed to do when it was issued;
the database row decides whether that member is still active now. Authorization remains before
`listDonationsOrThrow`, because refusing a response after tax identifiers were queried would not
protect those identifiers.

The new integration test uses two explicit test doubles: the member repository returns a
`SUSPENDED` live row for a genuinely signed admin cookie, and the donation ledger records whether
it was called. Replacing `getVerifiedSession` with `getCurrentSession` made the test fail because the
ledger was read, proving the ordering rather than merely asserting an error message.

### Treat same-actor post-error evidence as uncertain

After `ReceiptIssuanceError`, `settleSponsorship` re-reads only `receiptNumber` and `reconciledBy`.
A receipt written by a different actor proves this attempt lost a race and can be classified as
`already_reconciled`. A receipt attributed to the same actor proves only that *some* request by that
actor committed. It cannot distinguish this request's lost commit acknowledgement from another
tab or retry by the same coordinator.

Therefore same actor, no receipt, and a failed recovery read all rethrow the original uncertainty.
Automatic same-actor recovery would require an operation id persisted with the row; inferring it
from email would risk reporting success even though this request's audit/email continuation never
ran. The behavior is unchanged, but deterministic tests now cover all four classifications.

### Budget for the retry the ledger actually permits

The admin donations page raises `maxDuration` from 30 to 60 seconds. The transaction helper's
theoretical ceiling is 40 seconds: two attempts, each with `maxWait: 5_000` and `timeout: 15_000`.
The remaining 20 seconds is headroom for live authorization, the post-error recovery read,
rendering, and best-effort `after()` receipt-email work. Those operations have no separate latency
bound, so this is headroom rather than a proof that every worst-case request completes.

This does not make `after()` durable delivery. Bundled Next.js 16.3.1 documentation states that a
page-level `maxDuration` applies to its Server Actions and that `after()` runs within the route's
configured duration. The deployment platform supports a 60-second function duration. The Prisma
limits stay unchanged because no latency evidence supports tightening them.

## Evidence

- Refreshed-master baseline before the tests: **3 files, 40 tests passed**.
- The cancellation test was red before the guard: the malformed object resolved `null` instead of
  rejecting, and Prisma's `updateMany` was reached. It is green after the shared assertion.
- Removing the `reconciledBy !== reconciledBy` distinction made the same-actor uncertainty test
  resolve `already_reconciled` and fail.
- Making a failed/no-receipt recovery read invent a receipt made both fail-closed tests fail.
- Replacing live authorization with cookie-only authorization made the suspended-admin export test
  call `listDonationsOrThrow(1001)` and fail.
- After restoring those three deliberate mutants and applying the product change: **3 files,
  46 tests passed**.
- `npm run check`: TypeScript and documentation checks passed; ESLint reported 0 errors and 14
  pre-existing warnings.
- `npm run test:all`: **103 files, 1623 tests passed**.
- `npx --no-install next build --webpack`, with explicit throwaway build-only secrets: production
  compilation, TypeScript, all 38 static pages, and trace collection completed with exit 0. The
  default Turbopack command could not run in this isolated worktree because its `node_modules`
  junction points outside Turbopack's filesystem root; normal PR CI remains the exact-path gate.

The mutants were temporary experiments in the isolated worktree and are not part of the diff.

## Deliberately not changed

- No schema, migration, production data, receipt numbering, or reconciliation outcome changed.
- No automatic same-actor recovery or durable email outbox was added.
- PR #44's pending-queue projection was not redesigned. Its review noted that the queue could
  eventually select fewer non-NRIC fields and use a queue-specific row type; those are independent
  low-priority refinements, not requirements of this boundary fix.
- The 2026-09-14 and 2026-09-16 decisions remain immutable; this entry records the later choice.

Related: [[2026-09-14-reconciliation-issues-the-receipt-inside-the-pledge-transaction]],
[[2026-09-14-public-pet-checkout-records-a-pending-sponsorship]],
[[2026-09-16-only-the-nric-select-is-ported-off-feature-agent-7-sponsorship]].
