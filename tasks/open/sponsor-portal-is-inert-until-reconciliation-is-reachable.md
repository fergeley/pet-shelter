# The sponsor portal is merged but inert: no coordinator can reconcile a commitment

**Status:** open · opened 2026-09-03 · follows PR #6 (`3239671`)

The supporter account layer is on `master`. A supporter cannot use it, and will not be able
to until one of the items below lands. This is the safe failure — the alternative was
letting a public form grant Gold — but it is a failure, and it should not be discovered by
a donor.

---

## 1. Nothing reaches `reconcilePetSponsorshipAction` — blocking

`src/actions/sponsorships.ts` exports it, RBAC-guarded to ADMIN/COORDINATOR and audited. No
admin page calls it. So:

- Every commitment stays `PENDING_PAYMENT` forever.
- `countsTowardFunding()` is false for all of them, so `deriveTier` returns `null` for
  every real supporter. Nobody earns Bronze.
- No `receiptNumber` is ever assigned, and the account-claim challenge requires one — so
  **nobody can register a portal account at all.**

The three demo logins in the guide work because `sponsorDemoSeed.ts` reconciles their
commitments in offline mode. On production, with a database configured, no seed runs and
the portal has zero usable accounts.

**What is needed:** a coordinator view listing `PENDING_PAYMENT` commitments with their
`pledgeRef`, amount, supporter and animal, and a confirm action. `pledgeRef` is prefixed
`HFS-PLG` precisely so a coordinator reading a bank statement can tell a claim from a
receipt — the screen should show it prominently. `reconcileSponsorship` already returns
`already_reconciled` with the existing number, so two coordinators racing is handled;
the UI needs to render that outcome rather than treat it as an error.

## 2. The production migration has not been applied — blocking, operational

```bash
psql "$DATABASE_URL" -f prisma/sql/2026-09-03_sponsor_accounts_additive.sql
```

Until then production has no `sponsors` table. The repositories declare the database
authoritative rather than falling back (`isLedgerPersistent()`), so this is a **500 on
`/sponsors` and `/sponsor/login`**, not a graceful degradation.

Do not reach for `db:push` — see
[`production-schema-has-drifted-ahead-of-master.md`](production-schema-has-drifted-ahead-of-master.md).

## 3. Exclusive media is gated but not secret

`src/data/exclusiveMedia.json` holds public Unsplash URLs and public YouTube ids. The gate
is real — an under-tier response provably contains no URL, asserted in
`tests/unit/sponsorPetMediaRoute.test.ts` — but anyone who obtains a link keeps it, and
anyone can construct the Unsplash ones without going near the gate.

Real exclusive media needs signed, short-lived URLs minted per request inside
`getGatedPetVideoDiary` / `getGatedPetGallery`. Note the constraint recorded in
`src/lib/domain/sponsorAccess.ts`: `gate()` currently counts withheld items by loading
them, which is free for a JSON import and wrong the moment the catalogue becomes a remote
fetch. Give it a separate count source at the same time.

## 4. A claimed account is only as good as a forwarded email

The claim challenge requires an `ACTIVE` commitment's `receiptNumber`. That is proof of
possession, not proof of identity: a supporter who forwards their receipt has given away
their claim, and the number is not high-entropy.

Verified-email sign-up is the proper fix and was deliberately deferred. The exposure is
bounded — the portal projects no tax identifiers, no payment details and no other
supporter's data — but it should not be deferred indefinitely.

`NotificationPreference` already mails a signed token to an address to authenticate a
preference change. That mechanism is the obvious basis for verifying a claim, and reusing
it would be better than building a second one.

## 5. Two scaling ceilings, deliberately not optimised

Recorded so they are met as decisions rather than surprises. Neither is a correctness
problem at eight pets and a handful of supporters.

- `getSponsorDashboard` reads every pet via `getServerPetsAsync()` to resolve one to three
  sponsored animals, because that is the only database-aware pet reader. Wants
  `findMany({ where: { id: { in: [...] } } })` somewhere north of a few hundred pets.
- `getSponsorWall` loads every opted-in account with its commitments and derives standings
  in JavaScript, on a `force-dynamic` page. Wants SQL aggregation, or a cached page with
  tag invalidation, somewhere north of a few thousand supporters.

---

## Not in scope here

The `Playwright golden paths` failure on `04_admin_application_review` predates PR #6 and is
tracked separately in
[`admin-application-delete-leaves-the-row.md`](admin-application-delete-leaves-the-row.md).

## Background

- Design: `docs/architecture/GUIDE_SPONSOR_TIERS_AND_GATED_CONTENT.md`
- Why sponsor state annotates the ledger instead of extending it:
  `tasks/decisions/2026-09-03-sponsor-state-annotates-the-ledger.md`
- What went wrong building it, and the six lessons: `tasks/lessons.md`
