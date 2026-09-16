# Reconciliation issues the receipt inside the pledge transaction, and the queue can dismiss

**Decided:** 2026-09-14 · branch `worktree-sponsorship-reconciliation-atomic`, cut from
`origin/master` at `690a09c` (PR #36)

Closes §1, §3 and §4 of `tasks/open/donation-form-and-admin-denials-have-loose-ends.md` and the
"spare needs an offsetting correction" outcome in `reconcilePetSponsorshipAction`. The frame,
assumption stack, kill conditions, build gate and review findings lived in
`tasks/open/CLAIM-sponsorship-reconciliation-atomic.md` on this branch; it is deleted at close as
the ledger contract requires, and survives in the branch's history.

## What was wrong

`reconcilePetSponsorshipAction` read the pledge, issued the receipt through
`issueDonationReceipt`, and only *then* ran the conditional `PENDING_PAYMENT → ACTIVE` update. Two
coordinators confirming at once each passed the read, each drew a serial, and the loser's receipt
stayed in `donations` attached to nothing — logged as needing an offsetting correction that nobody
was ever going to make. Reproduced in memory mode before anything changed, with a `Promise.all` of
two calls to the unchanged action:

    [Sponsorship Reconciliation] Lost a race on HFS-PLG-000020: receipt HFS-DON-202609-0002 was issued but HFS-DON-202609-0001 is already attached. The spare needs an offsetting correction.
    AssertionError: expected [ 'HFS-DON-202609-0002', …(1) ] to deeply equal [ 'HFS-DON-202609-0001' ]

Three smaller defects sat beside it. There was no way to dismiss an unpaid pledge, so a bogus claim
sat in front of every coordinator every day. `listPendingSponsorshipsAction` threw on denial, which
a production build masks into an opaque digest, so the page could not tell a denial from an outage.
And the queue's Postgres reader had never run against Postgres.

## The decision

The donation ledger exposes the two halves of what `issueDonationReceipt` already did:
`withReceiptTransaction(work)`, which owns the transaction, the one retry on a counter-create
collision and the `ReceiptIssuanceError` contract, and `drawAndInsert(tx, draft, when)`, which owns
the draw. `issueDonationReceipt` is the one composed with the other. The sponsorship ledger's
`settleSponsorship` runs **guard first, draw second, write third** inside one
`withReceiptTransaction`: the conditional `PENDING_PAYMENT → ACTIVE` update takes the row lock, a
loser sees zero rows and has written nothing, and only the winner reaches the receipt series. The
action calls that and nothing else numbers receipts. No schema changed.

**What the review changed.** The first build drew the serial first and ran the guard as an
"attach step" inside the same transaction, throwing to roll the draw back on a lost race. It
worked — the spike below measured it — but it needed two exception-as-control-flow classes, a
memory-mode promise queue with snapshot/restore, and an unstated rule that the step must not touch
other stores before it can throw. `/code-review high` pointed out that under READ COMMITTED the
guard can simply run first, which is equally atomic and deletes all of that. It is right, and the
decision entry's own admission that draw-first was "a mechanism, not a requirement" cut the other
way. Rebuilt; the observable outcomes are unchanged and re-measured below.

**What the second review changed.** The rebuilt diff was reviewed again, and four of its ten
findings were correctness. The pledge reference reached Prisma's `updateMany` unvalidated, and a
crafted object argument would have matched every pending row. All three actions guarded on the
cookie alone, so a coordinator suspended in /admin/members kept issuing receipts until it expired.
The dismiss path wrote and read back in two statements with the audit row inside the same `try`,
so a failure after the flip lost the audit row and said "still pending". And `settledOutcome` keyed
on status rather than on the receipt, hiding an existing receipt behind a supporter's later
withdrawal. All four are fixed: `pledgeRefSchema` and `rejectionReasonSchema` at the action
boundary, with a `typeof` guard at the one write choke point; `requirePermission` from the DAL on
all three actions; the transition and its read-back in one transaction, the audit write outside
the `try`; and the receipt as the discriminator. The other six were acted on too. The
unique-violation retry is scoped by `meta.modelName`, which Prisma was measured to report, so a
collision on `PetSponsorship.receiptNumber` no longer retries into the same serial. The receipt
transaction carries explicit `maxWait`/`timeout`, and a loser that times out on the winner's row
lock re-reads the row before claiming "still pending". The settle failure is logged. The in-flight
labels render, because the row's second step stays mounted until `finally`. The transition takes
one column set instead of two. And the reason limit lives in the validations module both sides
import, refusing over-length input rather than truncating it.

**Why the offline draw is synchronous.** `issueReceiptInMemory` returns a record, not a promise,
and refuses to run when a database is configured. In a single-threaded process the memory branch
of `settleSponsorship` is atomic only if its guard, draw and write happen with no `await` between
them; an async draw would hand a concurrent caller a window between the guard and the draw, which
is the race this whole entry exists to close.

**Why reconcile and reject share one transition.** `reconcileSponsorship` (a number issued
elsewhere — the offline demo seed) and `rejectPendingSponsorship` were the same nine lines with the
target state swapped, and the copies had already begun to diverge. Both now go through a private
`transitionPending`, guarded on the source state in both storage modes, and both report a row that
has already left the queue in the same vocabulary — `already_reconciled` with the number, or
`not_pending` with the state — so the action does not reconstruct one from the other. The memory
branch used to reconcile a `CANCELLED` pledge that Postgres refused; that gap closed with the
dismiss path, because it would have become a real disagreement.

**Why rejection writes to the audit log and not to `notes`.** The spec put "Rejected by <email>:
<reason>" into `PetSponsorship.notes`. `notes` is the supporter's own checkout text and is copied
onto the receipt (`receiptDraftFor`), so a coordinator's reason and address would have printed on
a statutory document if the row were ever reconciled — and would have been the wrong record even
if not. The row records `CANCELLED` and `cancelledAt`; the audit row `SPONSORSHIP_REJECTED` records
who and why. The reason is normalised *before* the write: Server Action arguments arrive
deserialised and unchecked, and a `reason` that is not a string must fail before the row flips,
not after it, or the pledge is cancelled with no audit row and a message saying it is still pending.

**Why `CANCELLED` and not `EXPIRED`.** The schema names both as terminal. Only `CANCELLED` has a
timestamp column, and nothing in `src/` has ever written `EXPIRED`. A dismissed claim is told apart
from a withdrawn commitment by `receiptNumber`, which a dismissed one never had.

**Why all three queue actions now return their denial.** `listPendingSponsorshipsAction` and the
new `rejectPetSponsorshipAction` adopt `fetchAuditLogsAction`'s shape — the guard inside the
`try`, a denial returned as the guard's own message — which §1 of the loose-ends entry named as
the fix, and the test that pinned the throw (`rejects.toThrow(/RECONCILE_SPONSORSHIPS/)`) was
rewritten to the returned shape, as §1 said it would be. The first build left
`reconcilePetSponsorshipAction` throwing, on the grounds that the repo-wide choice is unmade. The
review noted that Confirm and Dismiss sit on the same row, and a coordinator whose session had
lapsed would get "could not confirm… reload" from one button and "Authentication required" from
the other. So its guard returns too. The predicate is `isAuthorizationError` in `rbac.ts`, which
owns both error classes; four older private copies of the same `instanceof` pair remain elsewhere
and are not touched here. The repo-wide question is still open.

**Why `id` is the tiebreak.** `orderBy: [{ createdAt: "asc" }, { id: "asc" }]` makes the queue a
total order, which is what a coordinator needs; a cuid is only roughly time-ordered across
processes, so this is *deterministic*, not a promise of insertion order. In memory the ids are
zero-padded serials, so there it is exactly insertion order, and the `.reverse()` the previous
decision added to compensate for the stable sort is gone. The `ceiling:` on a monotonic sequence
stays.

## Verified

Docker cannot start on this machine, so PostgreSQL 18.4 was stood up from the `embedded-postgres`
package in the session scratchpad — same user, password, port and database name as
`docker-compose.yml` — and the schema pushed with `npm run db:push:local`. Nothing in the repo
records the server; it is a throwaway with `persistent: false`.

- **Spike A1**, a throwaway script talking to Postgres directly, six concurrent transactions on one
  `PENDING_PAYMENT` pledge. It measured the *draw-first* shape the first build used; what it
  establishes for the shipped shape is the mechanism both share — the conditional update
  serialising on the row lock and a loser reading the winner's number afterwards:

      "results": 1 × "reconciled" HFS-DON-2999SPK-0001, 5 × "already_reconciled" HFS-DON-2999SPK-0001
      "donationRows": [ "HFS-DON-2999SPK-0001" ], "counterLastValue": 1,
      "pledge": { "status": "ACTIVE", "receiptNumber": "HFS-DON-2999SPK-0001" }

- `npm run test:db` — the whole tier, **3 files, 22 tests, all passed**, the first time it has
  run on this machine (after `npm run db:seed:local`, which the schema-integrity probe expects).
  That includes the new `sponsorshipLedger.postgres.test.ts`, 6 tests against the shipped
  guard-first build: the reader's `ORDER BY`, the four-way settle race (one receipt,
  `lastValue = 1`, three losers holding the number, serial 2 for the next pledge), the rejection
  transition and its terminality. §4 closes MEASURED.
