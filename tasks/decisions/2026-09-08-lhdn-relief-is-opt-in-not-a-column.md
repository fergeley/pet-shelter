# Section 44(6) relief became an opt-in validator rule, not two new database columns

**Decided:** 2026-09-08

The task as handed over asked for a tax-receipt checkbox plus four required fields — full legal
name, NRIC/passport/SSM, **tax mailing address**, email — and implied a schema change to store
them. Two of those four already existed and were already required. The other two did not survive
review.

## What was actually broken

`DonationWidget.tsx` rendered `Malaysian IC / Passport / SSM No. *` — the asterisk baked into
`donorIcLabel` in both locales — while `donationPledgeSchema` declared `taxIdOrIc` `.optional()`.
Measured before changing anything:

    SPIKE A1 success = true
    SPIKE A1 parsed taxIdOrIc = undefined
    SPIKE A1b empty-string success = true

So a donor could submit with no tax identifier at all and receive a receipt that announces itself
as deductible under Subsection 44(6) while carrying nothing to deduct against. That is the defect,
and it needed no new storage to fix.

## Why `donorAddress` was not added

The receipt is emailed, rendered on screen, and printable. Nothing in this system posts anything.
A "tax mailing address" would have been a column with **no consumer**, added for a delivery channel
that does not exist.

It would also not have been free. `.env.local` carries `NEON_BRANCH=production` and
`prisma/migrations/` holds only `manual/`, so a schema change here is a one-way door
(`.claude/templates/triage-rules.md` §1–2, both re-verified on the day). Spending a one-way door on
a field nothing reads, on the strength of a belief about Malaysian filing requirements that cannot
be checked from this repo, is the trade this decision refuses.

**If the shelter later says LHDN's annual return of donations needs donor addresses, this reverses**
— as an additive SQL file following `prisma/sql/2026-09-04_donations_ledger_additive.sql`, applied
with `prisma db execute`, never `db:push`.

## Why `wantsTaxReceipt` is not persisted either

Nothing would read it. `Donation.taxIdOrIc` already records whether an issued receipt carries a
claimable identifier, so a column would be a second answer to a question that already has one — and
two answers diverge. The flag decides which fields the form requires and nothing else, so it lives
in the validator.

It is `.optional()` rather than `.default(false)` because `DonationPledgeInput` is `z.infer`, the
schema's *output* type, where a defaulted field is **required**. `.default(false)` stopped
`useSponsorshipController` and ten test call sites compiling for a flag they have no opinion about.
`tsc` caught this; nothing else would have.

## The default is unticked, and that was not the first answer

Ticked-by-default was written first, on the reasoning that the form had always presented the field
as required. Three tests in `DonationReceiptIntegrity.test.tsx` then failed, and they were right to:
the form *displayed* the identifier as required and *accepted* its absence, so the two readings
disagree and only one can be preserved.

- Honour the marker → newly block every donor who until now gave with a name and an email. A
  cosmetic defect becomes a funding one.
- Honour the behaviour → block nobody, and add a way to opt in.

The second. A receipt is still issued either way: the ledger is the shelter's record of money
received, not of claims made, and a gift that declines relief must not become a donation the
gapless series never saw.

## Also fixed, because this change made it reachable

`submitDonationPledgeAction` returned `err.message` for a validation failure. On Zod 4 that is
`JSON.stringify(issues)`. It was survivable only because every rule the form could break was
already blocked by a `required` attribute — and `wantsTaxReceipt` is conditional, which the browser
cannot express. Verified by disabling the new branch and observing what the donor would have seen:

    AssertionError: expected '[\n  {\n    "code": "custom",\n    "p…' not to match /^\s*\[/

Related: [[2026-09-08-reconciliation-screen-closes-the-sponsor-portal]].
