# A pull request can say "Merged" and ship nothing

**Learned:** 2026-09-04

PR #2 merged `feat/tnrm-rehabilitation` into master on 2026-09-01 00:59. PRs #3 and #7
then merged **into that same branch** a day later, after it had already landed and
would never merge again. Both show green in the UI. Neither merge commit is an
ancestor of master, and none of `scripts/commit-msg.mjs`,
`docs/reference/COMMIT_MESSAGES.md` or `tests/unit/commitMessage.test.ts` existed on
master. A whole commit standard was silently unshipped for three days.

Nothing looked wrong. The badge is green, the base branch still exists, the feature
"merged". It surfaced only while pruning branches, when three separate branches turned
out to carry the *same* unmerged commits — which is the shape of work that never
reached the trunk.

**Rule:** with this many parallel branches, a PR's *base* is as important as its state.
`gh pr list --state all --json number,headRefName,baseRefName` — anything based on a
feature branch rather than `master` either has to be re-targeted or needs its base to
merge again afterwards. The authoritative test is ancestry, never the badge:
`git merge-base --is-ancestor <merge-sha> origin/master`.
