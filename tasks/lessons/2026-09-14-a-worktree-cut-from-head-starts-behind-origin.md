# A worktree cut from HEAD starts behind origin

**Learned:** 2026-09-14

`.claude/settings.json` pins `worktree.baseRef: "head"`, so `EnterWorktree` branches from the
local checkout's HEAD, not from `origin/master`. The main checkout was fourteen commits behind
origin — two merged pull requests, including the one whose files the task's spec named — and the
new worktree inherited that. Every file the spec cited was "missing" until
`git merge --ff-only origin/master` inside the worktree.

The tell was cheap: `git status -sb` prints `[behind 14]`, and the spec's paths failed a plain
`ls`. Reading the spec against the wrong base would have re-implemented a merged feature.

**Rule:** the first two commands in a new worktree are `git status -sb` and, if it reports
`behind`, `git merge --ff-only origin/master` — before opening any file the task names. A fresh
branch that nobody else holds is the one place a fast-forward is free.
