# `.gitignore` does not untrack a tracked file

**Learned:** 2026-09-02

A concurrent session reported that `.env.example` was force-added on two local worktree branches
only, absent from master and every pushed branch, and asked which branch should carry a fix. It is
tracked on all of them, and has been since 2026-08-26. `.gitignore:34` (`.env*`) matches the path,
so `git status` and `git check-ignore` both call it ignored — while it is tracked, committed, and
present in every tree.

The wrong conclusion was about to send a correct fix to the wrong branch.

**Rule:** ignore rules apply to *untracked* files only. To answer "is this file in this branch",
ask the tree — `git ls-tree -r --name-only <ref> | grep -x '<path>'` — never the ignore machinery
and never `git status`. When a peer reports a repository fact, re-derive it before acting: this one
was three commands, and two of the three claims did not survive.
