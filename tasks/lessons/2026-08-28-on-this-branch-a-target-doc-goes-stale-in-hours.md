# On this branch, a target doc goes stale in hours

**Learned:** 2026-08-28

`TARGET_PERSISTENCE_TARGETING.md` P-2 asked which of two things Tier 3 should be. The concurrent
session answered it — with `tests/integration/support/prismaDouble.ts`, splitting Tier 3a from
Tier 3b — before the ink was dry, and better than the framing in the target. The document had to be
corrected before anyone acted on it, or the next reader would have chased a decision already made.

**Rule:** re-run a target's own §1 / §3 claims against the tree immediately before starting work
from it, and again before writing "this is the only file" or any other exhaustiveness claim. Prefer
a measurement (`ls`, `grep -c`) over the reading you did an hour ago. Writing the conclusion down is
not the end of the job; keeping it true is part of it.
