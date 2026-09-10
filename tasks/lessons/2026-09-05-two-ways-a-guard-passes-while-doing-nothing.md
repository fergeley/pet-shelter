# Two ways a guard passes while doing nothing

**Learned:** 2026-09-05

Building `scripts/check-doc-invariants.mjs` produced both failure modes in one sitting.

**Its test reimplemented the regex it was checking**, so it would have stayed green while the shipped
parser broke. Fixed by exporting `citedNumbers` and asserting on that. A test that contains its own
copy of the logic is testing the copy.

**It flagged its own source and its own test**, because a tool that names the pattern it hunts
necessarily contains that pattern. The exclusion is correct, and it is also exactly how a real
finding would get silenced later, so it is pinned to two paths and that length is asserted.

Neither was visible by reading. Both appeared on the first run.

**Rule:** run the guard, then mutate in **both** directions — inject the violation and confirm it
fails naming file and line, then correct it and confirm it passes. A guard verified only in the
failing direction cannot tell you it will ever go green.
