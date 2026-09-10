# A shared table needs its namespace subtracted at *every* read, not just yours

**Learned:** 2026-09-08

The five home counters reuse `ImpactStat` under `home_*` keys. `selectHomeMetrics` ignored keys it
did not own, so I called the namespace enforced and wrote a ledger entry describing the leftover
coupling as "not a correctness bug today". It was a correctness bug the first time anyone used the
feature: `TransparencyEditor` creates a counter at `displayOrder: 0`, the seeded ledger rows are
1/2/3, and `/donate` renders `sortImpactStats(...).slice(0, 3)`. The first home figure staff
published would have evicted a real donation figure, and `/transparency`, which does not slice,
would have listed all five among the ledger's own.

Only one direction of the filter existed. The direction I did not write is the one that corrupts,
because my own reader was the one I was thinking about.

**Rule:** when two features share a table, the filter belongs at every read of that table, and the
key set gets exactly one definition that both sides import. Write the *other* surface's test first
— "does the ledger still show its own three when a home row exists?" — because your own surface
passing proves only half the contract.
