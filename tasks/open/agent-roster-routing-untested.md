# Nothing in this repo has been observed routing: not the five agents, not the skill

**Status:** ASSERTED · opened 2026-08-31 · absorbs `agent-auto-delegation-unobserved.md`

`.claude/agents/` holds five workers — `spike-runner`, `test-writer`, `schema-auditor`,
`ui-critic`, `atomic-commit` — and the mechanics are a sixth entry point, the `midwife` **skill**
(`tasks/decisions/2026-08-31-midwife-is-a-skill-not-an-agent.md`). Six descriptions compete for the
model's attention. Each was written to be disjoint, and three were narrowed after a first pass
caught them poaching. **That disjointness is reasoned, not observed.**

**FALSIFIED 2026-08-31 (later the same day):** the paragraph below is wrong, and is left as
written because it was believed when written. A new agent file created mid-session returned
`Agent type not found`, and neither a body nor a frontmatter edit to an existing agent took effect.
Definitions are snapshotted at session start —
`tasks/decisions/2026-08-31-agent-definitions-are-session-start-snapshots.md`. The premise it
falsified (`registration is not routing`) still holds; only the liveness claim is dead.

~~**MEASURED, 2026-08-31:** registration is live in both containers. Five agents added mid-session
became available to the Agent tool with no restart, and `midwife` appeared in the skills list the
moment its file moved. This falsified the premise the closed entry was built on. **Registration is
not routing:** being listed proves the file parsed, and proves nothing about what gets picked for
an unlabelled task. External reports say auto-selection "fires only sometimes".~~

Live collisions, worst first:

1. `midwife` (skill) vs. `spike-runner` (agent) — both match "test this assumption". The intended
   split is that `spike-runner` requires the assumption *and* its kill condition to already exist.
   Left untightened deliberately: narrowing `spike-runner` further makes it unreachable.
2. `test-writer` vs. `midwife` — "no existing test covers this" is load-bearing in both and cannot
   be removed from either.
3. `schema-auditor` vs. `midwife` on a schema change, which is a RISK VETO door and ends GRAVE
   either way — so this one is safe to lose.
4. `ui-critic` vs. `/code-review` on a UI diff. Worst case is two reviews.

The conversion changed the *cost* of collision 1 and 2, not their likelihood: a wrong skill
invocation continues in the same conversation and is free to correct, where a wrong delegation
spends a context window.

**Settles when:** a session is given a task shaped for exactly one of these, without naming it, and
the transcript shows what was picked — for at least the top two. Until then, **name the agent or
skill explicitly** and treat routing as a bonus; no claim that "the roster routes cleanly" may be
cited as established.
