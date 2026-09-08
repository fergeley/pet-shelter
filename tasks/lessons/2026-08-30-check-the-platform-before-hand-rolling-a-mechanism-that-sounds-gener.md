# Check the platform before hand-rolling a mechanism that sounds generic

**Learned:** 2026-08-30

Spent a long session building a multi-session coordination protocol for the Midwife agent: claim
files, path-overlap detection, a staleness rule, a takeover rule. Hardened it three separate times
in one evening as testing exposed defects in each version. Then searched for prior art, only
because the human said to, and found that Claude Code ships worktree isolation the harness
*enforces* with four blocking checks, agent teams whose shared task list uses real file locking for
claims, Stop hooks that block a turn until a script passes, and `/goal` conditions re-evaluated
every turn. Every one is stronger than what was built, because they are enforced rather than
remembered.

The tell was there the whole time: the problem had a generic name. "Two workers must not edit the
same file" is not a property of this repo, and problems that aren't yours usually aren't yours to
solve.

**Rule:** before building any mechanism whose description contains a generic noun — locking,
isolation, gating, scheduling, review, retry, coordination — spend one search on whether the
platform or ecosystem already has it. Do it *before* the first design, not after the third
hardening pass. The cost is one search; the cost of skipping it was hours of well-engineered
answer to a question that was already answered. Related: [[measure-fallout-before-writing-task-docs]].
