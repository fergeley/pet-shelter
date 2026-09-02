# Sponsor portal (PR #6) must not merge until it uses master's donation ledger

**Status:** blocked, by choice. PR #6 is open and marked draft.
**Branch:** `worktree-sponsor-tiers` @ `b969b56`
**Raised:** 2026-09-03, while attempting to merge.

---

## What happened

PR #6 was ready and green — 292 tests, clean typecheck, clean lint, passing Vercel preview.
On merging, `master` turned out to have moved a long way since the branch point
(`d939e07`): PR #4 landed, and a concurrent session shipped the donation ledger, a tiered
Vitest setup, session-secret hardening, and a large schema expansion.

Fourteen files conflict. Thirteen are ordinary integration work. The fourteenth is not.

## The blocking problem

**`master` now has a donation ledger, and this branch built a second one.**

| | `master` — `Donation` | this branch — `SponsorContribution` |
|---|---|---|
| Receipt numbers | `ReceiptSequence` table, contiguous, allocated in a transaction | 6 random digits, collision-*unlikely* |
| Money | `amountSen: Int` — RM 250.00 as `25000` | `amountMYR: Int` — cents unrepresentable |
| Integrity | `prisma/sql/donation_append_only.sql`, `@@unique([sequenceScope, sequenceValue])` | `@unique` on the receipt number only |
| Written by | `src/lib/server/donationLedger.ts` | `src/lib/sponsorStore.ts` |
| Tested against Postgres | `tests/integration/db/donationLedger.postgres.test.ts` exists | no |

Both are written from the same Server Action. `submitDonationPledgeAction` is one of the
conflicting files, and each side writes its own ledger from it.

Master's is better on every axis that matters, and it is better precisely where this branch
is weakest: my own review round flagged the random receipt number as collision-unlikely
rather than unique, and noted that a proper sequence "already exists on the TNRM branch —
not reimplemented here." That branch is now `master`. The reason for keeping them separate
has gone.

Merging as-is would put two donation ledgers in one schema, disagreeing about how money is
represented and how receipt numbers are issued. That is the repo's known recurring defect
shape, at the schema level, in the subsystem that issues statutory LHDN tax receipts.

## Recommended resolution

Do not reconcile the two ledgers. **Delete `SponsorContribution` and put the sponsor
columns on `Donation`:**

- `sponsorId String?` + relation to `Sponsor` — the account link
- `status String @default("PENDING")` — payment reconciliation, the fix for the
  self-granted-tier and account-takeover findings in PR #6
- `displayOnWall Boolean @default(false)` — consent captured at checkout
- `targetPetId String?` — so "My Rescues" can join on an id
- `isActive Boolean @default(true)` — recurring pledge cancellation

Then:

1. Point `sponsorStore.ts` at `Donation`; delete its receipt generator in favour of the
   sequence. `src/lib/domain/receiptNumber.ts` goes away entirely.
2. `recognisedContributionMYR` reads `amountSen` and divides — or better, the whole tier
   ladder moves to sen and `TIER_THRESHOLDS_MYR` becomes `_SEN`.
3. `submitDonationPledgeAction` keeps master's ledger write and gains only the sponsor
   fields.
4. Re-point the six sponsor suites; the assertions should survive largely unchanged, since
   they test derivation and gating rather than storage.

`docs/architecture/HANDOFF_DONATION_AND_SPONSORSHIP_SUBSYSTEM.md` on master appears to
cover this seam and should be read first — it may already specify the intended shape.

## What is worth keeping from PR #6 regardless

The parts that are not about storage, and which the review rounds hardened:

- The derived-standing model (`src/lib/domain/supporterTier.ts`) — pure, 33 tests, no I/O.
- The gate rule and its enforcement (`sponsorAccess.ts`, `TierGate`, the Route Handler that
  keeps pet profiles prerendered), with the payload-level assertions.
- Sponsor sessions as a separate namespace with a type claim, and the `"1234"` regression
  guard.
- `PENDING`/`CONFIRMED` — the fix for both critical review findings. This concept must
  survive the port; without it the donation form is a self-service route to Gold and to
  other donors' accounts.
- The two "empty vs unavailable" fixes in the storage boundary, which apply to any store.

## Why this was not just merged

The user asked for the merge. I stopped because landing it would knowingly ship a duplicate
ledger to a branch that deploys to production via Vercel, in the subsystem that issues tax
receipts — and because the better implementation already exists ten commits away. This is a
design decision about which ledger survives, and it belongs to whoever owns the donations
subsystem, not to a merge conflict resolution.
