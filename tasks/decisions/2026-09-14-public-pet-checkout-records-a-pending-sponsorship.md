# Public pet checkout records a pending sponsorship, not a donation receipt

**Decided:** 2026-09-14 - branch `codex/sponsorship-contract`, cut from
`origin/master` at `690a09c`, integrated with the closed atomic-reconciliation
branch through `435b7ec`, and selectively reconciled with its later committed
hardening at source commit `7febde6`.

## What the plan got wrong

The supplied plan was based on an older repository state. `origin/master` already
had the coordinator queue at `/admin/donations`, its navigation entry, the
`RECONCILE_SPONSORSHIPS` permission, pending-list and reconcile actions, the DTO,
FIFO tests, and failure-aware loading. Adding `/admin/sponsorships`, another queue
hook, and another pending action would have created a second workflow over the
same mutable commitments.

Several proposed details would also have regressed the merged contract:

- `result.data ?? []` would have rendered a repository or authorization failure
  as a trustworthy empty queue;
- newest-first sorting would have replaced the queue's oldest-first coordinator
  order, and a timestamp without an `id` tiebreak would not be total;
- `revalidateTag("sponsorship-summary")` had no tagged reader, and Next.js 16.3.1
  requires a cache-life profile for `revalidateTag`;
- the proposed pending DTO exposed supporter fields the queue did not need; and
- a discriminated race result after issuing a receipt would have described the
  orphan-receipt race without preventing it.

The remaining live defect was on the other end of the workflow: every public
pet-specific checkout still called `submitDonationPledgeAction`. It therefore
issued a `Donation` receipt immediately and never created the
`PENDING_PAYMENT` `PetSponsorship` the existing queue reads.

## The decision

Keep the shared modal, but make its controller result explicit:

- with `targetPet`, validate the RM10 sponsorship floor, call
  `createPetSponsorshipAction`, and render only the returned `HFS-PLG-*`
  reference and pending-verification instructions;
- without `targetPet`, preserve the RM5 general-donation action and its returned
  `HFS-DON-*` receipt;
- store only the donation-receipt result in the client receipt store;
- submit the payment rail selected by the supporter and show only that rail's
  instructions;
- collect tax identity only after an explicit opt-in, and show statutory relief
  only when the issued receipt satisfies the existing `isTaxClaimable` boundary;
- remount the stateful checkout on close/reopen or animal change so a prior
  supporter's result and personal fields cannot reappear; and
- make the pending acknowledgement and welcome email tax-neutral. Reconciliation,
  not a pledge, is the receipt/perk boundary.

The public action also no longer accepts account ownership from its input. A
pledge is linked only when a signed sponsor cookie, a live repository account,
and the submitted normalized email all agree; missing, stale, deleted, or
mismatched identities remain guest pledges. Repository lookup failure fails the
submission safely instead of silently downgrading it. Checkout wall consent now
crosses the persistent Prisma write rather than falling back to the database
default.

Failure copy follows the same evidence rule. A database error does not prove
rollback when the commit acknowledgement itself may have been lost, and a browser
that lost the response knows even less. Both therefore say that the ledger outcome
is unconfirmed, never that no record exists or no money moved. DuitNow and direct
bank rails are outside the application transaction, so anyone who may already have
transferred is directed to contact the shelter with the bank reference before
retrying.

## Atomic reconciliation integrated after coordination

Claude session `159d04c3-867b-4f09-8134-9e8d41f7ef01` claimed the donation and
sponsorship ledgers, reconciliation actions, queue UI, and database tests while
this branch claimed the disjoint public controller/modal slice. The two sessions
recorded and acknowledged the boundary in their claim files. After that session
committed its work and deleted its claim, this branch cherry-picked its four
commits in order:

1. `b750332` - expose the receipt transaction;
2. `3e83114` - guard, draw, and settle the pledge in that transaction;
3. `6a70c59` - let coordinators dismiss an unpaid pledge; and
4. `435b7ec` - record and close the backend decision.

That Claude session later resumed the same paths without reopening a claim. It
committed `7febde6`, then reached its weekly limit with ten additional files dirty.
The worktree and its uncommitted state were left untouched. This branch imported
only the committed hardening, resolved its conflicts against the already-tested
atomic dismissal and uncertainty behavior, then manually ported only corrections
backed by red tests. The combined contract was rerun against PostgreSQL rather than
assuming either session's version won.

The old `feature/agent-7-sponsorship` branch was not integrated: it overlaps the
same action and ledger and its own task records that master superseded it. The
atomic branch missed the agreed external-transfer copy correction in
`createPetSponsorshipAction`; only after its claim closed did this branch add a
red action-boundary test and replace that message with the shared safe copy.

