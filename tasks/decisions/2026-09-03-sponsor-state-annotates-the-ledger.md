# Sponsor state annotates the ledger; it does not duplicate it

> **Superseded in part, same day.** The `DonationSponsorship` table this document
> introduced was itself replaced by `master`'s `PetSponsorship`, which landed hours later
> and is the better model. The *reasoning* below still stands and is why the final shape
> is right — an append-only ledger of facts, annotated by a mutable record of the
> relationship. Only the table name changed. The branch now adds `Sponsor` and populates
> `PetSponsorship.userId`. See
> `tasks/open/sponsor-portal-reduces-to-the-account-layer.md`.

**Date:** 2026-09-03
**Context:** merging the sponsor portal (PR #6) into a `master` that had, meanwhile,
gained the donation ledger.

---

## The collision

Both branches had built a place to record a donation.

| | `master` — `Donation` | PR #6 — `SponsorContribution` |
|---|---|---|
| Receipt numbers | `ReceiptSequence`, contiguous, allocated in a transaction | 6 random digits |
| Money | `amountSen: Int` — exact | `amountMYR: Int` — sen unrepresentable |
| Integrity | append-only trigger + `@@unique([sequenceScope, sequenceValue])` | `@unique` on the receipt number |
| Written from | `submitDonationPledgeAction` | `submitDonationPledgeAction` |

Master's is better on every axis, and better precisely where the branch was weakest — its
own review round had already flagged the random receipt as collision-*unlikely* and pointed
at "the sequence work on the TNRM branch." That branch had become `master`.

## The decision

`Donation` is the ledger. `SponsorContribution` is deleted. Sponsor-programme state moves
to a new `DonationSponsorship` table keyed by receipt number.

**Not** as columns on `Donation`, which was the recommendation in the earlier
`tasks/open/` note and was wrong. `donations` is append-only: `donationLedger.ts` exports
no update path and `prisma/sql/donation_append_only.sql` enforces it with a trigger. Every
sponsor-side write — claiming an account, reconciling a payment, cancelling a recurring
pledge, withdrawing consent — would have been rejected by that trigger.

That rejection is the design telling you something true: these are two different kinds of
fact.

- A **donation** is an immutable event. Money moved; the receipt says so; a statutory
  document must not change afterwards.
- A **sponsorship** is a mutable relationship that outlives the moment: who claims it,
  whether it has been reconciled, whether it is still running.

So the ledger keeps the fact and a second table annotates it. Amount, donor identity, tier,
frequency and receipt number are stored once and read through a join.

## What that bought

- One receipt number, allocated by the sequence. `src/lib/domain/receiptNumber.ts` is gone.
- One money representation. The tier ladder moved to `TIER_THRESHOLDS_SEN`
  (5 000 / 30 000 / 120 000) and `deriveTier` reads `amountSen` straight from the ledger.
- One mode rule. The repository follows `donationLedger.ts`: the mode is *declared* by
  `DATABASE_URL`, not discovered by catching an error. The branch's try/catch fallback is
  gone, and with it the class of bug where a failed consent withdrawal was demoted into
  process memory and reported as success.
- Demo sponsors seed through `issueDonationReceipt`, so the offline demo exercises the real
  numbering and the real arithmetic instead of a fixture that can drift.

## What the merge caught

Master's guards found two regressions git had auto-resolved in the branch's favour, both
silent:

- `--background` reverted from `#fff8f4` to a stale `#fdf8f4` (`oklch.test.ts`).
- `PetGallery` reverted from the `text-2xs` scale token to `text-[11px]`
  (`designSystemGuards.test.ts`).

Neither would have been caught by review; both were caught by a test that reads the real
CSS. That is an argument for this kind of guard, not against the merge.

The same guards rejected the sponsor components' hand-rolled tier colours. Bronze, Silver
and Gold are now `--standing-*` tokens in `globals.css`, deliberately *outside* the
seven-tone contract — a standing is brand identity, not semantic status — with `-line` and
`-label` slots rather than `-border` and `-text` so a utility cannot be misread as a
malformed tone.

## What survived unchanged

Everything that was not about storage, which is most of what two review rounds hardened:
the derived-standing model, the gate rule and its payload-level assertions, sponsor
sessions as a separate namespace with a type claim, and the `PENDING`/`CONFIRMED` split
that closes the self-granted-tier and account-takeover findings.
