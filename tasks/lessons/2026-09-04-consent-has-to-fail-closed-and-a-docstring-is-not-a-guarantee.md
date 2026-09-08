# Consent has to fail closed, and a docstring is not a guarantee

**Learned:** 2026-09-04

`partitionByConsent` decided who receives a mailing. Its module docstring said the
design "keeps a database outage from silently turning into email everyone anyway". The
code did exactly that: the query was wrapped in `try/catch`, and on failure every
address fell through to the permissive default and was mailed — including donors who
had explicitly unsubscribed.

Two things went wrong together. Reading and sending answer different questions —
rendering a preference page may assume consent, deciding to send may never — and they
had been collapsed into one function. And the comment describing the safety property
was written at the same time as the code that violated it, so it read as verification
when it was only intention.

The fix separates the two and reports a third outcome: `allowed`, `blocked`, and
`unresolved` for addresses whose consent could not be established. Unresolved is never
mailed. An unsent notification costs nothing; one sent to somebody who opted out is the
failure the feature exists to prevent.

**Rule:** when a comment claims a safety property, go and check the branch that
implements it. And where a default has asymmetric costs, name the third state rather
than folding "we could not tell" into "yes".
