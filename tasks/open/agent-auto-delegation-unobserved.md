# Agent auto-delegation has never been observed

**Status:** ASSERTED · opened 2026-08-30

All four litmus runs invoked the spec by pasting a routing preamble into a `general-purpose`
agent, because `midwife` was not registered — Claude Code enumerates `.claude/agents/` at
startup and the file was created mid-session. So the *spec text* is measured; the *harness
wiring* is not.

Unverified: that the frontmatter `description` actually causes automatic delegation on a
GRAVE-shaped task, and that an invoked `midwife` inherits `CLAUDE.md` the same way the proxy did.

**Settles when:** a restarted session dispatches `midwife` and the run reports its own lane.
