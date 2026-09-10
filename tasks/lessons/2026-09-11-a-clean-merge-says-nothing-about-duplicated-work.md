# A clean merge says nothing about duplicated work

**Learned:** 2026-09-11

I split `tasks/lessons.md` into one file per lesson: scripted, dry-run first, every body line
verified, 94 files. Then, about to open the PR, I dry-ran the merge against `origin/master` and got
four conflicts — none of them in `tasks/lessons/`. **Master had done the same split two days
earlier** (PR #37), in the same format, byte-verified, even resolving the same undated heading to
the same date. Two sessions converged on one design without knowing about each other.

The dangerous part was the part git called clean. Both splits kept identical content, but the
slugs diverged on long titles — master cut near 70 characters, I cut at a word boundary under 64 —
so `…visual-selection-across-dynamic.md` and `…visual-selection-across.md` are, to git, two
unrelated new files. **33 lessons would have landed twice**, silently, in a merge that reported no
trouble with that directory at all. Only diffing the *titles* across both sides found them.

The same merge showed the opposite failure. On day one I had written my plan into `tasks/todo.md`
with a full-file write, deleting 499 lines of another session's work stream I had never read. That
one *did* conflict — because master had also edited the file — and the conflict is the only reason
it did not land. Had master left `todo.md` alone, my deletion would have merged cleanly too.

Both are the same fact about git: its verdict is per path and per hunk. It catches two edits to the
same lines. It cannot see two paths that hold the same thing, and it only notices a destructive
rewrite when someone else happens to touch the lines being destroyed. "No conflict" means "no
overlapping hunks", and nothing more.

This is the second occurrence of
[[2026-09-03-read-the-branch-you-are-merging-into-before-you-build-on-the-one-you]], and it landed
while I was physically moving that lesson into its own file.

**Rule:** before any restructuring — a split, a rename, a move — run `git fetch` and read
`git log HEAD..origin/master` for work on the same thing; the restructuring may already be on
master. After merging anything that restructured, check the *set* rather than the paths: diff
titles, ids or keys across both sides, because a path-level merge will happily keep two copies.
And never full-file-write a file you have not read: a shared file holds other sessions' work below
yours, and whether the loss is caught depends on luck.
