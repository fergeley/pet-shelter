# The admin sponsorship reconciliation dashboard, and how it was verified

**Decided:** 2026-09-08

Opened as `tasks/open/CLAIM-admin-sponsorship-reconciliation.md` and moved here at session
close. The claim's live content — what remains out of scope — was migrated into
[`../open/sponsor-portal-is-inert-until-reconciliation-is-reachable.md`](../open/sponsor-portal-is-inert-until-reconciliation-is-reachable.md)
before the move, so nothing unresolved is buried in `decisions/`. What is kept below is the
settled part: the kill conditions and the fact that none of them fired, the Build Gate with
its raw evidence, and what the independent review changed.

**Session:** agent-7-sponsorship (worktree `.claude/worktrees/agent-7-sponsorship`)
**paths:**
- `src/lib/server/sponsorshipLedger.ts` (add pending-list read only)
- `src/actions/sponsorships.ts` (add guarded list action only)
- `src/app/admin/sponsorships/page.tsx` (new)
- `src/components/features/sponsors/SponsorshipReconciliationTable.tsx` (new)
- `tests/unit/sponsorships/reconciliation.test.ts` (new)

Closes item 1 of `sponsor-portal-is-inert-until-reconciliation-is-reachable.md`.

## Kill conditions — registered before the build, immutable

**KC1 — the unit lane must not be able to reach production or send mail.**
`reconcilePetSponsorshipAction` calls `sendDonationReceiptEmail` unawaited and issues a
statutory receipt. If the `unit` vitest project has either `RESEND_API_KEY` or
`DATABASE_URL` set, a test that drives reconciliation mails a real donor and writes the
production Neon branch (triage-rules doors 1 and 3).
*Fires if:* asserting `process.env.RESEND_API_KEY === undefined` and
`isLedgerPersistent() === false` inside the unit lane does not hold.
*If it fires:* the suite must not call the action at all; drop to testing
`reconcileSponsorship` only, and say the RBAC path is unverified.

**KC2 — the RBAC path must be drivable from a unit test.**
The existing `petSponsorship.test.ts:292` skips it, commenting that a unit test "has no way
to hold" the session. If mocking `@/lib/security/session` cannot produce a rejection for a
VOLUNTEER and a success for a COORDINATOR, the new suite adds nothing the old one lacks.
*Fires if:* the mocked-session pattern used by `transparency.test.ts` does not work here.
*If it fires:* delete the suite rather than ship a third copy of the summary tests.

**KC3 — the new read must not create a second source of truth.**
`pet_sponsorships` is owned by `sponsorshipLedger.ts`. A pending-list query written anywhere
else, or one that bypasses `isLedgerPersistent()`, reintroduces the try/catch-fallback class
of bug that `2026-09-03-sponsor-state-annotates-the-ledger.md` removed.
*Fires if:* the implementation queries `prisma.petSponsorship` outside this module, or lacks
a memory-mode branch.
*If it fires:* move the query into the ledger module before anything else proceeds.

## Out of scope, deliberately — documented, not touched

Per the scope decision on this task, these are named here and left alone:

1. `src/hooks/useSponsorshipController.ts` calls `submitDonationPledgeAction`, so the public
   "Sponsorship" modal creates a `Donation`, never a `PetSponsorship`. **No pledge row is
   created in production today**, so this dashboard will list nothing until that one-line
   action swap happens. This is the single highest-value follow-up.
2. `src/app/admin/layout.tsx` — the new page needs a `navLinks` entry, and
   `src/lib/security/permissions.ts` has no sponsorship permission to gate it with. Without
   these the page is reachable only by typing the URL.
3. `prisma/migrations/manual/20260903_pet_sponsorships/` has not been applied to production
   (`sponsor-portal-is-inert-until-reconciliation-is-reachable.md` item 2), so the page 500s
   there until a human applies it.

*(This entry opened with a `Settles when:` line — "the dashboard is merged and item 1 of the
sponsor-portal ledger is struck". The dashboard is merged; item 1 is struck and rewritten to
name what actually remains. The condition is spent, which is why this is no longer an open
entry.)*

---

## Build Gate — admin sponsorship reconciliation · lane: GRAVE · branch: worktree-agent-7-sponsorship
## retroactive: the ledger read, the guarded action and the test suite were built before this gate was emitted. The UI was not.

