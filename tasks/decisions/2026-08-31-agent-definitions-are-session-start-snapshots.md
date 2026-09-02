# Agent definitions are fixed at session start — you cannot test an agent change in the session that makes it

**Decided:** 2026-08-31 · MEASURED, three independent observations

**Corrects a MEASURED claim in the ledger.** `tasks/open/agent-roster-routing-untested.md` says
*"registration is live in both containers. Five agents added mid-session became available to the
Agent tool with no restart"*, and `2026-08-31-schema-auditor-has-no-shell.md` repeats it as
*"observed this session, when five agents created mid-session appeared without a restart"*. **That
does not reproduce.** In this session (VS Code extension harness, 2026-08-31), nothing about
`.claude/agents/` was live.

## The three observations

**1. A frontmatter hook edit does not take.** `.claude/agents/spike-runner.md` was given a `Stop`
hook plus three tagged `PreToolUse` variants — one `matcher: Bash`, one `matcher: "*"`, one
matcherless — each passing a distinct argv tag to the guard, so the log could say which shape
fired. `spike-runner` was then run three times, 26 tool calls in total. The liveness log gained
**zero lines**:

    $ cat "$TEMP/claude-agent-guard.log"
    2026-08-30T18:08:54.747Z test-writer Write

That one line is from the previous night. The `matcher: Bash` variant is byte-identical to the
wiring that produced it, which kills the obvious hypothesis that the missing matcher was to blame.

**2. A body edit does not take either.** `**Always end your reply with one final line:**
`Definition-version: PROBE-9F2`` was appended to `spike-runner.md`. The next run — explicitly
invited to append *"whatever your own instructions require"* — did not emit it.

**3. A new agent file is not registered at all.**

    Agent type 'guard-probe' not found. Available agents: atomic-commit, claude,
    claude-code-guide, Explore, general-purpose, Plan, schema-auditor, spike-runner,
    statusline-setup, test-writer, ui-critic

`.claude/agents/guard-probe.md` had existed on disk for a minute when that was returned.

**Would have shown instead, if false:** a `tag=matchered` / `tag=star` / `tag=bare` line per tool
call and a `tag=stop` line per run in observation 1; the `PROBE-9F2` line in observation 2; a
completed run in observation 3.

## Reconciling the earlier claim, and last night's single log line

The reconciliation is timestamps. The guard and its frontmatter wiring were committed `289be86` at
**01:58 local = 17:58Z**. The only log line ever produced is **18:08:54Z**, ten minutes later. A
session started inside that window would have snapshotted the definitions *after* they were
written, and its hooks would fire — which is what happened. The earlier "registration is live"
reading is better explained by a session that started after the files appeared than by a live
watcher.

So **`#18392` remains not-reproduced**: frontmatter `PreToolUse` hooks do fire. They just fire for
sessions that began after the definition existed.

## The consequence, which is the point of this entry

**No change to an agent — body, tools, or hooks — can be validated by the session that authors it.**
Every "I wired it and it works" claim about `.claude/agents/` is unfalsifiable in its own session,
and the failure mode is silence, not an error: the harness runs the *old* definition and reports
success. This is the same shape as the YAML parse failure recorded in `tasks/lessons.md` — a config
this repo writes, a parser this repo does not control, and absence as the symptom.

Two rules follow:

1. **Ship agent changes in an observe mode that logs rather than acts**, and flip to enforcing only
   after a *later* session's log proves the mechanism fires. `MODE` in `.claude/hooks/agent-guard.mjs`
   is exactly that switch.
2. **A verification plan whose measurement requires an agent run must name the session boundary.**
   "Run an agent and check the log" is not a step you can take after editing the agent; it is a step
   for the next session.

## What this does not establish

Whether `settings.json` hooks are live in-session — the docs claim a file watcher for those, and it
was not tested, because putting this guard in `settings.json` binds every session on this branch and
that is the thing it was deliberately built to avoid. Whether other harnesses (terminal CLI, web)
behave the same. And whether a `/hooks` review would have adopted the change mid-session.