- Unit, memory mode, after the second review's fixes: `sponsorshipReconciliation`,
  `donationLedger`, `petSponsorship`, `softDeleteAndAuth` and the three guard suites —
  **118 passed**. The `Promise.all` test failed against the old action (excerpt above) and passes
  against the new one; the same-instant queue test fails with the `id` tiebreak removed and passes
  with it; a crafted `{ not: "" }` pledge reference leaves every pledge pending on both mutations.
- `npm run check` — `tsc` clean, `eslint` 0 errors (14 warnings, all pre-existing in files this
  branch does not touch), `docs:check` OK.
- `DATABASE_URL="" RESEND_API_KEY="" npm run test:all`, with the embedded server stopped first so
  the "no database" branches found none — **95 files, 1554 tests, all passed**. With the server
  still up, twelve `softDeleteAndAuth` cases fail: their sealed session ids exist in no reachable
  database. That is the suite's environment assumption, not this branch, and it is recorded in
  `tasks/lessons/2026-09-14-a-missing-docker-is-not-a-missing-database-tier.md`.

## Not verified

- Anything about Neon's pooled endpoint beyond what `issueDonationReceipt`'s existing
  `$transaction` has relied on in production since 2026-09-03.
- The dismiss control in `SponsorshipReconciliation.tsx` has no component test; the action behind
  it does. Nothing was run in a browser.
