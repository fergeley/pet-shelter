# Home-page impact metrics share the `ImpactStat` table with the donation ledger

**Status:** open · opened 2026-09-08

`src/lib/domain/metrics.ts` reads the home page's five counters from the same `ImpactStat` table
that `/donate` and `/transparency` read. That reuse is deliberate — the table already carries
bilingual labels, a publish flag, and an admin editor
(`src/components/admin/TransparencyEditor.tsx`), so counting the figures from `Pet` would have
duplicated a subsystem *and* published wrong numbers. Two consequences are unresolved:

1. **A home row can surface on /donate.** `AllocationSummary.tsx:134` renders
   `impactStats.slice(0, 3)` ordered by `displayOrder`. If staff create a `home_*` row with a low
   `displayOrder`, it displaces a donation figure on /donate and /transparency. The `home_` key
   prefix keeps the leak one-directional — `selectHomeMetrics` ignores non-`home_` keys, so ledger
   stats can never reach the home page — but nothing enforces the ordering in the other direction.
   The surfaces that would need a key filter (`src/app/donate/page.tsx`,
   `src/components/features/transparency/AllocationSummary.tsx`) are outside this task's write
   scope.

2. **Editing a home figure does not refresh `/`.** `src/actions/transparency.ts:63` sets
   `LEDGER_PATHS = ["/transparency", "/donate"]`, so `revalidateLedger()` never invalidates the
   home route. `src/app/page.tsx` sets `export const revalidate = 300`, so an admin edit appears
   on the home page within five minutes rather than immediately. `src/actions/**` is read-only for
   this task, so adding `"/"` to that array was not done here.

Neither is a correctness bug today: the production `ImpactStat` rows are the three donation-ledger
keys seeded from `src/data/transparency.json`, no `home_*` row exists yet, and every home slot
therefore falls back to its curated FE-02 figure.

**Settles when:** either `LEDGER_PATHS` includes `"/"` and the ledger surfaces filter by key
prefix, or the home metrics move to a table of their own and this coupling stops existing.
