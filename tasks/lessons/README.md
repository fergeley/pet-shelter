# Lessons

Patterns worth not relearning. **One file per lesson**, named
`YYYY-MM-DD-<slug>.md`, where the date is when the lesson was learned.

    tasks/lessons/2026-09-08-a-waitfor-assertion-proves-the-frame-it-sampled.md

```markdown
# <the lesson, as a sentence>

**Learned:** YYYY-MM-DD

<what happened, concretely enough that someone can check it>

**Rule:** <what to do differently, stated as a shape rather than an intent>
```

## Why one file per lesson

This was a single `tasks/lessons.md` until 2026-09-09, and it carried the exact defect the
ledger was restructured to remove. Every session appends "after a human correction", so every
session wrote to the same region of the same file, and concurrent branches conflicted on prose
where **nothing disagreed and both sides were wanted**.

The cost was not the manual resolve. GitHub runs `pull_request` workflows against the computed
merge commit, and a conflicted PR has none — so a conflict here meant a pull request got **no
Actions run at all**. A prose collision silently disabled the entire verification pipeline for
that branch. Recorded at the time in `tasks/open/lessons-md-collides-like-the-old-ledger.md`,
now closed by `tasks/decisions/2026-09-09-lessons-become-one-file-per-lesson.md`.

One file per lesson makes that impossible by construction: two sessions never touch the same
path, and git merges the directory without a merge driver, a lock, or a protocol. It is the same
fix already proven on `open/` and `decisions/` — see `tasks/README.md`.

## Reading and writing

- **Writing:** create a new file. Never append to an existing one you did not write, and never
  reorder or rewrite the directory to satisfy a sort order — the old file's header claimed
  "newest first" while entries were in fact appended at the tail, and re-sorting to match a
  header is a whole-file rewrite that conflicts with every concurrent session.
- **Reading:** `ls tasks/lessons/` is chronological, because the filename leads with the date.
  Read the ones near your task; the directory is not meant to be read end to end.
- **This is not the ledger.** `tasks/open/` and `tasks/decisions/` hold live state and settled
  decisions and are read as state. Lessons are advice to a future session and bind nothing.
  The contract for the ledger proper is `tasks/README.md`.

## Provenance

The 97 entries dated on or before 2026-09-08 were split mechanically out of the original
`tasks/lessons.md`. Each body round-trips byte-for-byte against its section in that file; the
split was verified on 97 sections with zero slug collisions and zero body mismatches. One
heading carried no date in the heading itself and took the `**2026-09-03.**` its body already
stated.
