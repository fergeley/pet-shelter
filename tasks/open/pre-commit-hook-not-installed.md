# Two git hooks are written but not installed

**Status:** open · opened 2026-08-30 · widened 2026-09-01

`.claude/hooks/pre-commit` and `.claude/hooks/commit-msg` both exist and are both inert. Neither is
in the hooks directory, so neither does anything. One entry rather than two, because it is one
question with one answer: which hooks does the human want armed.

Installing is not a per-session choice. Git resolves hooks against the **common** git directory, so
installing from anywhere — including from a linked worktree under `.claude/worktrees/` — arms the
hook for the main checkout, every other worktree, and the concurrent session on this branch at
once. *(Verified 2026-09-01: `git rev-parse --git-path hooks` inside a worktree returns
`C:/Users/User/pet-shelter/.git/hooks`.)* That is why neither was installed unilaterally.

- `pre-commit` — blocks staged secret-bearing files and secret-shaped literals.
- `commit-msg` — enforces `docs/reference/COMMIT_MESSAGES.md`. Proven end-to-end in a throwaway
  repo: rejects a bad message, warns-but-commits a marginal one, accepts a compliant one, and
  honours `--no-verify`.

**Settles when:** the human installs them (`npm run commit:hook`, and
`node scripts/install-git-hooks.mjs pre-commit`) or says to drop them, at which point this entry
and the unwanted files go.
