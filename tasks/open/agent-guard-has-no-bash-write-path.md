# The agent guard cannot see a write made through Bash

**Status:** open · opened 2026-08-31 · MEASURED, from the 2026-08-31 grinder run

`.claude/hooks/agent-guard.mjs` matches `Edit|Write|NotebookEdit` for `test-writer`. Auto mode
instructs agents to make file changes with `sed`, heredocs and short scripts instead — `test-writer`
confirmed receiving that instruction and following it. Two files created, one hook invocation
logged. **Every write it made through Bash was invisible to the guard.**

Covering `Bash` with a regex is a blocklist over redirects, `tee`, `sed -i`, `cp`, `mv`, and every
interpreter with a file API. A blocklist is only as good as its author's imagination, and this one
would also be **wrong**: the same run modified `prisma/env.ts` five times to mutation-test its own
suite, reverting each inside a `finally` and verifying `git status` clean. That is the only way to
get a discriminating red run on code that already works, which `test-writer`'s contract demands.
A step-level block would have prevented the best thing that run did.

**The shape that fits:** a `SubagentStop` hook that fails when the agent finishes with product-code
changes in the tree. It permits mutate-and-restore and forbids mutate-and-leave, which is the
invariant that actually matters. Claude Code converts a `Stop` hook in subagent frontmatter to
`SubagentStop`, so it can stay scoped to the agent rather than binding every session.

Unresolved before building it: what "product code" means for an agent legitimately editing
`tests/` (diff the tree against the pre-run state, or hard-code the excluded paths), and whether a
`SubagentStop` denial is surfaced usefully or just ends the run.

**Settles when:** a `SubagentStop` guard exists and has been observed failing a run that left a
product file modified, and passing one that mutated and restored.
