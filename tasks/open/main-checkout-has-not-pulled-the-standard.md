# The main checkout has not pulled, so the commit-msg hook is still inert

**Status:** open · opened 2026-09-02 · **needs a human; no agent in a worktree can do it**

The commit standard merged into `feat/tnrm-rehabilitation` as `3c623a3`, and the fixes a code
review found merged as `dd4eb63`. `.git/hooks/commit-msg` has been installed since 2026-09-01 and
is armed for the main checkout and every worktree at once, because hooks live in the **common** git
directory.

It is still doing nothing there. The hook resolves its linter as
`$(git rev-parse --show-toplevel)/scripts/commit-msg.mjs` and **exits 0 when that file is absent**,
which is deliberate — a hook that hard-fails on a branch without the linter would block every
commit in every worktree. The main checkout has not pulled the merge, so the file is not there.

Observed 2026-09-02, not inferred: `C:/Users/User/pet-shelter/` contains `src/`, `tasks/`, `tests/`
and no `scripts/` directory at all.

**The whole fix:**

```bash
cd C:/Users/User/pet-shelter
git pull --ff-only
test -f scripts/commit-msg.mjs && echo enforcing || echo inert
```

**Why it is not already done.** A worktree-isolated Claude session cannot run git against the
shared checkout; the harness refuses the command, and refused it twice. This is not a permission
prompt that can be approved from inside the session — it needs the human, or a session that is not
worktree-isolated.

**Do it when the other session is idle.** A concurrent Claude session works in that checkout and
may have uncommitted work; `--ff-only` will refuse rather than clobber, but a pull landing mid-edit
is still worth avoiding. That session also starts having its commit messages linted the moment this
lands — `AGENTS.md` carries the pointer it reads at its next start, and until then its first
rejection arrives unannounced, naming `docs/reference/COMMIT_MESSAGES.md` and `--no-verify`.

**Settles when:** `test -f scripts/commit-msg.mjs` is true in the main checkout.
