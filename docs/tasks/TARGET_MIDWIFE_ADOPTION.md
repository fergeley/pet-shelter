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
cat CLAUDE.md .claude/skills/midwife/SKILL.md .claude/templates/*.md tasks/README.md | wc -l  # 597
wc -l < CLAUDE.md                                                                            # 56
wc -l < .claude/skills/midwife/SKILL.md                                                      # 242

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

**Drift, 2026-08-31 (end of day):** spec **607**, ledger **22 decisions / 8 open**, suite
**682 passed, 50 files**. The +10 on the spec is `fa93de3` and `60ce541`; the agent roster, the
skill conversion and the whole guard episode added zero to this scope. Open items are back to their
registered count — two were opened and both closed the same day. The condition is a six-month
trajectory, not a per-commit ratchet, and the baseline numbers above stay at their registered
2026-08-30 values on purpose.

---

## §2 Targets, in order

### T1 — Invocation is explicit *(closed 2026-08-31 — T2 is now the front of the queue)*

The mechanics are a **skill**, not an agent: `.claude/skills/midwife/SKILL.md`, invoked by the
resident triage in `CLAUDE.md`. That dissolved this target rather than answering it. Rationale:
`tasks/decisions/2026-08-31-midwife-is-a-skill-not-an-agent.md`.

Two things it settled *by construction*, which outranks settling them by measurement:

- **`CLAUDE.md` inheritance.** A subagent starts in a fresh, isolated context. `SKILL.md` opens by
  asserting "`CLAUDE.md` holds the invariants and the four triage tests; both are loaded already" —
  guaranteed in the main conversation, unverified in a subagent. The old open entry flagged exactly
  this. The assertion can no longer be false.
- **The halt.** §3's only legal halt is "STOP and await the human". A subagent hands back to the
  *main agent*, which has the authority to answer a one-way-door question itself. In the main
  conversation the halt reaches the human, as written.

**Demoted, non-blocking.** Whether the router auto-delegates to the five remaining agents is still
unobserved, and the field reports auto-selection fires only sometimes. **Name them explicitly and
treat routing as a bonus.** One cheap measurement is still worth taking —
`tasks/open/agent-roster-routing-untested.md` — but nothing waits on it.

### T2 — Move sessions onto worktrees *(verified available 2026-08-31 — nothing is blocking it)*

The single highest-value change, and it is one flag. Every hazard in the concurrency notes —
`git add -A` sweeping another session's work, a shared index, branch switches under a running
session, injected test defects being repaired into history — exists because two sessions share one
tree.

**The blocker everyone assumed was never real.** `2026-08-31-worktree-isolation-for-spike-runner-died.md`
reasoned that a worktree carries no gitignored files, so `node_modules` at 987 MB is absent and no
verification can run inside one. Measured on 2026-08-31: creation takes **0.68s**, `node_modules` is
indeed absent, and `npm test` runs anyway — **664 tests green in 10.4s** — because
`.claude/worktrees/` sits *inside* the repo and Node resolves `node_modules` upward to
`C:\Users\User\pet-shelter\node_modules`. Secrets do not follow (`.env.local` absent, so the Neon
production branch is unreachable), and the main checkout is byte-identical before and after,
`.git/index` included. Evidence:
`tasks/decisions/2026-08-31-worktrees-are-free-and-the-guard-was-the-wrong-layer.md`.

**Do:** start each session with `claude --worktree <name>`. `.claude/worktrees/` is already
gitignored (done 2026-08-30; without it, worktree contents appear as untracked files in the main
checkout, exactly where `git add -A` would sweep them), and `worktree.baseRef: "head"` is set so a
worktree starts from this branch rather than 143 commits behind on `master`.

**First thing to check in the next session:** that `claude --worktree` actually places the checkout
*inside* the repo. Every number above depends on upward `node_modules` resolution; a worktree in a
temp directory resolves nothing and T2 goes back to being blocked.

**Commit before you switch — this is an action, not a note.** A worktree carries **committed state
only**. The probe ran 664 tests where the working tree had 682, because that work was uncommitted.
Starting a worktree session on top of an uncommitted tree means the new session cannot see any of
it, while the old tree keeps it exposed to the concurrent session'''s `git add -A`. Commit first,
with pathspecs (`triage-rules.md` §5), then `claude --worktree`.

**Then:** the claim protocol in `midwife.md` §5 becomes the shared-tree fallback it is now
labelled as, rather than the primary mechanism. If worktrees become the norm, delete it.

### T3 — `.worktreeinclude` — **settled 2026-08-31: leave it absent**

A worktree gets no `.env.local`, so it cannot reach the database. **That is a feature here**: those
credentials point at the Neon *production* branch (RISK VETO §1), so a worktree without them
cannot write to production at all. Verified absent in the 2026-08-31 probe.

The other reason to want it — copying `node_modules` in — **evaporated**: it resolves upward from
inside the repo at zero cost. `.worktreeinclude` therefore buys only the dev server, at the price of
copying production credentials into every isolated checkout. Not worth it.

**Do:** nothing. Add `.worktreeinclude` only if a worktree genuinely needs the dev server, and weigh
that against RISK VETO §1 first.

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

**Read `tasks/lessons.md` 2026-08-31 before building it.** A `SubagentStop` hook was built, tested
to 31 cases, and deleted the same day — it could not be proven to fire in the session that wired it,
and it mitigated a hazard T2 dissolves. A Stop hook here lives in `settings.json`, which the docs say
a file watcher picks up live, so it does not inherit that specific trap — but it does bind every
session on this repo, which is why `.claude/hooks/pre-commit` is still uninstalled. Ship it in an
observe mode that logs, and require a log line from a *later* session before it blocks anything.

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
