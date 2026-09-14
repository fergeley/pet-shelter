# General donations issue receipts before an external transfer is reconciled

**Status:** open - opened 2026-09-14

`submitDonationPledgeAction` persists a `Donation` and allocates an official
`HFS-DON-*` receipt immediately after a public caller selects DuitNow QR or
direct bank transfer. The application has not observed the bank statement at
that point; it knows only that the supporter submitted the form. A direct probe
also showed that the action accepted the unimplemented `card` enum value and
issued an official receipt. The card path was closed in the sponsorship-contract
branch because no processor exists, but the two external-transfer rails retain
the pre-existing immediate-receipt contract.

The public-sponsorship task could not convert this flow opportunistically: its
registered fence and the supplied plan explicitly required no-target checkout to
preserve the existing donation receipt. A safe redesign must decide whether a
general gift becomes a pending payment reconciled by staff, or whether a verified
payment-provider/bank callback becomes the issuance boundary. It must also cover
idempotency, existing receipt consumers, email timing, audit semantics, and the
statutory export before changing the action result.

**Settles when:** a stakeholder chooses the verified payment boundary and a
test-backed implementation proves that no official receipt is allocated before
that boundary confirms the money, while duplicate confirmations remain
idempotent.