### Phase 0 — frame
- [x] `Problem:` `reconcilePetSponsorshipAction` has no caller, so every commitment stays
      PENDING_PAYMENT forever, no receipt is ever minted, and the account-claim challenge that
      needs a receipt number can never be satisfied — the whole supporter portal is inert.
- [x] `Claim:` add a pending-queue read inside the ledger module, a role-guarded action that
      projects it, and one coordinator screen that calls the existing reconcile action —
      because the reconciliation logic, its race handling and its receipt allocation already
      exist and are correct; only the path to them is missing.
- [x] `frame-confidence:` high — `tasks/open/sponsor-portal-is-inert-until-reconciliation-is-reachable.md` §1 states this problem and prescribes this shape.

### Phase 1 — stack + fences
- [x] Memory searched before listing: grepped `tasks/decisions/` and `tasks/open/`; found and read
      the sponsor-portal ledger, `production-schema-has-drifted-ahead-of-master.md`, and
      `2026-09-03-sponsor-state-annotates-the-ledger.md`. Nothing re-derived.

```
A1 [MEASURED] The unit lane cannot reach production Postgres or send real mail — evidence below.
A2 [MEASURED] The RBAC path is drivable from a unit test — mutation run below.
A3 [MEASURED] The pending read lives in the module that owns pet_sponsorships and honours
              isLedgerPersistent() — KC3; both branches present in listPendingSponsorships.
A4 [ASSERTED] The Prisma branch of listPendingSponsorships returns what the memory branch does.
              No data. Rung 1 is missing here: Docker cannot start on this machine, so
              `npm run test:db` has no Postgres, and exercising it against the real DATABASE_URL
              is triage-rules door 1.
A5 [ASSERTED] The screen behaves in a browser. Not observed — see Failure Truth.
```

- [x] **Fence sweep:** nothing removed. This is additive — one new exported read, one new exported
      action, two new files. No existing behaviour is deleted, replaced or simplified, so there is
      no fence to account for. `n/a — nothing removed`.

### Phase 2 — falsification

- [x] **RAW EVIDENCE for A1** (highest-ranked entry, and the one that gates every other test).
      Command: `npx vitest run --project unit tests/unit/sponsorships/reconciliation.test.ts`
      Output:
      ```
       Test Files  1 passed (1)
            Tests  18 passed (18)
      ```
      Including the two preconditions asserting `process.env.RESEND_API_KEY === undefined` and
      `isLedgerPersistent() === false`.
      **Would have shown instead, if false:** those two named tests failing — and had they been
      absent, the suite would have issued 8 real receipts against the production Neon branch and
      sent 8 real donor emails through Resend, silently and irreversibly.

- [x] **RAW EVIDENCE for A2** — a passing suite proves nothing until it can fail. Two deliberate
      mutations, in an isolated worktree, never committed:
      (1) memory-mode sort flipped to descending; (2) `ROLES.VOLUNTEER` added to the reconcile
      allow-list.
      Output:
      ```
      × lists pending commitments oldest first, because it is a work queue
      × refuses to reconcile for an unauthorised caller
      × burns no receipt number on a refused reconciliation
       Tests  3 failed | 15 passed (18)
      ```
      **Would have shown instead, if false:** 18 passed — which would have meant the queue
      ordering and the authorisation guard were asserted by nothing. Exactly the three predicted
      tests failed and no others; both mutations were then reverted.

- [x] Kill conditions written to `tasks/open/` before the build and not edited after.
      Outcome: **KC1 did not fire** (both preconditions hold). **KC2 did not fire** (the mocked
      session drives both roles). **KC3 did not fire** (the read is inside the ledger module and
      branches on `isLedgerPersistent()`).

- [x] **Failure Truth** — what actually happens when this breaks in production: the dashboard is
      the only thing that mints a sponsorship receipt, and a receipt cannot be withdrawn. A
      mis-click issues a statutory LHDN document and emails it to a donor. A wrong pending query
      shows a coordinator an incomplete queue, and a supporter waits indefinitely with no signal.
      **Today it will show an empty table on production even when correct**, because the public
      modal writes a `Donation` and never a `PetSponsorship` (out-of-scope item 1) and the
      migration is unapplied (item 3).