A final contract review then found that dismissal changed the pledge before a
best-effort audit write. Because that audit row is the only durable actor/reason
record, the transition and audit now run in one Prisma transaction. The guarded
update returns its winning row directly; only a zero-row loser performs a
classification read. An audit insert failure rolls the cancellation back, and
the action reports an unconfirmed outcome when the commit acknowledgement is
uncertain. The same review removed unobserved email-delivery promises, stopped
calling identifier-free receipts tax-exempt, rejected non-string dismissal
reasons before mutation, and reduced Zod failures to their first donor-facing
message. A later independent pass also preserved the fresh-versus-race outcome
through the UI, added one-row queue lookahead, retained failed dismissal input,
restricted arbitrary receipt attachment to offline demo mode, and moved all
contribution email sends onto Next's existing `after()` lifecycle scheduler.
The final adversarial pass also closed four public-boundary defects before
commit: required names are trimmed before their minimum-length checks; amounts
must be representable as whole sen; a disappearing optional pet or sponsor
foreign key is re-resolved without discarding the still-valid relation; and a
submitted pet id is resolved through the authoritative pet repository so a
forged or stale name cannot reach the queue or receipt. The same pass proved the
general donation action would accept the unimplemented `card` rail and issue an
official receipt, so that rail is now refused before rate limiting or persistence.

## Evidence

- The first target-pet component probe failed against unchanged `origin/master`:
  the donation action was called and `createPetSponsorshipAction` had zero calls.
- Six external-transfer probes failed on the old copy across target/general
  structured and thrown failures; the server-action probe independently failed
  on `SponsorshipWriteError`. The same seven probes pass after the correction.
- Focused contract runs passed 89 unit assertions and all 8 reconciliation
  component assertions after the final hardening. The dedicated lifecycle suite
  first failed 4 of 6 tests against floating promises, then passed all 6 once the
  actions registered the persisted DTO callbacks through `scheduleAfterResponse`.
- `npm run test:db` against throwaway local PostgreSQL 18.4: 3 files and 26 tests
  passed. They cover four-way settlement, concurrent dismissal, durable audit
  pairing, rollback when PostgreSQL rejects the audit insert, persistent
  `displayOnWall` round-trip, and refusal of the offline arbitrary-receipt helper.
  The schema was generated read-only with `prisma migrate diff --from-empty` and
  executed only against the explicit localhost URL; no hosted Neon URL was read.
  After stop, port 5432 was free and the non-persistent database directory was
  removed.
- After the final boundary fixes, `DATABASE_URL="" RESEND_API_KEY="" npm run
  test:all`: 102 files and 1,614 tests passed with the local database stopped.
- Focused boundary probes passed 68 assertions, including whitespace-only names,
  fractional-sen input, a forged pet-name/id pair, unsupported card payment, and
  an account-deletion foreign-key race whose retry preserves the valid pet link.
- `npm run check`: TypeScript passed, ESLint reported 0 errors and 14 pre-existing
  warnings, and documentation invariants passed. `npm run arch:check` passed.
- The design-system guard suite passed 20 tests, and independent UI review found
  no remaining finding after the payment-source and accessibility corrections.
- `npm run build` compiled and finished TypeScript, then stopped during page-data
  collection because this isolated worktree has no `SESSION_SECRET`. No fake or
  production secret was supplied to bypass that configuration gate.
- During lifecycle-test isolation, a Windows junction was followed while removing
  a disposable worktree and emptied this branch's shared `node_modules`. No tracked
  or product file changed. `npm ci` restored 856 locked packages and regenerated
  Prisma; the 1,607-test full run, checks, and build attempt above all happened
  after that restoration.

## Consequences and remaining boundary

The public animal flow now reaches the existing pending queue, while the general
donation flow keeps its issued-receipt behavior. A coordinator race cannot mint
an unattached receipt, and an unpaid claim can leave the queue without abusing
supporter notes or issuing a receipt. Its cancellation cannot commit without
the sole durable actor/reason audit record.

No production database, email service, browser session, migration, or deployment
was touched. This does not activate the production portal by itself: the
repository's existing migration/production-configuration task remains the source
of truth for that separate one-way-door work. The pooled Neon endpoint and CI's
Postgres container were not exercised here.

Two release boundaries remain explicit:

- `scheduleAfterResponse` gives email work request-lifecycle ownership, not a
  durable outbox. It cannot guarantee retry or delivery after process loss or the
  route's maximum duration.
- `src/lib/domain/shelterIdentity.ts` still contains two conflicting ROS
  registration values. The physical certificate must establish which is correct
  before this work can be described as production-ready for statutory receipt
  issuance. This branch deliberately did not guess.
- The general donation path still issues a receipt from a supporter's assertion
  that a DuitNow or direct-bank transfer was made; it does not reconcile a bank
  statement first. The supplied plan explicitly required preserving that
  immediate-receipt contract, so converting general gifts to a pending-payment
  workflow is recorded as a separate open design rather than silently expanding
  this branch. The unsupported card rail is refused now.

Related: [[2026-09-14-reconciliation-issues-the-receipt-inside-the-pledge-transaction]],
[[2026-09-08-reconciliation-screen-closes-the-sponsor-portal]],
[[2026-09-08-a-receipt-asserts-relief-only-when-it-can-back-it]].
