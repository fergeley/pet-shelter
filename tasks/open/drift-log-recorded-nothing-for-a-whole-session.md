# The write-path drift log recorded nothing for a whole session, and named the wrong one

**Status:** open · opened 2026-09-22 · observed at `8d36ace` from a linked worktree

`AGENTS.md` ("Read the drift log before the close write") and `CLAUDE.md` close-out step 2 both
require a session to filter `claude-agent-drift.log` by its own id and account for every path. A
session that made three commits across eleven source files on 2026-09-22 could not: **its id appears
in no drift file at all, and none of the files it created appear either.**

## What was observed

The session id is `a17e9995-a38a-45f4-90a8-3c549790d98a` (the UUID in its own
`.claude/projects/.../tool-results/` path, which is the filter `AGENTS.md` prescribes).

    grep "a17e9995-a38a-45f4-90a8-3c549790d98a" "$TEMP/claude-agent-drift.log"   -> no lines
    grep -rh "homeAnchors|homeMalay|heroDialogMounts" "$TEMP"/*drift*            -> no lines
    ls "$TEMP/claude-agent-drift.a17e9995-"*.state                               -> no such file

Those three files were created in that session and committed. The shared log's newest line is

    2026-09-21T14:55:50.079Z 60c30e3b-8a59-44b4-bd50-bada923361d5 claude Bash M tasks/todo.md

i.e. nothing has been appended for about two hours of continuous tool use across several sessions.

**The hook is firing.** `.claude/settings.json` binds `PostToolUse` with matcher
`Edit|Write|NotebookEdit|Bash|PowerShell|BashOutput|KillShell`, `.claude/hooks/agent-guard.mjs`
exists and is executable, and its *other* log kept growing throughout:

    $TEMP/claude-agent-guard.log   mtime 2026-09-22 01:17 local
    tail -3  ->  2026-09-21T17:16:54.135Z claude Bash
                 2026-09-21T17:17:20.192Z claude Bash

So `log()` at `agent-guard.mjs:96` ran. The drift branch at `:169` did not produce a line.

**The state file written at that moment belongs to a different session, and is empty.** The only
`claude-agent-drift.*.state` touched on 2026-09-22 is

    -rw-r--r-- 1 User 0 2026-09-22 01:17  claude-agent-drift.44dc9b6b-b166-453b-a37b-cb750a6c5686.state

`44dc9b6b…` is the session that wrote `tasks/open/hero-mounts-a-quiz-and-sponsor-dialog-nothing-can-open.md`
on 2026-09-17. It is not the session running at 01:17. The file is **zero bytes**, so the
`git status --porcelain -uall` the hook ran at `:170` returned nothing for its `ROOT`.

## Why this is worse than an empty log

`AGENTS.md` already warns that an empty log is evidence of no *observed* drift rather than none.
This is a different failure: the log is not merely missing writes, it is **misattributing the
session**, and a zero-byte state file means the next call re-establishes a baseline and
"attributes nothing" by design (`:200`). A reader who follows the documented procedure — filter by
my uuid, find nothing, conclude no drift — gets a clean bill of health that was never checked.

The same hole has a second victim already. On 2026-09-22 around 00:50 local, an unidentified
session edited `src/components/layout/Hero.tsx` and wrote
`tasks/decisions/2026-09-22-hero-removes-dead-dialog-mounts.md` **in the shared checkout on
`master`**, uncommitted. Nothing in any drift log records it, so the session responsible could not
be identified from the log; a peer session was asked and confirmed it was not theirs. The log's
whole purpose is to answer exactly that question at review time.

## Not established

**ASSERTED, not observed:** that the cause is `ROOT` or `session_id` arriving wrong in the hook
payload. `ROOT` is `input.cwd || CLAUDE_PROJECT_DIR || process.cwd()` (`:123`) and `SESSION` is
`input.session_id || "nosession"` (`:144`); both come from the harness payload, which was not
captured. The stale-but-current-mtime state file under another session's id is consistent with
`session_id` being wrong, and the zero-byte content is consistent with `ROOT` pointing at a clean
tree — but neither was measured, and they are not necessarily the same fault.

Whether this is specific to a linked worktree, to a background-job session, or to both, is also
untested. The 2026-09-08 lines in the shared log carry no uuid field at all, so the attribution
field is newer than most of the file.

Related but distinct: `tasks/open/matcherless-hook-wiring-unverified.md` (only an alternation
matcher has been observed firing — this one *is* an alternation matcher, and its sibling log fired),
and `tasks/open/drift-log-credits-a-merge-to-the-session-that-ran-it.md`.

**Settles when:** a session running in a linked worktree writes a file and finds that write in
`claude-agent-drift.log` under its own `session_id` — or the close-out step that depends on the log
is changed to name what it can actually verify, and this entry records which.
