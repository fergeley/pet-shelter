# The reconciliation queue reaches `reconcilePetSponsorshipAction`, and gates on its own permission

**Decided:** 2026-09-08

Closes §1 of `tasks/open/sponsor-portal-is-inert-until-reconciliation-is-reachable.md`. §2 through
§5 of that entry stay open; §2 in particular still blocks production.

## What was missing, and what was not

`reconcilePetSponsorshipAction` has been complete since PR #6 — RBAC-guarded, audited, and already
handling the two-coordinator race by returning `already_reconciled` with the number that exists
rather than minting a second. Nothing called it. Every commitment stayed `PENDING_PAYMENT`, no
`receiptNumber` was ever assigned, and the portal's account-claim challenge requires one, so nobody
could register an account at all.

So the gap was a **reader and a screen**, not a mutation. `sponsorshipLedger.ts` exported
`findSponsorshipByPledgeRef`, `listActiveSponsorshipsForPet`, `listSponsorshipsByUserId` and
`listSponsorshipsByEmail` — and no pending reader among them. Added `listPendingSponsorships`,
`src/actions/sponsorships.ts#listPendingSponsorshipsAction`, `src/app/admin/donations/page.tsx`,
and `src/components/admin/SponsorshipReconciliation.tsx`.

## Why a new permission rather than reusing one

`RECONCILE_SPONSORSHIPS` is the only capability in the catalogue that mints a statutory document
from a gapless series. Folding it into `MANAGE_CONTENT` would have handed receipt issuance to every
content editor; `VIEW_AUDIT_LOG` would have meant something the name does not say. The admin nav
gates on permissions, so reusing one was the alternative on offer, and both available ones were
lies about what the capability is.

The grant is `VOLUNTEER_COORDINATOR` plus `SUPER_ADMIN` by derivation from `ALL_PERMISSIONS`.
Measured, before writing the page, that this is exactly the set the mutation's own
`assertAuthorized(session, [ROLES.ADMIN, ROLES.COORDINATOR])` admits — `hasRole` normalises both
sides, so `ADMIN → SUPER_ADMIN` and `COORDINATOR → VOLUNTEER_COORDINATOR`:

    SPIKE A3 holders of REVIEW_APPLICATIONS  = ["SUPER_ADMIN","VOLUNTEER_COORDINATOR"]
    SPIKE A3 legacy [ADMIN,COORDINATOR] admits = ["SUPER_ADMIN","VOLUNTEER_COORDINATOR"]

Had they differed, the page would have shown a button whose mutation rejects the person clicking
it — a failure that surfaces only at the moment money is confirmed. That equivalence is now pinned
by `tests/unit/sponsorshipReconciliation.test.ts` rather than left to hold by coincidence, because
the two guards are written in different vocabularies and nothing else would notice them drifting.

## Two deliberate asymmetries

**The queue is oldest-first.** Every other list in `sponsorshipLedger.ts` is newest-first, because
they are activity feeds. This one is a work queue, and the supporter who has waited longest for
their receipt is the one to settle next.

Writing that surfaced a real bug the test caught: `memorySponsorships` is newest-first because
`recordSponsorshipPledge` prepends, and pledges recorded in the same millisecond compare equal, so
a stable sort preserved the array's newest-first order and the queue came out backwards. Fixed by
reversing before sorting. `ceiling:` same-millisecond ties still fall back to insertion order.

**A failed read is not an empty queue.** `listPendingSponsorshipsAction` returns `success: false`
rather than `[]`. This is the split `donationLedger.listDonationsOrThrow` already documents, and it
binds harder here: an empty queue is a *claim* that every supporter has been paid out, and a
coordinator who believes it stops looking.

## Not verified

Nothing here ran against real PostgreSQL. `npm run test:db` needs a Postgres on `localhost:5432`
and Docker cannot start on this machine, so the Prisma branch of `listPendingSponsorships` — the
`where: { status: "PENDING_PAYMENT" }, orderBy: { createdAt: "asc" }` query — is **ASSERTED, not
measured**. The in-memory branch is covered.

Related: [[2026-09-08-lhdn-relief-is-opt-in-not-a-column]].
