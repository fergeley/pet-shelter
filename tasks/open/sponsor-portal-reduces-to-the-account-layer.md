# PR #6 should shrink to the account layer and plug into `PetSponsorship.userId`

**Status:** open. PR #6 is a draft; do not merge it as it stands.
**Branch:** `worktree-sponsor-tiers` @ `c1d2ff5` (contains `master` as of `c95d0b8`).
**Raised:** 2026-09-03.

---

## What happened, twice

This branch has now had its storage layer overtaken by `master` two times in one day.

1. **First collision.** `master` gained `Donation` + `ReceiptSequence`. The branch's
   `SponsorContribution` was a second donation ledger with random receipt numbers and
   whole-ringgit amounts. Resolved in `c1d2ff5`: `SponsorContribution` deleted, sponsor
   state moved to a `DonationSponsorship` annotation on the append-only ledger. Recorded in
   `tasks/decisions/2026-09-03-sponsor-state-annotates-the-ledger.md`.

2. **Second collision, while that merge was being written.** `d301e74`
   *"feat(sponsorship): per-animal sponsorships, settled before a receipt is issued"*
   landed on `master` with a `PetSponsorship` model that **is** `DonationSponsorship`,
   built better:

   | Concern | `master` — `PetSponsorship` | this branch — `DonationSponsorship` |
   |---|---|---|
   | Pet link | `petId` + `petName` snapshot, survives rename/archive | `targetPetId` only |
   | Lifecycle | `PENDING_PAYMENT → ACTIVE \| CANCELLED \| EXPIRED` | `status` + a separate `isActive` |
   | Reconciliation | `reconciledAt`, `reconciledBy`, `receiptNumber` `@unique` | `status` flip, no audit columns |
   | Pre-receipt | `pledgeRef` (`HFS-PLG-`), deliberately unlike a receipt number | none — enrolment needed a receipt first |
   | Account hook | `userId` — *"Reserved for a future supporter account."* | `sponsorId` |

   Their `userId` comment is describing this branch. They left the slot open.

## The decision this implies

**Stop rebuilding the storage layer. Delete `DonationSponsorship` and populate
`PetSponsorship.userId`.**

Concretely:

- `Sponsor` (the account, password hash, wall consent) is the one model this branch should
  still add. Nothing on `master` covers it.
- `sponsorRepository` reads `PetSponsorship` rows by `userId` instead of its own table.
- Tier derivation counts rows with `status === "ACTIVE"`. That is exactly the
  `PENDING`/`CONFIRMED` split this branch added for the self-granted-tier finding, already
  present and better named — `PENDING_PAYMENT` says *why* it does not count.
- `cancelRecurringPledgeAction` sets `CANCELLED` and stamps `cancelledAt`, rather than
  flipping a separate `isActive`.
- Wall consent (`displayOnWall`) is the one genuinely new column: one boolean on
  `PetSponsorship`, captured at checkout.
- `confirmContributionAction` is superseded by whatever reconciles `PENDING_PAYMENT →
  ACTIVE` in `src/actions/sponsorships.ts`; read that first rather than adding a second
  reconciliation path.

## What is worth keeping, unchanged

None of this is storage, and all of it survived two review rounds:

- `src/lib/domain/supporterTier.ts` — the derived standing. Pure, 33 tests, no I/O. Retarget
  its input type at `PetSponsorship`; the logic does not move.
- `sponsorAccess.ts`, `TierGate`, and the Route Handler that keeps `/pets/[id]` prerendered
  while still gating media — with the payload-level assertions that no locked URL reaches an
  under-tier response.
- `sponsorSession.ts` — a separate cookie namespace with a type claim, and the regression
  guard that stops `loginAction`'s `"1234"` backdoor reaching sponsor accounts.
- The portal, wall, certificate and nudge UI, now on `--standing-*` tokens.

## Why this was not merged instead

Nine commits landed on `master` between fetching it and finishing the merge against it.
The branch cannot converge by chasing; it converges by shrinking to the part nobody else is
building. A third storage rewrite would collide a third time, and `master` deploys to
production through Vercel.

## Do this first, next session

1. `git fetch origin && git log --oneline HEAD..origin/master` — assume it has moved again.
2. Read `src/actions/sponsorships.ts`, `src/lib/server/sponsorshipLedger.ts` and
   `src/lib/domain/petSponsorship.ts` before writing anything. They are ~800 lines and they
   own this domain now.
3. Then reduce this branch as above. It should get considerably smaller.
