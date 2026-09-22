# The /donate form records DuitNow QR for every gift, including bank transfers

**Status:** open - opened 2026-09-22 · pre-existing, surfaced by the receipt-boundary work

`src/components/features/donations/DonationWidget.tsx` hardcodes
`paymentMethod: "duitnow_qr"` in the payload it submits. The same screen also publishes the
shelter's Maybank corporate current account, with a copy-to-clipboard button, as an equally
prominent way to give. A donor who takes that route is recorded as having paid by DuitNow QR.

The value is not cosmetic. It is stored on the contribution, copied onto the donor's Section 44(6)
receipt by `receiptDraftFor`, and rendered on the receipt email as "Payment Rail". The receipt
carries no bank field, so a wrong rail is the only thing on the document that describes how the
money arrived — and it is wrong for every bank-transfer donor.

`PAYMENT_RAIL_LABELS` in `src/lib/email.ts` exists precisely because this kind of mistake has
happened before: "A card donation was previously receipted as a bank transfer in the HTML half."
That fix made the label exhaustive over the union; it could not fix a caller that reports the
wrong member of the union.

## What changed on 2026-09-22, and why this is now worse

Before the receipt boundary moved, the hardcoded value went onto the receipt and no further. It
now has a second consumer: the general-gift reconciliation queue renders it as the rail for a
coordinator to match against a bank statement (`ReconciliationQueue.tsx`, via
`PAYMENT_LABELS`). So a coordinator reconciling a Maybank transfer is shown a row asserting
"DuitNow QR (PayNet)", which is actively misleading at exactly the moment someone is checking
which line in the statement belongs to which claim.

This was deliberately **not** fixed alongside the boundary change. The fix is a payment-rail
selector on the public form — new UI, new copy in both languages, and new component tests — which
is its own change rather than a ride-along on a change about when a receipt is issued.

## The shape of the fix

`useSponsorshipController` already does this correctly for the modal lane: it holds a
`paymentMethod` state over `duitnow_qr | online_banking` and submits what the supporter chose.
`/donate` needs the same control, defaulting to `duitnow_qr` so nothing changes for donors who use
the QR, and it needs the Malay strings alongside the English.

Worth deciding at the same time: whether the *coordinator* should be able to correct the rail at
reconciliation, since the bank statement is the only authoritative source for it and the donor's
answer is a self-report either way.

## Settles when

A donor who pays by bank transfer sees "Direct Bank Transfer" on their receipt and in the
coordinator's queue, with a component test that submits the form on each rail and asserts the
submitted payload.