- CI's Postgres container. The suite is written to its conventions and ran green here against the
  embedded server; the two have not been compared.

## The action contracts, for the public-checkout branch

Recorded because a Codex session holds `src/hooks/useSponsorshipController.ts` and
`src/components/features/pets/SponsorshipModal.tsx` on a sibling branch and should read these
rather than infer them.

- `createPetSponsorshipAction(input)` — unchanged.
- All three queue actions guard through `requirePermission(RECONCILE_SPONSORSHIPS)`, which
  re-reads the member's live status, and return a denial in `error` rather than throwing. A
  pledge reference that is not a non-empty string of at most 64 characters is answered with
  "No sponsorship found for that pledge reference" before anything is read.
- `listPendingSponsorshipsAction()` → `{ success, data?, error? }`.
- `reconcilePetSponsorshipAction(pledgeRef)` → `{ success, receiptNumber?, error? }` — any row
  that already carries a receipt, `ACTIVE` or since withdrawn, returns `success: true` with that
  number; a row that left the queue without one returns `success: false`.
- `rejectPetSponsorshipAction(pledgeRef, reason?)` → `{ success, error? }` — new. `reason` over
  `REJECTION_REASON_MAX` (500) characters, or not text, is refused with a message rather than
  truncated; the limit is exported from `src/lib/validations/sponsorship.ts` for the client.

Related: [[2026-09-08-reconciliation-screen-closes-the-sponsor-portal]],
[[2026-09-08-a-receipt-asserts-relief-only-when-it-can-back-it]],
[[2026-09-03-donation-ledger-verified-on-postgres]],
[[2026-09-03-sponsor-state-annotates-the-ledger]].
