# `tasks/lessons.md` is split one-file-per-lesson

**Decided:** 2026-09-09

Closes `tasks/open/lessons-md-collides-like-the-old-ledger.md`, open since 2026-09-01 and
escalated 2026-09-02 when it was found to cost a pull request its entire CI run.

## The defect

`lessons.md` was written by every session under one rule — "after a human correction, append the
pattern" — which made it append-only at a single point by design. Concurrent branches therefore
conflicted on prose where nothing disagreed and both sides were wanted. Observed, not predicted:
`git merge-tree --write-tree` reported `CONFLICT (content): Merge conflict in tasks/lessons.md`
while `.claude/agents/atomic-commit.md`, edited by both sessions, merged clean because they
touched different regions.

What escalated it: GitHub runs `pull_request` workflows against the **computed merge commit**, and
a conflicted PR has none. PR #3 got no Actions run at all — only Vercel's checks. So the cost was
never "someone resolves a conflict by hand"; it was that a prose collision silently disabled the
verification pipeline for the branch, including the job that would have proved the new
commit-message gate worked.

## The options, and why option 1

The open entry listed three. The human picked the first on 2026-09-09.

1. **Split it the way the ledger was split.** Removes the conflict by construction, no protocol
   needed. It is the fix already proven on `open/` and `decisions/`, and this was its second
   occurrence — which is the threshold `AGENTS.md` sets for abstracting rather than tolerating a
   duplicate.
2. `tasks/lessons.md merge=union` in `.gitattributes`. One line, but union merge is unordered and
   interleaves silently, which is wrong for dated prose and hides the thing it fixes.
3. Leave it and resolve by hand. Known to cost a full CI outage per conflicting PR.

## How the split was done

Mechanically, with the round-trip asserted rather than assumed — the failure mode of a careless
split is a silently dropped lesson, which is the same loss the ledger split existed to prevent.

- 97 `##` sections parsed → **97 files written**, `tasks/lessons/YYYY-MM-DD-<slug>.md`.
- **Zero slug collisions** and **zero body mismatches**: every body was read back off disk and
  compared byte-for-byte against its source section. 94,782 bytes of body content.
- One heading — "Read the branch you are merging into before you build on the one you left" —
  carried no date in the heading. It took the `**2026-09-03.**` its own body already stated
  rather than being guessed at or dropped.
- The old header claimed "Newest first" while entries were in fact appended at the tail. The
  file was **not** re-sorted: the open entry had already established that re-sorting to satisfy a
  stale header is a whole-file rewrite that conflicts with every concurrent session. Date order
  now comes free from the filenames.

`tests/unit/lessonsLedger.test.ts` enforces the layout: filename shape, an H1, a `**Learned:**`
date that matches the filename, and that `tasks/lessons.md` does not come back.

## What this does not fix

`tasks/todo.md` has the identical defect — one file, single append point, written by every
session — and is now the only remaining instance. It was left alone deliberately: it is 499 lines
of work-stream prose whose structure is less uniform than the lessons file, so splitting it is its
own task rather than a ride-along. Noted in `tasks/README.md` and at the top of `todo.md`.
