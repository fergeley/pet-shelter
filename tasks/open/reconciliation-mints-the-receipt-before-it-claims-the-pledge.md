# Reconciliation mints the receipt before it claims the pledge

**Status:** open · opened 2026-09-08

`reconcilePetSponsorshipAction` is check-then-act:

```
:212  if (existing.status === "ACTIVE" && existing.receiptNumber) return ...   // check
:222  donation = await issueDonationReceipt({ ... })                           // irreversible
:249  outcome = await reconcileSponsorship(pledgeRef, donation.receiptNumber)  // claim
```

Two coordinators clicking the same row at the same moment both pass the check at
`:212`, both mint a number from the gapless per-month series, and one loses the
conditional `UPDATE` inside `reconcileSponsorship`. The loser's `Donation` row is a
statutory receipt attached to no sponsorship. `donations` is append-only by trigger,
so it cannot be deleted — it needs an offsetting correction from the treasurer.

**This is a known trade, not an oversight.** The action's own docblock says so, and
chose to log the orphan rather than paper over it. What changed on 2026-09-08 is the
*reachability*: `/admin/sponsorships` makes "two coordinators working one queue" the
normal workflow rather than a hypothetical, so the window is now routinely open.

Two coupled problems:

1. **Ordering.** The safe shape is claim-then-mint — take the conditional UPDATE
   first with a placeholder, then issue the receipt and attach it. `reconcileSponsorship`
   is already a guarded conditional update, so it is most of the way there. This is a
   change to statutory receipt issuance and wants its own task, its own tests, and a
   real Postgres to exercise the race — none of which this machine has.
2. **The orphan is invisible to whoever caused it.** `:251-254` writes
   "the spare needs an offsetting correction" to `console.error` and returns
   `{ success: true }`, so the coordinator sees a clean green banner. Whoever has to
   make the correction finds out by grepping logs. At minimum this should raise an
   audit-log entry, which is queryable, instead of a console line that is not.

**Not fixed here deliberately.** The reconciliation dashboard task was scoped to making
the existing action reachable, and rewriting the order in which statutory documents are
allocated is not that. Recorded so it is met as a decision rather than as a surprise.

**Settles when:** issuance is reordered to claim-then-mint, or a decision entry records
why the orphan is acceptable and the audit-log gap is closed.
