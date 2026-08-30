# The agent guard's logic is verified; its firing is not

**Status:** ASSERTED · opened 2026-08-31

`.claude/hooks/agent-guard.mjs` is wired from the frontmatter of `schema-auditor`, `atomic-commit`
and `test-writer`. Its decisions are tested (25/25 payloads). Whether Claude Code executes a
frontmatter hook for a subagent on v2.1.251 is **not** tested, and there is an open report that it
does not (`anthropics/claude-code#18392`, closed as duplicate, no resolution seen).

A hook that never fires is worse than the prose it replaced, because prose does not produce
confidence. Until this is settled, `tasks/decisions/2026-08-31-declared-tools-are-not-a-mechanism.md`
governs: the three contracts are ASSERTED.

**Agent-checkable trigger.** Run any of the three agents, then:

    cat "$TEMP/claude-agent-guard.log"          # Windows
    cat "${TMPDIR:-/tmp}/claude-agent-guard.log"

Expected on success: a line `<iso timestamp> <agent-type> <tool-name>` for every guarded tool call.
No file, or no line for that agent, means the hook did not fire.

Also unsettled by the same run: whether the `tools:` allowlist itself is enforced. Ask
`schema-auditor` to run a shell command. Denied by the guard → the hook works. Denied as
"tool not available" → the allowlist works. Neither → both are prose and the entry stands.

**Settles when:** a log line is observed, or a denial is observed, for at least one of the three.
