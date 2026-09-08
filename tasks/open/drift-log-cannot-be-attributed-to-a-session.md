# The drift log cannot be attributed to a session, so "read it before close" is unbounded

**Status:** open · opened 2026-09-08 · from the `/code-review` of `d163863`

`AGENTS.md`'s session-lifespan section and `.claude/skills/midwife/SKILL.md` §5 now both require
reading the drift log before the ledger write. The rule is correct and the log is not readable in
the way the rule assumes.

Measured 2026-09-08 against the live file:

```
$ wc -l "$TEMP/claude-agent-drift.log"
602

$ awk '{print substr($1,1,10)}' "$TEMP/claude-agent-drift.log" | sort -u
2026-09-05
2026-09-06
2026-09-08

$ grep -o "c--Users-User-pet-shelter" "$TEMP/claude-agent-drift.log" | wc -l
5
```

Three days in one file, and five lines from a **different checkout** of this repo. The line format
is `timestamp agent tool status path` — no session id. `.claude/hooks/agent-guard.mjs:137` keys
`DRIFT_STATE` by `input.session_id`, but `DRIFT` at line 70 is a single shared path with no
rotation and no truncation. So an agent obeying the rule at close reads every session's writes
since the file was created and cannot separate its own from a concurrent session's, or from
yesterday's.

The consequence is the one the log exists to prevent: a reader who cannot filter will either skip
the step or scan 600 lines and match on paths they recognise, which is exactly the "confirm what I
expected" failure recorded in `tasks/lessons.md` under *never grep your own verification output for
the lines you expect*.

**Not the same as the shared-tree warning.** `agent-guard.mjs:126-130` already warns about
cross-attribution when two sessions share a checkout. This is narrower and worse: the log is shared
across checkouts *and* across days, so even an isolated worktree writes into the same file.

**Options, cheapest first, none yet chosen:**

1. Add `input.session_id` to the drift line. One field; makes `grep "$SESSION" drift.log` the whole
   procedure. Does not fix growth.
2. Key the log path by session the way `DRIFT_STATE` already is. Removes filtering entirely, at the
   cost of many small files and no cross-session view.
3. Truncate or rotate at session start. Cheapest to write, and it destroys the record a *later*
   reviewer wants — the opposite of the point.

Option 1 looks right and is one line, but nothing here has been measured against a real close, so
it is a preference and not a finding.

**Settles when:** a session close reads the log, isolates its own writes by a mechanism that does
not depend on recognising paths, and the excerpt is pasted into a spike verdict — or the read rule
is narrowed to something the log can actually support.
