# Prior art: most of the coordination layer already exists as first-party features

**Decided:** 2026-08-30

Built the whole apparatus from first principles across a long session, then searched for prior art
only when prompted to. **The search should have come first.** Several mechanisms hand-rolled here
are shipped Claude Code features, and the shipped versions are enforced by the harness where mine
are prose the model can choose to skip.

## What I built vs what already exists

| Built here | First-party equivalent | Which is stronger |
|---|---|---|
| `CLAIM-*.md` files, `paths` overlap check, 4h staleness takeover | **Agent teams** — shared task list where *"Task claiming uses file locking to prevent race conditions"* | Theirs. Real file locking beats markdown plus a heuristic |
| "Check claims before writing" | **Worktrees** — Claude Code *blocks* edits into the main checkout, blocks commands whose cwd resolves there, blocks git redirects, blocks unverifiable command shapes | Theirs, decisively. Isolation removes the collision class; my rule asks the model to remember |
| Build Gate as a required artifact | **Stop hooks** — *"runs your check as a script and blocks the turn from ending until it passes"* | Theirs for enforcement. Mine still carries what to check |
| Kill conditions, pre-registered and immutable | **`/goal` conditions** — *"a separate evaluator re-checks it after every turn"* | Theirs for enforcement, mine for the discipline of writing them before the spike |
| Adversarial reviewer dispatched by hand | **`/code-review`** skill, and the documented reviewer-subagent pattern | Equivalent; theirs is one command |
| Layer 1 / Layer 2 split | **Documented recommendation** — *"CLAUDE.md is loaded every session, so only include things that apply broadly. For workflows only relevant sometimes, use skills"* | Independent convergence. The split was right |

## The correction that matters

**I wrote a coordination protocol for a problem the platform solves by elimination.** The official
guidance is not "coordinate better", it is *"break the work so each teammate owns a different set
of files"* plus worktree isolation the harness enforces with four blocking checks.

That is this spec's own thesis — move rules out of prose into things the environment enforces —
and I violated it at exactly the point where I had the most confidence. The CLAIM protocol went
through three rounds of hardening in one evening, and every round was refining a mechanism that
should have been replaced rather than improved.

## What survives, because it is genuinely not covered

- **Triage and lanes.** Nothing first-party prices ceremony to decision gravity.
- **The falsification ladder** as design discipline, cheapest-rung-first.
- **The RISK VETO list** — repo-specific one-way doors are inherently local.
- **The open/settled ledger** as durable cross-session *knowledge*. Worktrees isolate files, which
  is the point, but that also means they do not share this. The ledger is what survives the
  isolation, and it is the one part of the coordination story worktrees do not replace.

## Also worth heeding

The docs warn about precisely the failure this session walked into: *"A reviewer prompted to find
gaps will usually report some, even when the work is sound... Chasing every finding leads to
over-engineering."* Eleven of twelve adversarial findings were applied. They were real, and the
spec still shrank — but "the reviewer found twelve things" is not by itself evidence that twelve
things needed changing.

## Not done, pending a human call

- `.worktreeinclude` is absent, so a worktree gets no `.env.local`. **That may be correct here**:
  the credentials in it point at the production Neon branch, and a worktree without them cannot
  reach production at all. Copying secrets into every worktree to make the dev server run is a
  real trade against RISK VETO §1.
- `isolation: worktree` is not set on the midwife subagent. It would enforce isolation per run,
  but ledger writes would then land in the worktree branch rather than being visible to
  concurrent sessions.
- Agent teams are disabled (`CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS` unset), and are experimental
  with known limitations around resumption and shutdown.

**Done:** `.claude/worktrees/` added to `.gitignore` — without it, worktree contents appear as
untracked files in the main checkout, where the concurrent session's `git add -A` would sweep them.
