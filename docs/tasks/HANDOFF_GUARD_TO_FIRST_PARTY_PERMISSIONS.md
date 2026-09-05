# Engineering Handoff: replacing the hand-rolled command fence with first-party permissions

- **Status as of**: 2026-09-05
- **Branch**: `master` — **nothing committed.** Seven paths modified/added in the working tree.
- **Quality gates**: `npm test` **1,314 passing / 76 files** · `npm run typecheck` clean ·
  `npm run arch:check` exit 0 · `npm run lint` **0 errors, 17 warnings** (baseline drifted from 5 by
  other sessions' work; none are in files this task touched)
- **Tree is shared.** A concurrent Claude session is live in this checkout and has modified
  `AGENTS.md`, `CLAUDE.md` and created `GEMINI.md` — **none of that is this task's.** Stage explicit
  pathspecs (`triage-rules.md` §5); never `git add -A`.
- **No verification waiver is in effect.** `AGENTS.md` is explicit that a handoff document cannot
  waive verification. Re-run the gates above before trusting any number in this file.

A `PreToolUse` hook that fenced irreversible shell commands was built, hardened five times, measured
against the project's entire command history, and then **deleted** in favour of Claude Code's own
`permissions` and `autoMode` configuration. What remains is two configuration actions only a human
can perform, and one of them undoes a regression this work introduced.

---

## 1. 🚨 Blocked on the human — do these first

### 1a. Remove the `autoMode` key from `.claude/settings.json`

**This is a live regression introduced by this work.** The key was added on the belief that no
`autoMode` profile existed. One does: `~/.claude/settings.json` carries **23 `environment` entries
and 3 `soft_deny` entries**, including a warning that this repository is **public** and a PDPA
data-location entry.

Array-valued settings appear to be **replaced by the highest-precedence source, not merged** — the
`$defaults` sentinel exists to re-inherit built-ins and there is no `$user` equivalent, which is the
tell. If that reading holds, the project block is discarding all 23 user entries for this repo.

**Marked ASSERTED, not measured.** It could not be measured, because a `soft_deny` entry added by
this same change reads *"Editing .claude/settings.json … should not be changed casually by the party
it constrains"* — and it refused the edit that would have removed it. That does prove the added
entries are live and honored.

Keep `permissions.deny` and `permissions.ask`; remove only `autoMode`.

### 1b. Correct four entries in `~/.claude/settings.json`

Four `autoMode.environment` entries rest on the premise *"no git remotes configured on this
checkout"*. Re-verified false on 2026-09-05:

```
$ git remote -v                                  origin  git@github.com:fergeley/pet-shelter.git
$ git rev-parse --abbrev-ref master@{upstream}   origin/master
$ git symbolic-ref refs/remotes/origin/HEAD      refs/remotes/origin/master
```

The entries are **Repository visibility** (~line 13), **Default / protected branches** (~16),
**Source control** (~19) and **Trusted repo** (~31). The cascade is a safety gap, not cosmetic:
visibility falls back to "assume private" on a repository that `gh repo view` reported **PUBLIC** on
2026-09-01, so `master` is registered as protected nowhere.

The classifier refuses **all** agent edits to that file. Either edit it by hand or re-run
`/auto-mode-setup`. Long-standing item — see the auto-memory note
`auto-mode-profile-claims-no-git-remotes`.

---

## 2. 📦 What shipped (uncommitted)

| Path | Change |
|---|---|
| `.claude/settings.json` | `permissions.deny` (13 rules) + `permissions.ask` (9); `hooks.PreToolUse` **removed**; `hooks.PostToolUse` kept. Also the `autoMode` key that §1a removes. |
| `.claude/hooks/agent-guard.mjs` | Fence deleted. Retains the two agent rules (`schema-auditor`, `atomic-commit`) and a rewritten **drift log**. |
| `tests/unit/agentGuard.test.ts` | 14 → **68 tests**. Now the *specification* the permission rules were derived from, not the enforcement. |
| `tasks/decisions/2026-09-05-guard-binds-the-main-conversation.md` | The build, its kill conditions, and the 34 defects three review rounds found. |
| `tasks/decisions/2026-09-05-first-party-permissions-replace-the-hand-rolled-fence.md` | The reversal, plus a same-day correction of a false claim it originally made. |
| `tasks/open/triage-rules-section-2-is-stale.md` | Defect found in passing, filed not fixed. |
| `tasks/open/CLAIM-…-irreversible-guard.md` | Claim file; **delete at commit**, per `tasks/README.md`. |
| `tasks/lessons.md` | Six patterns appended under `## 2026-09-05`. |

### The drift log is the piece worth keeping

`PostToolUse` on `Edit|Write|NotebookEdit|Bash|PowerShell|BashOutput|KillShell`. It **never denies**,
so it has no false-positive cost, and it observes the **tree** (`git status --porcelain` plus mtime)
rather than tool inputs — which is why it sees the `cat >` and `sed -i` writes auto mode actually
steers toward. Reading `tool_input.file_path` had recorded **1 file of 6**. Cost ~120 ms per call.

```bash
cat "$TEMP/claude-agent-drift.log"      # Windows; $TMPDIR elsewhere
```

Its intended consumer is session close (`CLAUDE.md` invariant 9). **Nothing reads it automatically
yet** — wiring that would mean a line in `CLAUDE.md`, which is shared with the live session and was
deliberately not touched.

---

## 3. 📉 Why the fence was abandoned — the numbers

| Pass | Defects found |
|---|---|
| Adversarial probe (same author) | 8 of 9 crafted cases wrong, 5 fail-open |
| Independent review #1 | 12 |
| Independent review #2 | 14 |

The rate never fell. Root cause of every one: **it parsed shell text without a shell parser.**

**Corpus replay** — all 4,917 distinct commands / 5,028 invocations from 71 session transcripts in
`~/.claude/projects/c--Users-User-pet-shelter/**/*.jsonl`:

- Before fixes: **151 denied (3.02%)**, ~85 of them legitimate work (`git add prisma/seed.ts` matched
  a *path*; `git -C .claude/worktrees/…` is the isolation this repo recommends).
- After four fix rounds: **79 (1.57%)**, mostly true positives.

It also obstructed real work six times in ~40 minutes armed, including blocking its own disarm and
denying a `grep` for its own test file twice.

**What is honestly worse now:** `permissions` rules are prefix-matched from the start of the command,
so `cd x && git reset --hard` is not caught deterministically. That is covered only semantically, by
`autoMode.soft_deny`.

---

## 4. 🔭 Next steps, in priority order

1. **§1a and §1b above.** Nothing else should start first.
2. **Commit**, with explicit pathspecs and `git commit -F <file>` (never `-m` — five commits in this
   history have a bare `@` subject from a PowerShell here-string). Check the standard in
   `docs/reference/COMMIT_MESSAGES.md` and validate with `node scripts/commit-msg.mjs --stdin`.
   Delete the `CLAIM-` file in the same commit.
3. **Verify the `permissions.ask` rules fire.** Unmeasured. `git stash list` matches
   `Bash(git stash*)`, is completely harmless, and a prompt appearing proves the rules are live.
   Two minutes, and it closes the last liveness gap in this work.
4. **`tasks/open/triage-rules-section-2-is-stale.md`** — §2 is a RISK VETO entry whose own
   verification command now returns the opposite of what it claims (`prisma/migrations/manual/`
   exists). While there, re-date the other seven entries; the file says to re-verify before relying
   on it.
5. **Optional, and only if you want the drift log to be read:** one line in `CLAUDE.md`'s session
   close. Deliberately skipped here because `CLAUDE.md` is shared with a live session.

## 5. ⚠️ Traps specific to this work

- **`~/.claude/settings.json` cannot be edited by an agent at all.** `.claude/settings.json` takes an
  **Edit** but refuses a Bash/node script writing the same bytes. Use the `update-config` skill.
- **`settings.json` hooks hot-reload mid-session.** Agent *frontmatter* hooks do not — those are a
  session-start snapshot. Two wiring surfaces, two liveness rules.
- **Your own background jobs skew the suite.** A run during two corpus replays reported 23 failures
  over 84 minutes; with nothing else running, 1,314 passed in 58 seconds. Duration is the tell.
- **Do not revive the parser** if the prefix-matching gap bites. The fix is a narrowly-scoped hook
  for one specific shape, with a corpus replay before it is armed.

---

## 6. Corrections and measurements, 2026-09-05 (second session)

Written after re-running every gate and re-reading the files. Three claims above needed
correcting; two open items are now closed.

### 6a. §1a is DONE; §1b is NOT

The `autoMode` key is gone from `.claude/settings.json` — `permissions.deny` and
`permissions.ask` survive it, as §1a required.

`~/.claude/settings.json` is **unchanged**. All four entries still rest on the false
"no git remotes configured" premise, re-verified false again today: `origin` is
`git@github.com:fergeley/pet-shelter.git`, `master@{upstream}` is `origin/master`, and
`refs/remotes/origin/HEAD` resolves to `refs/remotes/origin/master`. The classifier still
refuses agent edits to that file, so this remains blocked on the human.

### 6b. "Fence deleted" is imprecise — it is dormant, not deleted

The §2 table says `agent-guard.mjs` had its fence deleted. It does not. The file is still
790 lines and `irreversibleGit()`, `irreversibleDb()` and `recursiveDeletes()` are still
called together in an unguarded block that is explicitly *"not keyed on who asked"*.

What actually changed is the **wiring**, and the two wirings now differ:

- `.claude/settings.json` wires the script as **`PostToolUse`**. That block ends in
  `allow()`, so the fence is **never reached** for the main conversation. The handoff's
  claim is true *for the main conversation only*.
- `.claude/agents/{schema-auditor,atomic-commit}.md` still wire the same script as
  **`PreToolUse`**. Those two sub-agents therefore still run the full parser — the one
  whose defect rate never fell across three review passes and which denied 79 of 5,028
  real commands after four fix rounds.

So the parser judged unfit for the main conversation is still the enforcement path for two
sub-agents. That may be deliberate; it is not what §2 says, and nothing records the choice.

### 6c. `permissions.ask` does NOT prompt — §4 item 3 closed, negatively

`permissions.deny` **is live and enforcing**: `Read(./package-lock.json)` was refused with
*"File is in a directory that is denied by your permission settings."* Same object, same
file, so the `ask` array is being parsed too.

`permissions.ask` did not gate anything:

| Probe | Rule it matches | Result |
|---|---|---|
| `git stash list` (×2) | `Bash(git stash*)` | ran, no prompt |
| `git branch -D zz-probe-does-not-exist-…` | `Bash(git branch -D*)` | ran, no prompt |

The session runs at `"permissionMode":"auto"`. The second probe is the informative one: it
leads with a destructive verb and prefix-matches the rule, yet still ran unprompted (it is
a no-op only because the branch does not exist). The reading that fits both is that under
auto mode `ask` entries are advisory input to the classifier rather than a hard prompt.

**The probe §4 suggested cannot answer the question it was set.** `git stash list` was
chosen for being harmless, and harmlessness is exactly what makes the classifier wave it
through on its own merits. A decisive probe needs a genuinely destructive command as the
**leading token** — and it cannot be aimed at a scratch repo, because `git -C <scratch>
stash push` no longer prefix-matches the rule (§3's prefix-matching gap, from the other
side). Aimed at this repo it would destroy the concurrent session's uncommitted work, so
it was not run. This gap stays open.

### 6d. Two tests were red; both are fixed in this commit

`npm test` was **1,312 / 1,314** on arrival, not the 1,314 §0 claims. Both failures were
in `tests/unit/agentGuard.test.ts` and both were artefacts of this work:

1. `tells the auto-mode classifier what this repo's one-way doors are` asserted
   `settings.autoMode.environment[0] === "$defaults"` — it **required the very key §1a
   told the human to delete**. The test encoded the regression as a requirement. Rewritten
   to pin the key's absence.
2. `does not read a new branch name as a path to be discarded` asserted
   `git checkout docs` → `ALLOW`. It went red because **this handoff document**, untracked
   at `docs/tasks/`, made `docs/` dirty. Its own comment warns that "an assertion that only
   holds while this tree happens to be dirty is not a test" and it then depended on the
   tree being *clean*. Moved into the scratch-repo block, where cleanliness is guaranteed.

Gates after the fix, nothing else running: `npm run typecheck` **0** · `npm run arch:check`
**0** · `npm test` **1,314 / 76 files, 46.5s** · `npm run test:all` (unit + integration +
components) **1,424 / 87 files** · `npm run lint` **0 errors, 17 warnings** (baseline).
