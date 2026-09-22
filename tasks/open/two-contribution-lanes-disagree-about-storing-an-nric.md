# The two contribution lanes disagree about storing an NRIC in the audit log

**Status:** open - opened 2026-09-22

Both lanes reconcile a contribution and issue a Section 44(6) receipt, and both write an audit row
that the LHDN CSV fallback exports. They disagree about the supporter's tax identifier:

- `reconcileDonationPledgeAction` (`src/actions/donations.ts`) writes `taxIdOrIc` into the
  `DONATION_RECEIVED` row's details. That predates the receipt-boundary change — the old
  submission-time audit row carried it too, and the value was preserved when the row moved to
  reconciliation.
- `reconcilePetSponsorshipAction` (`src/actions/sponsorships.ts`) does not.

The consequence is visible inside a single document. When the donation-ledger read comes back
empty, `useAuditLogController` falls back to exporting audit rows, and in that CSV a general
donor's "Tax ID / IC / Passport" cell is populated while a sponsor's is blank — even though both
supplied an identifier at checkout and both receipts carry it.

## Why this is a decision, not a cleanup

Either answer is defensible and they pull in opposite directions:

- **Drop it from the donation row.** An NRIC in `AuditLog.metadata` is personal data stored a
  second time, in a table with a different retention story from `donations`, and the authoritative
  export reads the ledger — which has the identifier — so the fallback losing it is a degraded
  path behaving like one.
- **Add it to the sponsorship row.** The fallback export exists precisely for when the ledger
  cannot be read, and a statutory document with a blank identifier column cannot be filed for
  relief, so a fallback that silently drops it produces a receipt list nobody can use.

What is not defensible is the two lanes answering differently, which is the current state.

Whoever decides should also check the other direction: `listPendingSponsorships` and
`listPendingDonationPledges` both go out of their way to keep `taxIdOrIc` out of the coordinator's
queue, with an explicit allow-list `select` rather than an `omit`, so the codebase already treats
this field as one to narrow rather than spread.

## Settles when

Both reconciliation actions make the same choice, the comment in each names it, and a test asserts
the resulting CSV column for both row shapes.
