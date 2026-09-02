# The LHDN receipts export reads the donation ledger, and says when it is incomplete

**Decided:** 2026-08-31 · GRAVE lane, full five phases. Closes
`tasks/open/CLAIM-lhdn-export-reads-auditlog.md`, which carried the gate and the spike verdict.

## The defect

The statutory LHDN Section 44(6) export was assembled in the browser from
`fetchAuditLogsAction(250)` — the 250 most recent audit rows **of any kind**. Pet edits, logins and
application approvals consume that budget, so on a shelter with ordinary admin traffic older
receipts fell off the annual return while the UI reported `Exported N donation receipt(s)`.

Found by the `schema-auditor` agent on 2026-08-31 and verified independently: no `/admin/donations`
route exists, `listDonations()` had zero non-test callers, and `useAuditLogController.ts:22` fetches
250 mixed rows that `:64` then filters client-side.

## Fence: the AuditLog source protected nothing

The export engine landed `eb7e302` **2026-08-16**; `donationLedger.ts` **2026-08-27**; the
`Donation` model **2026-08-29**. It read the audit trail because that was the only source of
donation data at the time. Chronologically prior to its replacement, not protective of anything.
The one live candidate — offline/in-memory mode — is covered by `listDonations()` itself.

## KC1 fired: the obvious fix would have made it worse

The auditor's proposal was to point the export at `listDonations()` because "the `Donation` row
already carries every CSV column, so the `DonationReceipt` branch works unchanged." **Measured
false.** `DonationRecord` carries `amountSen`/`issuedAt`; the branch reads `amountMYR`/`date`; and
its guard `"receiptNumber" in item && "donorName" in item` matches *both* shapes, so an unmapped
record does not throw:

    "Official Receipt No"    = "HFS-DON-202608-0007"
    "Date & Time"            = ""
    "Amount (MYR)"           = "undefined"

That is a corruption bug replacing a truncation bug. The mapper already existed —
`toReceiptDTO` at `src/actions/donations.ts:28`, which the donor confirmation and the receipt email
already use — so the export reuses it and the three cannot disagree about what a receipt says.

## The new fence, and its sign

`listDonations` swallows every read error into `[]`. That is right for a dashboard and wrong for a
statutory export, where `[]` is not a degraded view but a **claim** — that the shelter received no
donations — indistinguishable from the truthful version of that claim. `listDonationsOrThrow` is
the same query with the swallow removed; `listDonations` now delegates to it, so there is one query
and two error policies rather than two copies.

**The sign is `tests/unit/donationLedger.test.ts` → "read policy: the export must be able to see a
failure".** Two tests, one per policy. Delete either and the export can file an outage as a tax
return. Verified by mutation: making `listDonationsOrThrow` swallow produces
`AssertionError: promise resolved "[]" instead of rejecting` — and leaves the *integration* suite
green, because that suite mocks the read. The unit-level sign is what catches it.

## Silence, not the number, was the defect

Three ways the export can be incomplete; all three are announced and none auto-dismisses.

1. **The ledger is younger than the shelter.** It began 2026-08-29 and nothing backfilled it, so
   pre-existing receipts live only in `AuditLog`. The completeness check compares against
   `receiptLogs.length`; it can only under-warn, never raise a false alarm.
2. **The export caps.** Truncation is *observed* — the action asks for `limit + 1`, so a full page
   is distinguishable from an exact fit — and the notice says the **oldest** rows are the ones
   dropped, which is the wrong end for an annual return.
3. **The read failed.** Reported; nothing is downloaded.

A cap alone would have moved the number without removing the silence.

## Review findings, and what was done

`/code-review high` found ten. Seven were acted on: the swallowed read failure and the test that
verified only its own mock (both HIGH), the zero-row-only fallback that would hide every
pre-2026-08-29 receipt once the ledger held one row (HIGH — the same defect class relocated, and
the one that would have shipped), the missing try/catch on the now-async handler, the missing
in-flight guard whose absence let a second click wipe the non-dismissing warning, the unactionable
truncation wording, and a non-finite `limit` reaching `{success: true, data: []}` through `NaN`.

**Recorded as optional, not done:** the two export paths emit different date formats under the same
filename (`15 Aug 2026, 10:00 am` from the ledger, `2026-08-15 02:00:00` from the audit fallback);
and the button's count badge still derives from `receiptLogs` rather than the ledger, so it now
describes a different number than the export produces. Fixing the badge honestly requires a ledger
count at page load — an extra round trip on every audit view — which is not worth it for a badge.

## Not verified

`listDonations` has still never run against a real Postgres
(`tasks/open/donation-ledger-unverified-on-postgres.md`, open since 2026-08-28). KC2 was registered
as unmeasurable at registration time rather than retired later. The design does not depend on it:
a ledger that returns nothing falls back and says so, and a ledger that fails now reports rather
than returning empty. Whether the completeness heuristic fires correctly against real data is
likewise unverified — it is sound in direction, untested in magnitude.
