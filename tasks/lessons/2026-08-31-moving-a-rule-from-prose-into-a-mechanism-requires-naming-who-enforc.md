# Moving a rule "from prose into a mechanism" requires naming who enforces it

**Learned:** 2026-08-31

`2026-08-31-schema-auditor-has-no-shell.md` claimed that omitting `Bash` from an agent's `tools:`
list made "never connects to a database" something the agent "cannot do". That is only true if the
runtime enforces the allowlist — a component of Claude Code, not of this repo — and there are open
bug reports saying it sometimes does not (`#60237`, `#63762`, `#52055`). The declaration lives in a
file this repo controls; the enforcement does not. The same trap caught the replacement: the
`PreToolUse` guard written to compensate has its own open report (`#18392`) that frontmatter hooks
never fire, and a hook that does not fire is worse than the prose it replaced, because prose does
not produce confidence.

**Rule:** when converting a rule into a mechanism, name the component that enforces it and state
how you would *see* it fire. If the answer is "the harness, and I would not see it", the rule is
still prose — record it as ASSERTED and give it an agent-checkable trigger. A guard that logs every
invocation costs one line and converts an unfalsifiable claim into a `cat`.
