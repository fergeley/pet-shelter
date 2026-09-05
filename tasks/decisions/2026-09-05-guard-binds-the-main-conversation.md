# The guard binds the main conversation, from `settings.json`, on irreversible commands only

**Decided:** 2026-09-05 · MEASURED

**Reverses the placement half of `2026-08-31-declared-tools-are-not-a-mechanism.md`**, which reads:

> a `PreToolUse` guard wired from each agent's own frontmatter, **not** from `settings.json`. That
> placement is the decision: a `settings.json` hook binds every session on this repo including the
> concurrent one, which is the same reason `.claude/hooks/pre-commit` is written and deliberately
> not installed.

That entry stays as written; it was true when written. The cost it named is real and is now being
paid deliberately. **Authorised by the human on 2026-09-05**, after the cost was stated twice and
restated a third time before the build began. Nothing else in that entry is reversed — the
frontmatter hooks for `schema-auditor` and `atomic-commit` are untouched.

## Why the cost is now worth paying

The argument that changed it: the historical failure in this repo is not *absent* protection, it is
**uninstalled** protection. `pre-commit` is written and not installed; the `test-writer` path rule
was installed and deleted. A guard that is momentarily annoying but survives its own annoyances
beats a perfect guard nobody runs. The override (below) exists to make the annoyance survivable
without an uninstall.

## What is enforced, and what deliberately is not

Only commands with **no undo**, derived from this repo's own incident log rather than from a
general list of dangerous verbs:

| Rule | Why it cannot be taken back |
|---|---|
| `git reset --hard`, `git checkout <path>`, `git restore`, `git clean -f` | uncommitted work has no reflog; a real incident — an unquoted heredoc executed backticked text and ran a hard reset |
| `git stash` | `triage-rules.md` §5: pulls the concurrent session's work out from under a running process |
| `git commit --amend`, `git rebase`, `git filter-branch`, `git push --force` | history rewrite on a branch a second session shares |
| `prisma db push` / `db:seed` / `migrate` off localhost | no `prisma/migrations/` directory, so no down path; `.env.local` sets `NEON_BRANCH=production` |
| any git call that is unparseable or redirected (`-C`, `--git-dir`, `GIT_DIR=`) | it could be any of the above |

**Not enforced, deliberately:** `git add -A`. It is a hazard but not irreversible — `git reset`
undoes it — and the hazard it carries (the concurrent session committing staged work) was already
adjudicated at a different layer in
`2026-08-31-worktrees-are-free-and-the-guard-was-the-wrong-layer.md`. Re-litigating a closed
decision inside a new mechanism is how constraint stores diverge.

**Not enforced, deliberately:** `rm -rf`. Proposed, and dropped for lack of any incident in the log
supporting it. `triage-rules.md` says padding the veto list makes it decorative; the same applies
here.

**Not enforced:** file paths, diff-line budgets, file counts. Those were built and deleted on
2026-08-31 and nothing here revives them.

## The two orientation decisions

**1. This is a targeted blocklist, not an allowlist, and that differs from `gitWrites()` on
purpose.** `atomic-commit` may run no git write at all, so an allowlist is correct there.
The main conversation must keep doing ordinary git work; the same orientation would deny
`git commit` on every call and train the human to set the override permanently — the exact failure
this guard exists to prevent. Fail-closed is preserved where it bites: an unparseable or redirected
git call counts as destructive.

**2. Database writes are keyed on the connection, never on the verb.** `db:push:local` contains the
substring `db:push` and is safe; `db:push:unsafe` is the bare production call. A verb match would
deny the safe variants — a false-positive trainer. So an invocation is denied unless it can be
*proven* to target localhost, by naming one of the three escape hatches in `triage-rules.md` §1
(`db:push:local`, `db:seed:local`, `test:db`) or by carrying an explicit localhost `DATABASE_URL`.
**Absence of proof is production.** The command string is inspected; no env file is read and no URL
is ever logged (RISK VETO §4).

## The override is an environment variable, not a repo file

`MIDWIFE_ALLOW_IRREVERSIBLE`, set by the human when launching Claude Code. A repo-file override
would be no override at all: the party being fenced writes repo files. Shell state does not persist
between tool calls in this harness, so an agent cannot set it mid-session.

**Every honoured override is logged.** A variable set persistently (`setx`) would otherwise disable
the fence silently, which is this repo's recurring failure shape rather than a hypothetical.

## What was measured, and what it corrected

Kill conditions were registered in `tasks/open/CLAIM-main-session-irreversible-guard.md` before the
probe. **None of the three fired.**

**A `settings.json` PreToolUse hook fires in this repo — first evidence, ever.** The liveness log
had held exactly one line since 2026-08-30. It now reads:

    2026-08-30T18:08:54.747Z test-writer Write
    2026-09-05T02:34:28.197Z main Bash
    2026-09-05T02:34:52.594Z main Bash cmdlen=101

**And `settings.json` hooks hot-reload mid-session.** The hook was wired one tool call before the
line above appeared. This is the opposite of frontmatter hooks, which load from the definition as
it stood at session start
(`2026-08-31-agent-definitions-are-session-start-snapshots.md`). **The two wiring surfaces have
different liveness rules, and that distinction was not previously recorded anywhere.**

*Would have shown instead, if false:* the 2026-08-30 line alone, unchanged.

`cmdlen=101` settles the condition that would have killed the design outright: the main-session
payload carries `tool_input.command`, so there is something to parse. Length was logged, never
content — a command string can carry a connection string.

**Observed denying, live:** `git checkout package.json`, run against a file with no uncommitted
changes so the probe was a no-op whether or not the guard held. It was refused with the message
above. `triage-rules.md` §5 forbids breaking a guard to prove it works; choosing a target where
success and failure are both harmless is how that rule is satisfied rather than waived.

