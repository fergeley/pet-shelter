# A worktree cut from a feature branch is not behind master, it is beside it

**Learned:** 2026-09-16

A brief told the session to follow
`2026-09-14-a-worktree-cut-from-head-starts-behind-origin`: run `git status -sb` in the new
worktree, and if it says `behind`, `git merge --ff-only origin/master`. The main checkout was on
`feat/pet-form-birth-date`, so `EnterWorktree` (with `worktree.baseRef: "head"`) cut the branch
from that feature's `942f627`. `git status -sb` printed `## worktree-fix-pending-queue-nric-select`
and nothing else. A fresh worktree branch has no upstream, so there is nothing for it to be
`behind`, and the check passed while the branch carried three unrelated commits and lacked
`5b2672a`, the commit the brief was verified against. `--ff-only` would have refused anyway:
`942f627` is not an ancestor of `origin/master`.

The 2026-09-14 lesson was right about its own case, a main checkout sitting *on* `master` and
behind it. It reads as general, and its test only detects that case.

**Rule:** in a new worktree, ask git the actual question —
`git merge-base --is-ancestor HEAD origin/master` must succeed *and*
`git rev-parse HEAD origin/master` should print one hash twice. If HEAD is not an ancestor, the
branch came from somewhere else. On a branch this session just created, with an empty
`git status --porcelain`, move it with `git reset --hard origin/master`: nothing on it is anyone's
work yet. On any other branch, stop and look.
