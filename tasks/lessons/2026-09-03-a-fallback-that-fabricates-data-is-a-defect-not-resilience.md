# A fallback that fabricates data is a defect, not resilience

**Learned:** 2026-09-03

Shipped a transparency page whose offline fallback substituted a bundled sample
ledger whenever the database read failed or returned nothing. The admin editor
warned about it; the public page did not. A production deploy against an
unmigrated database would have published 28 invented expenses, complete with
realistic invoice references, on the one page whose entire claim is that its
figures are verified — and `next build` had already baked that state into the
prerender. A later review found a second door onto the identical bug: the seed
script inserted the same rows as *published*, which made the read succeed and the
provenance notice suppress itself.

The tell was that the fallback made an assertion. A cache or a retry asserts
nothing; substitute data asserts "these are the numbers".

**Rule:** before writing a fallback, ask what it *claims* to the reader. On any
surface that makes a truth claim — financial, legal, medical, audit — the fallback
is an honest empty state, never invented content. Gate sample datasets to
non-production and label them wherever they render. And a provenance field is
worth nothing until *every* surface that renders the data reads it: adding the
field and wiring it to one consumer made the risk feel handled, which is worse
than not having it. Related: [[anything-written-twice-diverges]].
