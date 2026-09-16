# A reviewer's diagnosis can be right while its remedy is wrong

**Learned:** 2026-09-09

The first review of the sponsorship reconciliation queue found a real defect: the pledge date was
rendered with `toLocaleDateString` and no `timeZone`, so a UTC server and a UTC+8 browser disagree
about the day — a hydration mismatch. It prescribed the repo's `formatTimestampDate`, whose own
docblock discusses exactly that mismatch, so it looked purpose-built. It was applied.

The second review found the remedy was a second defect. `formatTimestampDate` renders the **UTC**
calendar date, and this screen exists to match rows against a *Malaysian* bank statement: every
pledge made between 00:00 and 08:00 MYT was shown a day early. The repo had already answered the
question — `donationLedger.receiptScopeFor` pins Asia/Kuala_Lumpur, with a comment saying
`toISOString()` "gets it wrong for eight hours of every day".

Two properties were at stake: the same output on server and client, and the right local day. The
prescribed fix satisfied the first and silently broke the second. Pinning the zone satisfies both.
The fix is now asserted by a component test at 17:00 UTC, which fails if the date is rendered in
UTC.

**Rule:** when a review prescribes a specific fix, name every property the defect violates and
check the remedy against each one — do not adopt a helper because its docstring mentions the
symptom. Then grep for the repo's existing answer on the same axis (here `timeZone:` and
`Asia/Kuala_Lumpur`) before writing a new one. The diagnosis is evidence; the remedy is a
hypothesis. And the commit that responds to a review is new code that nobody has reviewed yet —
see `2026-09-08-a-security-fix-needs-an-adversarial-pass-of-its-own-and-its-tests-ar`.
