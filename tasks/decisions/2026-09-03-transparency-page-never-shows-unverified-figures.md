# The transparency page must never present unverified figures as verified

**Decided:** 2026-09-03

Building `/transparency` ("Where Your Money Goes") and its admin editor surfaced one
invariant that outranks every other requirement in the brief, and three separate
code paths that violated it. Recording the invariant and the paths, because each
violation looked like ordinary resilience engineering at the time.

## The invariant

A page whose entire claim is *"these figures are verified"* must have no path that
displays figures which are not. An honest empty state always beats a plausible
number. This is not a general rule about fallbacks — a cache or a retry asserts
nothing — it applies wherever the surface makes a truth claim.

## The three paths that broke it

1. **The offline fallback.** A bundled sample ledger was substituted whenever the
   database read failed *or* returned nothing. A production deploy against an
   unmigrated database would have published 28 invented expenses with
   realistic-looking invoice references. `next build` had already baked that state
   into the prerender. Fixed: `TransparencySource` is now
   `database | sample | unavailable`; the sample set is refused in production, and
   every surface that renders the figures states the provenance.

2. **The seed script.** `npm run db:seed` inserted the same sample rows as
   *published*, so the read then succeeded, `source` became `database`, the
   provenance notice suppressed itself, and the fiction rendered as fact. The admin
   banner was even instructing operators to run it. Fixed: the sample ledger is
   behind `SEED_SAMPLE_TRANSPARENCY=true`. (`assertSeedTargetIsLocal` in
   `prisma/env.ts`, added independently on master, covers the adjacent risk of
   seeding a non-local target; this covers what the rows *mean*.)

3. **The provenance field itself.** `source` was added and then wired to exactly
   one consumer, the admin editor. The public page never read it. A provenance
   field is worth nothing until every surface that renders the data reads it —
   and having added the field made the risk *feel* handled, which is worse than
   not having it.

## Derived, never stored

Allocation percentages are computed from the expense ledger and never written
down. The donate page previously hard-coded 45/30/20/5 while the ledger said
something else; two pages giving different answers to a transparency question is
the actual defect, not a cosmetic inconsistency. Both surfaces now read one
derived snapshot, aggregated in the database over every published row so the chart
stays exact while only a bounded window of rows is shipped to the browser.

Corollary found in review: the aggregate and the rendered feed must share one
predicate for "counts as a ledger entry". They didn't, so a refund row appeared in
the feed while being excluded from the totals — the same two-answers failure one
level down.

## Related

- `[[measure-fallout-before-writing-task-docs]]` — the figures in this doc were
  measured by serving a production build against an unreachable database, not
  reasoned about.
- The Postgres gap is still open: none of this has run against a real database.
