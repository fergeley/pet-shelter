# `test-writer`'s step-level path rule is deleted, and nothing replaces it

**Decided:** 2026-08-31

Companion to `2026-08-31-worktrees-are-free-and-the-guard-was-the-wrong-layer.md`, which records
what was tried in its place and why that was removed too. This entry is only about the rule that
went and stayed gone.

## The rule

`.claude/hooks/agent-guard.mjs` denied `test-writer` any `Edit`/`Write`/`NotebookEdit` outside
`tests/` (`2026-08-31-declared-tools-are-not-a-mechanism.md`, verified 25/25 against crafted
payloads). It was written to make "never edits product code to make a test pass" mechanical.

## Why it was wrong, in its own terms

The 2026-08-31 grinder run measured both halves of the defect
(`2026-08-31-agent-grinder-four-runs.md`):

**It did not cover the write path agents are actually told to use.** Auto mode instructs agents to
make file changes with `sed`, heredocs and short scripts. `test-writer` confirmed receiving that
instruction and following it: two files created, one hook invocation logged. A matcher on three tool
names cannot see `cat >`.

**And it forbade the one thing that run got most right.** `test-writer` modified `prisma/env.ts`
five times to apply mutants and prove its new tests discriminated, reverting each inside a single
Bash call with a `finally` and printing `git status --porcelain` clean afterwards. The function
already worked, so mutation is the *only* way to satisfy its own contract — watch the test fail
first. The rule permitted that through Bash and forbade it through `Edit`: same act, opposite
verdicts, decided by which tool was in reach.

**A rule whose scope is a tool name is not a rule about behaviour.**

## The fence, and what removing it costs

What it protected against: `test-writer` writing product code. That threat is real and it is not
gone. What is gone is the pretence that a step-level path matcher addressed it.

The residual — a product file dirty for the length of a tool call, while the concurrent session may
run `git add -A` — is a **shared-tree** hazard, not an agent hazard. It applies identically to Bash
writes, which the rule never covered. Its fix is one worktree per session
(`TARGET_MIDWIFE_ADOPTION.md` T2), measured available and free on 2026-08-31.

Removal was put to the human explicitly, with that cost named, and approved.

## What the guard enforces now

Two rules, both **irreversible at the step**, which is the test for belonging there at all:

| Agent | Invariant | Undoable later? |
|---|---|---|
| `schema-auditor` | never reach a database | no — a production write cannot be taken back |
| `atomic-commit` | never run a git write | no — a commit in shared history |

`test-writer`, `spike-runner` and `ui-critic` have no rule, so they carry **no hook** rather than a
hook that always allows. A wiring that enforces nothing still produces confidence, which is the
failure mode this repo keeps rediscovering.

## Verified

`tests/unit/agentGuard.test.ts` — 14 cases, including one that pins the removal itself: any agent
may edit product code through any tool, `sed -i` and heredocs included. Suite 665 passed, `tsc`
clean, `arch:check` exit 0, lint unchanged at 5 pre-existing warnings.
