# You cannot test an agent change in the session that makes it

**Learned:** 2026-08-31

A `Stop` hook was wired into `.claude/agents/spike-runner.md`, the agent was run three times, and
the liveness log gained nothing. The obvious reading — "frontmatter `Stop` hooks do not fire on this
version" — was wrong, and would have killed a sound design. Two further probes found the real cause:
a marker appended to the agent's *body* was also ignored, and a brand-new agent file returned
`Agent type not found`. Definitions are snapshotted at session start
(`tasks/decisions/2026-08-31-agent-definitions-are-session-start-snapshots.md`), so all three runs
executed the pre-edit definition while reporting success.

The trap is that the failure is **silent and looks like a verdict**. An empty log is exactly what a
broken mechanism produces, so the measurement appears to have worked.

**Rule:** before concluding that a mechanism does not fire, prove the run actually loaded the version
you wrote. Change something *observable in the output* — a marker line in the body — and check for it
in the same run. If the marker is missing, the instrument is stale and the measurement is void, not
negative. And for anything the harness loads rather than the build: ship it in an observe mode that
logs what it would have done, and flip it to enforcing only after a *later* session's log proves it
fires.
