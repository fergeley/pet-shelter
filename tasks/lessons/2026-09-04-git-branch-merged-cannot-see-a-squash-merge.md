# `git branch --merged` cannot see a squash-merge

**Learned:** 2026-09-04

A squash commit is not a descendant of the branch it squashed, so `--merged` omits
branches whose work is entirely on master, and `--no-merged` lists them as if they
held unshipped work. Of 21 branches here, that test found 3 finished; the real number
was 7. `worktree-sponsorship-checkout` alone had 9 commits, every one already upstream.

`git cherry origin/master <branch>` is the test that works: it marks each commit `-`
when its patch is already upstream and `+` when it is not. Zero `+` lines means the
branch adds nothing, however the ancestry looks.

The tempting shortcut is worse than useless. Comparing a branch to master across
`src/ prisma/ tests/` called two branches identical while they carried 181 and **3,644**
unmerged insertions in `.gitignore`, `skills-lock.json` and `tasks/lessons.md`. A
path-scoped diff is not a merge test, and it fails in the direction that deletes work.

**Rule:** to decide whether a branch is done, ask `git cherry`. To decide whether a
file is present, ask `git ls-tree`. Never a diff you scoped by hand.
