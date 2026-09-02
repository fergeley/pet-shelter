# Five sub-agents added; six candidates from the Nexometry dump dropped

**Decided:** 2026-08-31

A dump of another repo's agentic scaffolding (`~/Downloads/tmp/tmp`, 416 files across `.agents/`,
`.claude/` and `.github/`, plus a standalone `~/Downloads/AGENTS.md`) was offered for integration.
It is from an Angular/.NET multi-tenant SaaS. Porting it wholesale would have imported another
stack's conventions, an MCP memory server that does not exist here, and a three-tree mirroring
scheme this repo has no use for.

## Ported, retargeted

`test-writer`, `schema-auditor`, `ui-critic`, `atomic-commit` — each rewritten against this repo's
actual mechanisms rather than copied. Only the *role* survived the port; every instruction in the
bodies is new. The most load-bearing rewrites:

- **`ui-critic` was inverted.** The original enforced "perfect light/dark mode via `dark:`
  variants". This repo's guard suite **fails** that: a `dark:` variant paired with a raw palette
  colour is a banned pattern, because dark mode here is a token swap. Porting it verbatim would
  have had a reviewer instructing people to break `designSystemGuards.test.ts`.
- **`schema-auditor` lost its ability to touch a database.** The original audits a live PostgreSQL.
  Here `DATABASE_URL` points at the Neon production branch and there is no migrations directory,
  so the agent is read-only over the schema file and the callers, and hands back anything that
  needs real data as an open item.
- **`atomic-commit` was rebuilt around the shared index.** The original emits `git add`. Here
  another session stages into the same index, so the agent reads `--cached` in its own call,
  refuses broad staging, and emits pathspec-scoped `git add -- <paths>` / `git commit -F ... --`.
- **`test-writer` was retargeted** from Angular/.NET to the four Vitest projects and the
  `tests/setup/nextMocks.ts` harness, including the dynamic-import rule.

## Added, not from the dump

`spike-runner` — `midwife.md` §3 Phase 2 has always specified that spikes "run in fresh-context
sub-runs returning only the `spike-verdict.md` structure", and no such sub-run existed. The spec
referenced a mechanism it did not have. This is the gap the dump made worth closing rather than a
thing the dump supplied.

## Dropped, with reasons

- `code-critic`, `security-critic` — duplicate `/code-review` and `/security-review`. A third
  reviewer with a fourth opinion is not coverage.
- `simplifier` (skill) — duplicates `/simplify`.
- `atomic-rollout-planning` (skill) — duplicates the GRAVE lane's phases.
- `smart-dumb-components` (skill) — Angular signals; nothing to port.
- `nexometry-ste`, `zettel-auditor`, `atomic-refactor`, `copywriter`, `code-mentor` — bound to that
  project's docs, vault and codebase.
- `hallmark` (skill, ~120 files) — a full design system for greenfield pages. This repo already has
  a seven-tone system with 862 lines of guards enforcing it. Two design systems in one repo is the
  divergence defect, pre-installed. **Not ported; reversible if a greenfield surface ever needs it.**
- The `.agents/` + `.claude/` + `.github/` triplication and its `skills:sync` + SHA-256 gate. That
  machinery exists to keep three runtimes' copies byte-identical. Only Claude Code reads config
  here, so the right answer is one tree, not a gate on three.

## From the standalone `AGENTS.md`

Three rules adopted into this repo's `AGENTS.md` because nothing here stated them: the
`LOCAL_TEST_WAIVER:` scoping rule (a waiver lives in the current prompt, and recalled memory cannot
grant one), naming the layer that actually enforces a security boundary, and no docs-only PRs. Its
staging rules were **not** copied — `triage-rules.md` §5 already carries them, harder.

## What this costs

Six agent descriptions now compete in the dispatcher where one did. `TARGET_MIDWIFE_ADOPTION.md`
T1 is still unobserved — auto-delegation has never been seen working even with a single agent — and
this change widens what T1 has to prove. Tracked in `tasks/open/agent-roster-routing-untested.md`.