- [x] **Reversibility** — the code is one revert. **The receipts it issues are not.** `Donation`
      is append-only by trigger; an incorrect activation is corrected by an offsetting entry, not
      by deletion. This is why the confirm step names the consequence.

### Hygiene
- [x] **No ride-alongs.** Diff is the five paths listed at the top of this claim.
- [x] **Ledger** — this gate appended here. No `tasks/decisions/` entry: no reversible design
      choice was made that the sponsor-portal ledger does not already record.

**Not verified:** **A4** — the Prisma branch of `listPendingSponsorships` has never executed
against a real Postgres; Docker will not start on this machine and the only configured database is
production. **A5** — the screen has not been rendered in a browser, and deliberately was not:
`npm run dev` reads `.env.local`, so clicking "Verify & Activate" once on localhost would issue a
real receipt and email a real donor (triage-rules doors 1 and 3). Both are ASSERTED, not knowledge.
A reviewer must not read "18 passed" as covering either.

---

## Independent review (Phase 3), and what was done about it

A sub-run saw the diff and the six stated requirements, and not the reasoning that produced
them. It verified all six as met and the design-system guards as clean. Nine findings; acted
on seven, recorded two.

**Fixed — defects in this diff:**

1. **The new action guarded on the raw cookie** (`getCurrentSession`) while the page beside it
   used `getVerifiedSession`. A Server Action is a POST endpoint whose id the client already
   holds and the cookie lives 24 hours, so a coordinator suspended in `/admin/members` could
   still pull every pending supporter's name, email and phone. Both this action **and**
   `reconcilePetSponsorshipAction` now resolve through the DAL. The second is pre-existing
   code, changed deliberately: this dashboard is its first caller, so shipping the button
   without it would be knowingly exposing receipt issuance to a suspended account.
2. **The client never caught a rejected action.** `assertAuthorized` throws rather than
   returning, so an expired session — a console left open overnight, the ordinary case — left
   the row spinning forever and never rendered the error banner. There is no `error.tsx`
   anywhere under `src/app` to catch it either. Now wrapped in try/catch/finally.
3. **Hydration mismatch on the pledge date.** `toLocaleDateString` renders in the runtime's
   zone, so a UTC server and a UTC+8 browser disagree about the day for any pledge after
   16:00 UTC. Replaced with the repo's existing `formatTimestampDate`, whose docblock
   describes this exact bug.
4. **The page reported an authorization failure as a missing migration.** `UnauthorizedError`
   and `ForbiddenError` now reach `unauthorized()`/`forbidden()` instead of the database panel.
5. **A failed reconcile left a stale, still-clickable row.** Now refreshes on that path too.
6. **The success banner claimed an email that is fire-and-forget** — and that an
   already-reconciled pledge does not send at all. Reworded to claim only issuance.
7. **This suite's docblock overclaimed.** It said it covered "concurrency outcomes nothing yet
   asserts"; `petSponsorship.test.ts` already asserts the ledger's `already_reconciled`
   branch, and the sequential idempotence test here returns at the action's pre-check without
   ever reaching it. Both comments corrected to say what they actually prove.

**Recorded, not fixed:** the check-then-act ordering that can orphan a statutory receipt under
a true race, and the fact that the orphan is only visible in `console.error` — both pre-existing
and both deliberately documented in the action itself, but made materially more reachable by
this screen. Written up as
[`../open/reconciliation-mints-the-receipt-before-it-claims-the-pledge.md`](../open/reconciliation-mints-the-receipt-before-it-claims-the-pledge.md).
Rewriting the order in which statutory documents are allocated is its own task, wants a real
Postgres to exercise the race, and is not what this one was scoped to.

**Not actioned:** the missing admin nav entry — already recorded above as out-of-scope item 2.

**Re-verified after the fixes:** 1300 unit tests pass (79 files), `npm run check` clean at the
pre-existing 17-warning baseline with no warnings in any of the five changed files.

One caveat on that run: an earlier full-suite pass showed `secrets.test.ts` and
`agentGuard.test.ts` failing with `Hook timed out in 10000ms` — a timeout, not an assertion, in
files this change does not touch, while transform time had nearly doubled under concurrent
session load. Both pass in isolation (63 tests, 8.9s) and the next full run was green. This is
the Windows-under-load flake the vitest config already documents, not a regression.
