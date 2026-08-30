# `isolation: worktree` on `spike-runner` — DIED. `worktree.baseRef` kept.

**Decided:** 2026-08-31

The proposal was to add `isolation: worktree` to `spike-runner`, so that "never break a guard in
this tree — the other session repairs it into history" (`triage-rules.md`) became structural rather
than remembered. It was ranked the cheapest high-value item on the list: one line.

## DIED, three ways

**1. The base branch is wrong by default.** A subagent worktree branches "from your repository's
default branch rather than the parent session's `HEAD`". This branch is **135 commits ahead of
master** (`git rev-list --count master..HEAD`). A spike would have run against a tree 135 commits
stale and returned the result as `MEASURED`. That is worse than no isolation: it is a measurement
of a different system, laundered through the one field the whole verdict format exists to protect.

**2. Fixable, and the fix matters more than the proposal.** `worktree.baseRef: "head"` branches
from local `HEAD` instead — the docs say "use this when isolating subagents that need to operate on
in-progress work". **Set in `.claude/settings.json`.** This is a landmine under T2, which is the
front of the queue: every `claude --worktree` session on this branch would otherwise start from
`origin/master` without 135 commits of work, and the symptom would be a session that cannot find
code it was told about.

**3. Even fixed, it removes the ladder.** A worktree is a fresh checkout and carries no gitignored
files. `node_modules` is gitignored and is **987 MB** (`du -sh`). So `npm test`, `npx vitest` and
every existing verification are unavailable inside it — rungs 1 and 2 of the falsification ladder,
which is most of what a spike does. `.worktreeinclude` can copy it, at roughly a gigabyte of small
files per spike on Windows, which is not a cheap experiment by any definition.

## The mis-assignment

The incident `triage-rules.md` records — a guard broken in this tree, diagnosed by the concurrent
session as a real defect and "fixed" into history — was caused by a **session**, not by an agent.
The fix for it is T2, session-level worktrees. Applying per-agent isolation to it was solving the
right problem at the wrong layer, and the layer it was applied at is the one that cannot afford it.

`spike-runner` also has no `Write` or `Edit`; its only write path is `Bash`. The residual risk is
small and it is not worth a gigabyte.

## Reverse this if

An agent appears whose work is mechanical, repo-wide, and needs no installed dependencies — the
`refactorer` in Claude Code's own documentation is exactly that shape. `isolation: worktree` is
right for that agent and wrong for this one.
