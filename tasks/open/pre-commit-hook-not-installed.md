# The pre-commit hook is written but not installed

**Status:** open · opened 2026-08-30 · narrowed 2026-09-01

`.claude/hooks/pre-commit` exists and is inert. It is not in the hooks directory, so it does
nothing. It blocks staged secret-bearing files and secret-shaped literals.

Installing is not a per-session choice. Git resolves hooks against the **common** git directory, so
installing from anywhere — including from a linked worktree under `.claude/worktrees/` — arms the
hook for the main checkout, every other worktree, and the concurrent session on this branch at
once. *(Verified 2026-09-01: `git rev-parse --git-path hooks` inside a worktree returns
`C:/Users/User/pet-shelter/.git/hooks`.)* That is why it was not installed unilaterally.

The `commit-msg` hook that briefly shared this entry **has been installed** at the human's request —
see `tasks/decisions/2026-09-01-commit-msg-hook-installed-repo-wide.md`. That does not carry over
to this one: `pre-commit` can reject another session's in-flight commit for a staged file, and
nobody asked for it.

**Settles when:** the human installs it (`node scripts/install-git-hooks.mjs pre-commit`) or says to
drop it, at which point this entry and the file go.
