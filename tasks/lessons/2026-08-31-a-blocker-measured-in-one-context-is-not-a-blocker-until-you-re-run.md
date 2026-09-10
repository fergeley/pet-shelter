# A blocker measured in one context is not a blocker until you re-run it in yours

**Learned:** 2026-08-31

Worktrees were rejected for a year's worth of reasoning on one number: `node_modules` is 987 MB and
a worktree carries no gitignored files, so no test can run inside one. Both halves are true. The
conclusion is false, because `.claude/worktrees/` sits inside the repo and Node resolves
`node_modules` by walking up — `npm test` runs 664 tests green in a worktree that has no
`node_modules` of its own. The command took 0.68s to disprove and was never run, and in the meantime
a 335-line hook was built to mitigate the hazard worktrees would have dissolved.

The tell was there: the entry rejecting worktrees quoted `du -sh` and `git rev-list --count`, but no
command that actually *tried* the thing. Measured inputs, reasoned conclusion, recorded as if the
conclusion were measured too.

**Rule:** before building a mitigation, run the alternative you rejected — once, for real. An
inference from two measured facts is still an inference, and it inherits the evidence class of the
weakest link, not the strongest. If a rejected option would make the work unnecessary, the cost of
testing it is the cheapest thing on the table.

---
