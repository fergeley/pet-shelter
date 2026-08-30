# TARGET — Midwife adoption

The agent is built, hardened twice, and tested across fifteen turns. What remains is adoption:
proving it works through the real dispatcher, and moving the parts that are still prose onto
mechanisms the harness enforces.

---

## §1 Baseline audit — re-run this before trusting anything below

Every number here was measured on 2026-08-30 at `26828b5`. **Re-run these before building on this
doc**; a target doc's own baseline is the first thing to go stale.

```bash
# spec weight
cat CLAUDE.md .claude/agents/midwife.md .claude/templates/*.md tasks/README.md | wc -l   # 597
wc -l < CLAUDE.md                                                                        # 56
wc -l < .claude/agents/midwife.md                                                        # 242

# ledger
ls tasks/decisions | wc -l   # 12
ls tasks/open | wc -l        # 8

# suite
npm test                     # 629 passed, 47 files

# adoption state
grep -c 'claude/worktrees' .gitignore   # 1  (ignored)
ls .git/hooks/pre-commit 2>/dev/null    # absent — hook written, NOT installed
ls .worktreeinclude 2>/dev/null         # absent — deliberate, see T3
grep AGENT_TEAMS .claude/settings*.json # unset — agent teams disabled
```

**Standing kill condition** (registered 2026-08-30): if the spec is the same length or longer in
six months, the four-layer split failed. It is at 597 lines having absorbed two hardening passes;
the trajectory must stay downward.

---

## §2 Targets, in order

### T1 — Prove auto-delegation works *(blocks everything else)*

Nothing has ever invoked `midwife` through the real dispatcher. All fifteen drift turns and all
four litmus tests drove the spec by pasting a routing preamble into `general-purpose`, because
agents are enumerated at startup and the file was created mid-session.

**That reason is false, measured 2026-08-31:** five agents added mid-session became available
to the Agent tool immediately, no restart. Enumeration is live; the hand-driven tests were
working around something that was not happening. What is still unobserved is the *router's*
choice, which is the thing this target actually asks for.

**Do:** restart Claude Code. Run `/agents` and confirm `midwife` is listed. Then give a session a
GRAVE-shaped task *without naming the agent* — something touching production data, a contract, or
a change no existing test covers — and see whether it routes there on its own.

**Settles:** `tasks/open/agent-auto-delegation-unobserved.md`.
**If it fails:** the `description` frontmatter is the thing to fix; it was rewritten in
router-evaluable terms precisely for this, and that rewrite is untested.

### T2 — Move sessions onto worktrees

The single highest-value change, and it is one flag. Every hazard in the concurrency notes —
`git add -A` sweeping another session's work, a shared index, branch switches under a running
session, injected test defects being repaired into history — exists because two sessions share one
tree.

**Do:** start each session with `claude --worktree <name>`. `.claude/worktrees/` is already
gitignored (done 2026-08-30; without it, worktree contents appear as untracked files in the main
checkout, exactly where `git add -A` would sweep them).

**Then:** the claim protocol in `midwife.md` §5 becomes the shared-tree fallback it is now
labelled as, rather than the primary mechanism. If worktrees become the norm, delete it.

### T3 — Decide `.worktreeinclude`, and probably leave it absent

A worktree gets no `.env.local`, so it cannot reach the database. **That is a feature here**: those
credentials point at the Neon *production* branch (RISK VETO §1), so a worktree without them
cannot write to production at all.

**Do:** add `.worktreeinclude` only if a worktree genuinely needs to run the dev server. If so,
weigh it against copying production credentials into every isolated checkout.

### T4 — Install the pre-commit hook, or drop it

`.claude/hooks/pre-commit` is written and verified against all eight of its cases — blocks staged
`.env*`, credentialed DB URLs, Resend-key-shaped literals, secret assignments, and commits to
`master`; passes clean commits and bare mentions. It is **not installed**, because it binds every
session on this repo and that is not a call to make unilaterally.

```bash
cp .claude/hooks/pre-commit .git/hooks/ && chmod +x .git/hooks/pre-commit
```

**Note:** a drift-test run independently proposed a pre-commit hook as the fix for commits landing
against a red suite, having never seen this one. Two independent derivations of the same artifact
is reasonable evidence it earns its place.

**Settles:** `tasks/open/pre-commit-hook-not-installed.md`.

### T5 — Convert the Build Gate from prose into a Stop hook

The gate is the spec's most important artifact and is currently enforced by the model choosing to
emit it. A [Stop hook](https://code.claude.com/docs/en/hooks) runs a script and blocks the turn
from ending until it passes — the same move that made kill conditions immutable and staleness
derived. Candidate check: a GRAVE-labelled turn must have written a `tasks/decisions/` entry.

This is the clearest remaining instance of the spec's own thesis applied to itself.

### T6 — Finish the drift test, and answer the reporting question

Fifteen of twenty turns ran. Behaviour never drifted; **reporting** drifted once at turn 8 (a
one-word typo drew a full session-state report, plus a miscount of its own ledger) and did not
recur at turn 15 under twice the context. Two samples pointing opposite ways is not a trend.

**Do:** run turns 16–20 against the current spec and record report length per lane.
**Settles:** `tasks/open/drift-test-not-run.md`.

### T7 — Close the Postgres gap *(oldest open item, unrelated to the agent)*

Carried since 2026-08-28: the donation ledger has never run against a real Postgres. Blocked by
Docker — WSL cannot start on this machine, so `npm run test:db` has no local database.

**Do:** find a reachable Postgres (a Neon *branch* other than production, or a native install),
then `npm run test:db` and paste the excerpt.
**Settles:** `tasks/open/donation-ledger-unverified-on-postgres.md`.

---

## §3 Deliberately not doing

- **Agent teams.** First-party and it does solve shared task-claiming with real file locking, but
  it is experimental, disabled by default, has known limitations around resumption and shutdown,
  and costs materially more tokens. Worktrees plus cross-session messaging covers this workflow.
- **Deleting invariant 3** ("Deliberation is the expensive resource"). An adversarial review
  correctly found it has no mechanical consequence. It is the human's design, and a constitution
  is where non-mechanical commitments belong.
- **Patching the reporting drift with another prose rule.** The spec's own finding is that rules
  decay and artifacts do not. Fixing a decay problem with the instrument that decays is the wrong
  move; wait for T6 to say whether there is a problem at all.