## The drift log, and why it never denies

A `PostToolUse` hook on `Edit|Write|NotebookEdit` appends every write path to
`claude-agent-drift.log`. It records, it does not judge. Path-based step rules were built and
deleted here for blocking correct work that merely looked out of scope; a log survives that finding
because it costs nothing at the step and cannot train reflex approval.

Its consumer is session close (`CLAUDE.md` invariant 9) — a log nobody reads is furniture:

    cat "$TEMP/claude-agent-drift.log"      # Windows; $TMPDIR elsewhere

## Reverse this if

The denial fires on ordinary work often enough that the override starts being set by default. That
is the uninstall in slow motion, and it means the rule set is too broad — narrow it, do not disable
it. Full reversal is deleting the `hooks` key from `.claude/settings.json`.

## The false positive the shakedown found, and the fix

Writing the ledger entry for this decision was **denied by the guard it documents**. The heredoc
body carried the text of a working-tree discard, and the scan matched command text anywhere in the
command string.

This is the failure mode that kills guards. This repo writes its ledger with `cat > entry.md
<<'EOF' ... EOF`, so prose quoting a destructive command is routine, not exotic — the rule would
have fired several times a day, been overridden by reflex, and then uninstalled.

**Fix:** `stripHeredocBodies()` removes heredoc bodies before scanning. A heredoc body is data
written to a file, never a command that runs. The line that *opens* the heredoc is still judged,
and so is everything after the terminator — both pinned by tests.

**Deliberately different from `gitWrites()`**, which denies the word "git" even inside a quoted
string and has a test saying so. That trade is right for `atomic-commit`, whose entire job is
emitting command text it must not run. It is wrong for the main conversation, and the difference is
the point: the same act gets the same verdict, but *text about* an act is not the act.

## Two review rounds found 19 defects that 25 green tests did not

Recorded because the pattern matters more than the fixes.

**Round 1 — adversarial probe, written by the author of the code.** Nine crafted cases, eight
wrong: five fail-open (`clean -xdf`, `reset --merge`, a compound `&&` that exempted a production
seed behind a local one, a quoted heredoc marker that swallowed later commands, and the heredoc
fix's own bypass), two false positives, one latent (`ROOT` derived from this process's cwd while
the harness sends `cwd` in the payload — it worked only because cwd happened to be the repo root).

**Round 2 — independent review, given the diff and not the reasoning.** Twelve more, ten
confirmed by direct probe: `git -c k=v <destructive>` resolved the subcommand to the option's
value and fell through to `default:`; force-push missed `+refspec`, `--force-with-lease=`, `-fu`
and `--mirror`; `git switch` had no case at all; `checkout -b docs` was denied because `docs/`
exists; `stash` read `tokens[1]` instead of the token after the subcommand; `segments()` ignored a
single `&`; **a heredoc piped into an interpreter had its body stripped, so `bash <<EOF` hid
everything**; `MIDWIFE_ALLOW_IRREVERSIBLE=False` turned the override ON; the drift state file was
unkeyed and shared across concurrent sessions.

**The two that matter most, both mine, both invisible from the inside:**

1. **The drift log was rewritten to observe the tree, and the matcher that feeds it was left at
   `Edit|Write|NotebookEdit`.** The mechanism was correct and unreachable. The probe tested the
   function directly and so could never see it. Fixed, and now asserted against
   `.claude/settings.json` itself, because the capability lives in the wiring and no unit test can
   invoke Claude Code.
2. **The delta compared only the two-character porcelain status.** A file already ` M` and edited
   again produced no line, so six consecutive patches to one file logged nothing. The snapshot now
   carries mtime.

**The lesson, which is the reason this section exists:** the first probe was written by whoever
wrote the code, so it attacked the cases that author had already considered. It found eight
defects and was blind to twelve more, including the one that made the headline fix inert. Different
information, not a different mood — the reviewer had the diff and not the reasoning that produced
it. Any future change to this guard gets both passes.

## Round 3, and what the rate of findings means

A third independent pass found **fourteen more**, ten confirmed by probe. The severe ones:
the override had become a blocklist of falsy words, so any unrecognised value (`disabled`, a
typo) switched the fence off silently; `checkout -f <branch>` discarded every modified file while
the `switch` case denied the identical flags; the localhost proof matched `localhost` anywhere
after `DATABASE_URL=`, so a production host with a database *named* localhost was exempt; an
interpreter reached by path (`/bin/bash <<EOF`) still had its body stripped; `db:migrate:faqs`
applies DDL to production under a name the rules did not cover; `rm -rf src` was allowed while
`git clean -fd`, which deletes strictly less, was denied; and read-only commands that merely
*mentioned* a dangerous string were denied — that one fired against the reviewer's own `grep`.

**Totals: 8, then 12, then 14.** The rate did not fall.

That is a statement about the architecture, not the code. A **blocklist over free-form shell
text has an unbounded defect surface**: every pass finds another spelling, another wrapper,
another quoting form. `gitWrites()` avoided this by being an allowlist — "anything not on this
list is a write until proven otherwise" — and its comment says exactly why: *"a blocklist is only
as good as its author's imagination."* This guard took the opposite orientation deliberately, to
avoid denying `git commit` on every call, and has now paid for it three times.

**The open architectural question** is whether the git half should invert to an allowlist of
subcommands that are always safe, denying everything else pending an override. That converts an
unbounded set of silent holes into a bounded set of noisy denials that shrinks as the allowlist
fills. It is a different failure mode, not a strictly better one, and choosing it is the human's
call because the cost lands on them. Recorded here rather than acted on:
`tasks/open/guard-blocklist-orientation-unbounded.md`.
