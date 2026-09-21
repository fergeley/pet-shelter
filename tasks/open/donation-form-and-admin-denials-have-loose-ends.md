# Four loose ends found while making LHDN relief opt-in, left unfixed on purpose

**Status:** open · opened 2026-09-09 · found during PR #36, none of them caused by it ·
§1, §3 and §4 closed 2026-09-14 by
[[2026-09-14-reconciliation-issues-the-receipt-inside-the-pledge-transaction]]; §2 remains

Each was seen, priced, and left. They are recorded here rather than fixed because each is either a
different subsystem or a change to a shared contract, and the gate for that work forbids
ride-alongs. Ordered by how much they cost if ignored.

---

## 2. Two donor labels render a double asterisk

`src/lib/i18n/translations.ts` carries `donorNameLabel: "Donor Full Name (for tax receipt) *"` and
`donorEmailLabel: "Email Address (to receive e-Receipt) *"` — and `DonationWidget.tsx` renders each
followed by its own `<span className="text-destructive">*</span>`. So both fields display `* *`.

`donorIcLabel` had the same shape and lost its baked-in asterisk in PR #36, because that field's
requirement became conditional and the marker had to move. The other two were left alone: they are
unconditionally required, so the duplication is cosmetic, and changing them is a two-locale
dictionary edit that had nothing to do with that change.

**Agent-checkable trigger:**

```bash
grep -n 'donorNameLabel\|donorEmailLabel' src/lib/i18n/translations.ts
```

Expected today: four lines, each ending `*",`. When the trailing `*` is gone from all four, this is
closed.

---

## Settles when

Each item is either fixed or has moved to `tasks/decisions/` as a deliberate non-fix. Delete the
section, not the file, as each closes; delete the file when the last one goes.

Background: [[2026-09-08-lhdn-relief-is-opt-in-not-a-column]],
[[2026-09-08-a-receipt-asserts-relief-only-when-it-can-back-it]],
[[2026-09-08-reconciliation-screen-closes-the-sponsor-portal]].
