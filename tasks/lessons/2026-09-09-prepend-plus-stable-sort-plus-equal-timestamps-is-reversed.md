# Prepend, then a stable sort on a key that ties, returns the list reversed

**Learned:** 2026-09-09

`listPendingSponsorships` returned the reconciliation queue backwards in memory mode.
`recordSponsorshipPledge` prepends, so the array is newest-first; pledges recorded in the same
millisecond compare equal on `createdAt`; and `Array.sort` is stable, so it faithfully preserved the
newest-first order it was handed. The intended order was oldest-first.

Real traffic would rarely produce a tie. A test that records three pledges in a loop produces one
every time — which is why the test caught it, and why it would otherwise have surfaced as an
unreproducible ordering complaint.

**Rule:** when the source order is meaningful and the sort key can tie, normalise the source order
before sorting (here, `.reverse()` first), and leave a `ceiling:` comment saying ties fall back to
insertion order.
