# Four loose ends found while making LHDN relief opt-in, left unfixed on purpose

**Status:** open · opened 2026-09-09 · found during PR #36, none of them caused by it

Each was seen, priced, and left. They are recorded here rather than fixed because each is either a
different subsystem or a change to a shared contract, and the gate for that work forbids
ride-alongs. Ordered by how much they cost if ignored.

---

## 1. Server Actions already use two different patterns for reporting a denial

This entry originally said the fix "is one decision applied everywhere at once", and that the
divergence would only become live later. **Checking the trigger before filing it showed that was
wrong: both patterns are already in the tree**, and the reason given for deferring — that matching
one would be a change to a shared contract — does not hold.

**Guard outside the `try`, error thrown.** `getAdminPets` (`src/actions/pets.ts`) and the new
`listPendingSponsorshipsAction`. The `ForbiddenError` escapes the Server Action; a production build
masks it into an opaque digest, so the client cannot tell a denial from a network fault.

**Guard inside the `try`, denial returned.** `fetchAuditLogsAction` (`src/actions/audit.ts:11-12`):

```ts
  try {
    const session = await getVerifiedSession();
    assertHasPermission(session, PERMISSIONS.VIEW_AUDIT_LOG);
    ...
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to fetch audit logs";
    return { success: false, error: msg };
  }
```

That hands the client `Role 'CONTENT_EDITOR' is not authorized for this operation.` — a legible
denial, which is what a page rendering the result actually needs.

So adopting the `audit.ts` shape for `listPendingSponsorshipsAction` is **reuse of an existing
in-repo pattern**, not the invention of a contract, and it is a change to one function. What
stopped it was the ride-along rule and the fact that it was discovered while writing this file
rather than during the build — not its cost. It would also require updating
`tests/unit/sponsorshipReconciliation.test.ts`, which currently asserts
`rejects.toThrow(/RECONCILE_SPONSORSHIPS/)`.

The wider question — which of the two shapes the repo should standardise on — is still one
decision, and still unmade.

**Agent-checkable trigger:**

```bash
grep -n -A 3 "^  try {" src/actions/audit.ts
```

Expected today: `assertHasPermission(session, PERMISSIONS.VIEW_AUDIT_LOG);` appears within three
lines *after* the `try {` — the caught pattern. Written as a grep rather than a line range because
line numbers drift and a stale range reports the wrong thing silently. If that guard moves above
the `try`, the repo has standardised on throwing and this item closes the other way.

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

## 3. The pending queue ties on `createdAt` and falls back to insertion order

Marked in `src/lib/server/sponsorshipLedger.ts` with a `ceiling:` comment. Two pledges recorded in
the same millisecond have no defined order between them; the memory branch resolves the tie by
insertion order and Postgres by whatever the plan yields.

Harmless at this volume — it decides which of two simultaneous pledges a coordinator sees first, and
both are in the list. It wants a monotonic sequence on `PetSponsorship` if the shelter ever needs a
total order over the queue.

**No agent-checkable trigger exists.** The condition is a volume judgement, not a state a command
can read.

## 4. `listPendingSponsorships` has never run against PostgreSQL

Its `where: { status: "PENDING_PAYMENT" }, orderBy: { createdAt: "asc" }` branch is **ASSERTED**.
The in-memory branch is covered by `tests/unit/sponsorshipReconciliation.test.ts`, and the e2e run
that verified PR #36 used the offline ledger, so neither exercised Prisma.

`npm run test:db` needs a Postgres on `localhost:5432`; Docker is unavailable on this machine and
nothing is listening there. Note that the *donation* ledger does have real-Postgres coverage
(`tests/integration/db/donationLedger.postgres.test.ts`), so the tier exists and this reader simply
has no member in it.

**Agent-checkable trigger:**

```bash
npm run test:db -- tests/integration/db
```

Expected today: fails to connect. When it runs, this reader needs a probe added beside the donation
ledger's.

---

## Settles when

Each item is either fixed or has moved to `tasks/decisions/` as a deliberate non-fix. Delete the
section, not the file, as each closes; delete the file when the last one goes.

Background: [[2026-09-08-lhdn-relief-is-opt-in-not-a-column]],
[[2026-09-08-a-receipt-asserts-relief-only-when-it-can-back-it]],
[[2026-09-08-reconciliation-screen-closes-the-sponsor-portal]].
