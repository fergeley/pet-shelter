# An experiment whose input equals its control can only pass

**Learned:** 2026-09-11

Checking whether a branch would survive master's new session guard, the session ran
`git fetch origin master` and then used `FETCH_HEAD` as the name for master: overlay master's
`dal.ts` with `git show FETCH_HEAD:src/lib/security/dal.ts`, run the suite. That first run was
genuine.

A later `git fetch origin` fetched every branch and rewrote `FETCH_HEAD`. Its first line — the one
`FETCH_HEAD` resolves to — was the branch the worktree was on. So `FETCH_HEAD` now meant the
session's own HEAD, `d188d0b`, and the next two experiments tested the branch against itself:

- The second "master compatibility" run overlaid the branch's own `dal.ts` onto itself, passed, and
  was reported as verified.
- A `git diff HEAD...FETCH_HEAD -- tasks/todo.md` compared HEAD with HEAD, printed nothing, and was
  read as "master has not touched this file". Master had, at the top — exactly where the session
  was about to prepend. That would have been a merge conflict, and a conflicted pull request gets
  no CI run at all.

Both results were reassurance produced by an experiment that could not have failed. It surfaced
only because a third check contradicted them: a commit that `git branch -r --contains` placed on
`origin/master` was missing from what "master" appeared to contain.

**Rule:** after fetching, name the remote-tracking ref (`origin/master`), never `FETCH_HEAD` — any
later fetch repoints it without a word. And before trusting an overlay, compare, or probe, show
that it perturbed something: for an overlay, `git diff --stat` on the overlaid file must be
non-empty (here it was 68 lines once done correctly). A check whose input is identical to its
control reports the control. See also
`2026-09-02-never-grep-your-own-verification-output-for-the-lines-you-expect`.
