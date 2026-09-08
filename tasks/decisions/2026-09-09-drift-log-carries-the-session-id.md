# The drift log carries the session id, so a reader can isolate their own writes

**Decided:** 2026-09-09 · opened 2026-09-08 from the `/code-review` of `d163863`, closed the next day

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

---

## Kill condition, registered 2026-09-09 before the spike ran

Option 1 rests on an assumption its own wording hides: **that an agent can obtain the session id
the hook wrote.** A field the reader cannot reproduce is not a filter, it is decoration.

`ASSERTED` — the value comes from `input.session_id`, supplied by the harness to the hook. The
agent never sees that payload. The only candidate the agent *can* read is the UUID embedded in its
own scratchpad and tool-result paths.

**KILL CONDITION.** If the session field written to the drift log does not equal the UUID the
running agent can read from its own session paths, then option 1 does not make the log filterable
by the agent that must read it, the entry is not settled by implementing it, and the fix is
recorded as cosmetic rather than closing.

**Fires on:** a live PostToolUse write whose logged session field differs from that UUID, or a
`nosession` placeholder appearing where a real id was expected.

---

## Verdict 2026-09-09 — SURVIVED, and the kill condition did not fire

**Evidence class:** MEASURED · **Ladder rung:** spike · **Context-isolated:** no (in-session)

Option 1 implemented in both hooks. The field goes after the timestamp, so the existing
assertions that match on ` main Bash ` and on a trailing path were unaffected.

The kill condition asked whether the logged id is one the reading agent can obtain. It is. Live
`PostToolUse` output during the change, from the real harness:

```
16:16:46.666Z 0569a56d-27bc-4da0-b772-4523fd31162c main   Bash  M .claude/hooks/agent-guard.mjs
16:16:47.868Z 6d9de0a7-bab8-4943-8913-ac909e83b65a claude Write M tasks/open/production-schema-has-drifted-ahead-of-master.md
16:17:01.488Z 0569a56d-27bc-4da0-b772-4523fd31162c main   Bash  M .codex/hooks/drift-log.mjs
```

`0569a56d-27bc-4da0-b772-4523fd31162c` is exactly the UUID in this session's own scratchpad path,
so `grep "<your-uuid>"` is runnable by the agent that must run it. The second line is a
**concurrent session** writing a different file in the same log at the same second — the defect
this entry described, now separable rather than merely described.

**Would have shown instead, if false:** `nosession`, or an id unrelated to the session paths.

**The test discriminates**, proven against the pre-fix hook in a scratch repo rather than by
breaking this shared tree:

```
OLD (HEAD):        2026-09-08T16:19:36.927Z main Bash ?? tracked.txt
NEW (working tree): 2026-09-08T16:19:37.759Z 0569a56d-...-4523fd31162c main Bash ?? tracked.txt
grep " <uuid> main Bash " → NO match against old, MATCH against new
```

**What this does NOT establish.** Growth is unchanged: the log is still one append-only file with
no rotation, measured at 602 lines over three days. That is now tolerable rather than fixed —
filtering by session makes length irrelevant to a reader, so no entry is left open for it. Nothing
here establishes that the Codex hook writes its session field in a live Codex session; that path
was changed symmetrically and covered only by reading, since no Codex run was available.

**Fence:** nothing parses this log. Verified by `git grep` across tracked files before changing the
format — the only readers are humans and agents running `cat`. `scripts/check-drift.ts` is Prisma
schema drift, an unrelated concept sharing the word.

**Also fixed in passing:** the Claude hook interpolated an unsanitised `input.session_id` into a
filename under `tmpdir()`. It now sanitises the way the Codex hook already did.
