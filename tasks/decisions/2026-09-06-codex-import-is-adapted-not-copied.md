# Codex configuration is adapted at the repository boundary, not copied byte for byte

**Decided:** 2026-09-06

The imported Codex project configuration keeps one repository-owned lifecycle hook: a
best-effort `PostToolUse` drift log. It resolves the Git root at execution time, stores its
baseline outside the repository, uses NUL-delimited porcelain records so quoted and non-ASCII
paths remain observable, and never acts as an authorization boundary. The copied Claude agent
guard and copied Git hooks were removed because their native owners remain `.claude/hooks/` and
`.git/hooks/`.

Custom agents declare their sandbox explicitly. Agents that only inspect or propose commands use
`read-only`; agents whose contract writes tests or throwaway spike artifacts use
`workspace-write`, with narrower behavioral limits in their instructions. Imported references use
the repository's canonical `.claude/templates/` and `.agents/skills/` paths. Completed source
commands were not published as runnable Codex skills; the still-open legacy-token removal command
remains available.

The conversion also removes literal `\r` escape text introduced into the multiline TOML agent
instructions. A focused regression suite checks canonical paths, agent sandbox defaults, the
manual-migration description, nested-directory hook execution, and a non-ASCII filename that Git
would quote without `-z`.

Reverse this decision only if Codex gains a native repository permission boundary that can replace
the observational hook. Do not promote the drift log into an authorization mechanism without a
session-start baseline and end-to-end hook-liveness evidence.
