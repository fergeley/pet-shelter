# `tasks/lessons.md` still has the collision defect the ledger was restructured to remove

**Status:** open · opened 2026-09-01

`tasks/README.md` explains that the ledger became one-file-per-entry because two newest-first files
meant "every session appended to the *same region of the same two files* — a guaranteed conflict
whose losing write is silent." The ledger was fixed. **`lessons.md` was not**, and it is written by
the same sessions under the same rule ("after a human correction, append the pattern"), which makes
it append-only at a single point by design.

Observed, not predicted *(2026-09-01)*: `git merge-tree --write-tree origin/feat/tnrm-rehabilitation
feat/commit-message-standard` — a dry run that touches no ref and no working tree — reports

```
Auto-merging .claude/agents/atomic-commit.md
Auto-merging tasks/lessons.md
CONFLICT (content): Merge conflict in tasks/lessons.md
```

Both branches appended entries dated 2026-08-31/2026-09-01 to the tail. `atomic-commit.md` merged
clean even though both sessions edited it, because they touched different regions. The conflict is
purely positional: nothing disagrees, both sides are wanted, and the resolution is "keep both
blocks".

That is what makes it worth an entry rather than a shrug. A conflict where both sides are correct
trains whoever hits it to resolve fast and carelessly, and the failure mode of a careless resolve
on an append-only file is a **silently dropped lesson** — the same loss the ledger split was
designed to make impossible.

**Options, in the order they should be considered:**

1. Split it the way the ledger was split: `tasks/lessons/<YYYY-MM-DD>-<slug>.md`, one file per
   lesson. Removes the conflict by construction, no protocol needed. Costs a pointer update
   wherever `lessons.md` is named (`CLAUDE.md` "Preferences", `tasks/README.md`).
2. Add `tasks/lessons.md merge=union` to `.gitattributes`. One line, keeps both sides
   automatically — but union merge is unordered and silently interleaves, which is wrong for dated
   prose and hides the very thing it fixes.
3. Leave it and resolve by hand each time. Viable only while the entries stay rare.

**Settles when:** the human picks one, or the file is split. Until then, resolve conflicts in it by
keeping **both** sides and re-sorting by date — never by taking one.
