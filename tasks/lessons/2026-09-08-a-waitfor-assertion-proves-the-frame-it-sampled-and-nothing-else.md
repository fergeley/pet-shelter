# A `waitFor` assertion proves the frame it sampled and nothing else

**Learned:** 2026-09-08

I "verified" that a counter animation never emitted a malformed intermediate value with a `waitFor`
that asserted the visible text did not match a bad pattern. `waitFor` resolves on the first polling
attempt that passes, so it proves such a frame existed — not that every frame was well formed. The
real defect it was supposed to catch (a thousands separator left in the suffix, so "1,250" climbed
0→1 with a stray ",250" beside it) lived in a regex, which is pure.

Moving `splitFigure`/`formatFigureFrame` into `src/lib/domain/metrics.ts` turned a racy one-sample
observation into an exhaustive loop over every intermediate value, in the node tier, in
milliseconds. The jsdom test kept only the claim that tier can actually own: the climb *ends* on
the published figure.

**Rule:** if the property under test is deterministic, extract it and test it deterministically.
Reserve the timing-dependent tier for the one thing it uniquely owns — usually the settled state —
and note in the test why the rest is asserted elsewhere.
