# A stored string that something compares against is an interface

**Learned:** 2026-09-04

An audit row for the donation-receipt email was filed under entity
`"AdoptionApplication"`, which looked like a mislabel. Refiling it as
`"DonationReceipt"` looked like pure tidying, and the justification seemed solid: the
audit viewer already branches on that exact value.

That branch was the problem. `exportCsv.ts` and `useAuditLogController.ts` both classify
an audit row as a donation when `entity === "DonationReceipt"`, and the email row
carries no `receiptNumber` — so the change injected a phantom RM 0.00 line into the
LHDN Section 44(6) receipts export, one per donation, with the real receipt number and
donor "Anonymous Donor". The reasoning was backwards: that branch existed *because*
only real donation records carried the value.

The same trap fired again two commits later, filing sponsor mail under entity `"Pet"` —
which is how the audit viewer's Adoptions tab is built, so it would have buried the
adoption trail under up to 250 bulk-mail rows per upload.

**Rule:** before changing a stored string, grep for it. If anything compares against
the literal, it is an interface and not a label. Related: the entries below on making
existing data load-bearing — same shape, different direction.
