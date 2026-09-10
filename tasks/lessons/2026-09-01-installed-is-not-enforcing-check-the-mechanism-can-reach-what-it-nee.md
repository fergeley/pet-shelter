# "Installed" is not "enforcing": check the mechanism can reach what it needs

**Learned:** 2026-09-01

The commit-msg hook was installed at the human's request and verified three ways — executable,
LF-only, exit 1 on a bad message, and a real `git commit` that git actually rejected. All true, and
all measured inside the worktree that carries the linter. In the **main checkout** the same
installed hook does nothing: it resolves `$(git rev-parse --show-toplevel)/scripts/commit-msg.mjs`
and exits 0 when that file is absent, and the file exists only on the unmerged branch that
introduced it. The enforcement mechanism shipped on the same branch as the thing it enforces, so it
is inert exactly while you believe you are covered.

Two adjacent traps found the same day. Git resolves hooks against the **common** git directory, so
a worktree does not isolate them — installing from `.claude/worktrees/` arms the main checkout and
every other worktree at once. And `core.autocrlf=true` checks shell hooks out with CRLF, making the
shebang `#!/bin/sh\r`, which is a bad interpreter on any POSIX host; that one was invisible on this
machine and would have surfaced only in CI or on someone else's laptop.

**Rule:** this extends *"moving a rule into a mechanism requires naming who enforces it"* by one
step — having named the enforcer and installed it, verify it can **reach its dependencies from
every checkout that will run it**, not just from the one you built it in. The check is one line
(`test -f <the dependency> && echo enforcing || echo inert`) and it belongs in the ledger entry
next to the install. Prefer failing open when the dependency is missing, or a partial checkout
turns into a hook that blocks every commit for a reason nobody can read — but then say out loud,
in writing, that fail-open means unenforced.
