# `tasks/lessons.md` still has the collision defect the ledger was restructured to remove

**Status:** open · opened 2026-09-01 · **escalated 2026-09-02: this now blocks CI, not just merging**

`tasks/README.md` explains that the ledger became one-file-per-entry because two newest-first files
meant "every session appended to the *same region of the same two files* — a guaranteed conflict
whose losing write is silent." The ledger was fixed. **`lessons.md` was not**, and it is written by
the same sessions under the same rule ("after a human correction, append the pattern"), which makes
it append-only at a single point by design.

Observed, not predicted *(2026-09-01, re-verified 2026-09-02 against tip `00cc411`)*:
`git merge-tree --write-tree origin/feat/tnrm-rehabilitation HEAD` — a dry run that touches no ref
and no working tree — reports

```
Auto-merging .claude/agents/atomic-commit.md
Auto-merging tasks/lessons.md
CONFLICT (content): Merge conflict in tasks/lessons.md
```

`atomic-commit.md` merges clean even though both sessions edited it, because they touched different
regions. The conflict is purely positional: nothing disagrees and both sides are wanted.

## What escalated it: a conflicting PR gets no CI at all

PR #3 opened 2026-09-02 against `feat/tnrm-rehabilitation`. **No GitHub Actions run was queued for
it** — only Vercel's checks appeared. The workflow trigger is an unfiltered `pull_request:`, so the
filter was not the cause. The cause is that GitHub runs `pull_request` workflows against the
*computed merge commit*, and a conflicted PR has none:

```
$ git ls-remote origin 'refs/pull/3/*'
9165c23...    refs/pull/3/head          # head only

$ git ls-remote origin 'refs/pull/2/*'
00cc411...    refs/pull/2/head
b4f82b5...    refs/pull/2/merge         # the non-conflicted PR has both
```

So the cost of this defect is not "someone resolves a conflict by hand." It is that **the branch
adding a commit-message gate cannot run that gate in CI until the conflict is resolved** — the one
job that would prove the new `commits` check works is the job that never starts. A conflict on a
prose file silently disabled the entire verification pipeline for the PR.

## Correction: "re-sort by date" was the wrong instruction

The first version of this entry said to resolve by "keeping both sides and re-sorting by date."
That was written without reading the file's actual order. **`lessons.md` is not sorted.** Its header
claims "Newest first" and the real sequence of `##` headings runs:

```
2026-08-30 (5 entries) → 2026-08-28 (14 entries) → 2026-08-31 (2) → 2026-09-01 or 08-31 (the tail)
```

Entries are in practice **appended at the tail**, in contradiction of the header. Re-sorting the
file by date would be a whole-file rewrite that conflicts with every concurrent session, to satisfy
a header that has not described this file for a long time. Do not do it as part of resolving a
merge.

**The correct resolution for this conflict** is to keep both tail blocks and order the two blocks
relative to each other by date — theirs (two `2026-08-31` entries) above mine (three `2026-09-01`
entries) — changing nothing above the divergence point. Five entries in, five entries out.

That the entry shipped with a confidently-worded instruction its author had not checked against the
file is itself the lesson the ledger keeps relearning: an instruction is an assertion, and an
unverified assertion does not become true by being written down in a governance doc.

## Why this is worth an entry rather than a shrug

A conflict where both sides are correct trains whoever hits it to resolve fast and carelessly, and
the failure mode of a careless resolve on an append-only file is a **silently dropped lesson** — the
same loss the ledger split was designed to make impossible.

**Options, in the order they should be considered:**

1. Split it the way the ledger was split: `tasks/lessons/<YYYY-MM-DD>-<slug>.md`, one file per
   lesson. Removes the conflict by construction, no protocol needed. Costs a pointer update
   wherever `lessons.md` is named (`CLAUDE.md` "Preferences", `tasks/README.md`). **Recommended** —
   it is the fix already proven on the ledger, and this entry is the second occurrence that
   justifies it.
2. Add `tasks/lessons.md merge=union` to `.gitattributes`. One line, keeps both sides
   automatically — but union merge is unordered and silently interleaves, which is wrong for dated
   prose and hides the very thing it fixes.
3. Leave it and resolve by hand each time. Now known to cost a full CI outage per conflicting PR,
   not just the manual resolve.

**Blocked on the human (2026-09-02):** resolving PR #3's conflict requires `git merge`, which the
auto-mode permission classifier refused. The resolution above is mechanical and ready to apply; it
needs either an approved merge or a human to perform it.

**Settles when:** the human picks one, or the file is split.
