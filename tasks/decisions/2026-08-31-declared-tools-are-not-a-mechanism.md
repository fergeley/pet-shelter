# A declared `tools:` list is a declaration, not an enforced mechanism

**Decided:** 2026-08-31

**Corrects — does not reverse — `2026-08-31-schema-auditor-has-no-shell.md`.** That entry says the
agent "declares `tools: Read, Grep, Glob`. With no shell it cannot invoke the Prisma CLI… 'never
connects to a database' stops being a promise the model keeps and becomes a thing it cannot do."

The second half of that sentence was not earned. It holds only if the runtime enforces the
frontmatter allowlist, which is a component of Claude Code, not of this repo. Open reports against
exactly that surface, none verified here against v2.1.251:

- `anthropics/claude-code#60237` — the frontmatter `tools:` array "silently drops first and last
  positions at spawn time". On `Read, Grep, Glob` that would leave `Grep` alone.
- `#63762` — dynamic workflows grant Write/Edit regardless of what the agent declares.
- `#52055` — plugin subagents never receive Grep/Glob in their runtime schema.
- `#18837` — `allowed-tools` in skill frontmatter not enforced.
- `#18392` — hooks in agent frontmatter not executed for subagents (closed as duplicate).

**The fence stands; its status drops from mechanical to ASSERTED.** Omitting `Bash` is still the
right declaration and still the smallest correct surface. It is simply not yet evidence.

## What was built to close the gap

**`.claude/hooks/agent-guard.mjs`** — a `PreToolUse` guard wired from each agent's own frontmatter,
**not** from `settings.json`. That placement is the decision: a `settings.json` hook binds every
session on this repo including the concurrent one, which is the same reason `.claude/hooks/pre-commit`
is written and deliberately not installed. `jq` is not on this machine; node is, and this is a node
project.

It denies: any `Bash` for `schema-auditor`; git writes for `atomic-commit`, by **allowlist of
read-only subcommands, failing closed** on anything it cannot parse and on any `-C`/`--git-dir`/
`GIT_WORK_TREE` redirect; and any `Edit`/`Write`/`NotebookEdit` outside `tests/` for `test-writer`.

**Verified:** 25/25 crafted `PreToolUse` payloads, including chained and sub-shelled `git commit`,
the word "git" appearing in prose, relative paths, and writes outside the repo.
**Not verified: that it fires at all.** Hence the log line it writes on every invocation, and
`tasks/open/agent-guard-never-observed-firing.md`, which carries the trigger.

**`tests/unit/agentDefinitions.test.ts`** — seven source-text guards over `.claude/agents/*.md` and
`.claude/skills/*/SKILL.md`. Each was shown to fire on its own bug and stay silent otherwise (17/17,
in a scratchpad harness, because breaking a guard in this tree is banned by `triage-rules.md`).

## The bug that justified it, found by writing it

`test-writer`'s description was tightened earlier the same day to read "…what is being asked
for: covering an existing behaviour…". A bare `: ` inside an unquoted YAML scalar is a parse error.
**The definition was broken from that edit until the guard was written**, and nothing in the repo
could see it: `tsc` does not read markdown, ESLint does not read frontmatter, and Claude Code parses
these files silently — a definition that fails to parse does not error, it stops existing.
