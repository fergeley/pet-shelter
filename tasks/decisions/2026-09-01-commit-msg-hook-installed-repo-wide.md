# The commit-msg hook is installed, and it is inert until this branch merges

**Decided:** 2026-09-01

The human asked for it to be installed. `npm run commit:hook` copied `.claude/hooks/commit-msg` to
`C:/Users/User/pet-shelter/.git/hooks/commit-msg` — the **common** git directory, so it is armed for
the main checkout and every linked worktree at once, including the concurrent session on
`feat/tnrm-rehabilitation`. That was the reason it had not been installed unilaterally
(`.claude/templates/triage-rules.md` §5); it is no longer a reason, because the human decided.

**Verified installed and enforcing** *(2026-09-01)*: the file is executable, LF-only, and running
it against `added the thing.` exits 1 with the four expected rule failures.

**Verified inert in the main checkout** *(2026-09-01)*: the hook resolves its linter as
`$(git rev-parse --show-toplevel)/scripts/commit-msg.mjs` and exits 0 when that file is absent.
`scripts/commit-msg.mjs` exists only on `feat/commit-message-standard`; the main checkout is on
`feat/tnrm-rehabilitation`, whose `scripts/` holds `secrets.mjs` alone. So **nothing the concurrent
session commits is blocked today**, and enforcement switches on for every checkout the moment this
branch merges.

That fail-open guard is deliberate. A hook that blocks every commit in a checkout where its own
linter is missing is a hook failing on its installation rather than on the message — the failure
mode would be indistinguishable from a broken standard, and the first instinct would be to
uninstall it.

The consequence to accept: enforcement arrives for the other session at merge, not at install, and
it arrives without warning from that session's point of view. `AGENTS.md` now carries the pointer to
`docs/reference/COMMIT_MESSAGES.md`, which is what that session reads at its next start, and the
hook's own rejection message names the standard and `--no-verify`.

Bypass one commit with `git commit --no-verify`. Remove it with
`node scripts/install-git-hooks.mjs --uninstall commit-msg`.

Related: [[pre-commit-hook-not-installed]] — the secrets hook was **not** installed with it; the
human asked for this one, and arming a second hook that blocks another session's commits is not an
inference to make on their behalf.
