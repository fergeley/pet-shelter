# Six agent descriptions now compete in a dispatcher that has never been observed routing

**Status:** ASSERTED · opened 2026-08-31

`.claude/agents/` went from one file to six on 2026-08-31 (see
`tasks/decisions/2026-08-31-agent-roster-ported-and-pruned.md`). Each description was written to be
disjoint from the others, and three were tightened after a first pass specifically to stop them
poaching: `ui-critic` now excludes general diff review, `test-writer` now excludes deciding whether
a change is safe, `schema-auditor` now excludes authoring the change it surveys. That disjointness
is **reasoned, not observed.**

**MEASURED, 2026-08-31:** all five new agents became available to the Agent tool *in the session
that created them*, with no restart. This falsifies the stated reason in
`docs/tasks/TARGET_MIDWIFE_ADOPTION.md` T1 — "agents are enumerated at startup and the file was
created mid-session" — which is why every earlier test drove the spec by hand. Enumeration is live.
**Availability is not routing:** being listed proves the file parsed and registered, and proves
nothing about which agent a router picks for an unlabelled task.

The plausible collisions, in order of likelihood after the tightening:

1. `midwife` vs. `spike-runner` — both match "test this assumption". The intended split is that
   `spike-runner` requires the assumption *and* its kill condition to already exist. Untightened,
   because narrowing `spike-runner` further would make it unreachable.
2. `test-writer` vs. `midwife` — "no existing test covers this" appears in both descriptions and
   is load-bearing in midwife's, so it cannot be removed there.
3. `schema-auditor` vs. `midwife` on a schema change, which is also a RISK VETO door and must end
   up GRAVE either way.
4. `ui-critic` vs. `/code-review` on a UI diff.

**Settles when:** a session gives a task shaped for exactly one of these, without naming an agent,
and the transcript shows which one the router picked — for at least the top two pairs. Until then
no claim that "the roster routes cleanly" may be cited as established. This does not settle
`agent-auto-delegation-unobserved.md`, which asks the prior question of whether the router
delegates at all; that one settles first.
