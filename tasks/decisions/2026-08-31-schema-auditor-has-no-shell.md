# `schema-auditor` has no Bash, deliberately — do not add it back

**Decided:** 2026-08-31

Same-day revision of `2026-08-31-agent-roster-ported-and-pruned.md`, which it does not reverse.

The first version of `.claude/agents/schema-auditor.md` declared `tools: Read, Grep, Glob, Bash`
and carried a prose rule saying it must never connect to a database, softened by an exception:
"`prisma validate` and `prisma format --check` are safe because they never connect".

That exception is built on the wrong boundary. `prisma.config.ts` calls `resolveDatabaseUrl()` at
module load, so **every** Prisma CLI invocation in this repo resolves the Neon production
connection string before the subcommand runs. The safety margin was therefore "did I correctly
remember which subcommand opens a socket", evaluated by a model, against a database with no
migration history and no down path. That is the exact shape of the failure `prisma/env.ts` was
written to prevent, one layer up.

**The fence:** the agent now declares `tools: Read, Grep, Glob`. With no shell it cannot invoke the
Prisma CLI, cannot run a script that opens a client, and cannot reach the network — so "never
connects to a database" stops being a promise the model keeps and becomes a thing it cannot do.
An auditor that reads a schema file and greps its callers does not need a shell to do either.

**What it protects against:** a future session adding `Bash` so the agent can run `prisma validate`
or count something, and thereby restoring a path from a read-only audit to a production write.
If you need that, say why here first.

**The honest limit this does not fix.** The other four agents still constrain themselves in prose:
`ui-critic` needs `Bash` to run the guard suite, `atomic-commit` needs it to read the index,
`test-writer` needs `Write` for test files while being told never to touch product code. Agent
frontmatter has no path scoping, so those three remain promises. The mechanical version is a
`PreToolUse` hook — the same move `TARGET_MIDWIFE_ADOPTION.md` T5 proposes for the Build Gate.
Not built; recorded so the gap is visible rather than assumed closed.

## Also fixed in the same pass

- `schema-auditor` claimed "twenty models". There are **17 models and 3 enums**
  (`grep -c '^model ' prisma/schema.prisma` → 17). Hardcoded counts removed from all agent files;
  they are the `TARGET_*` baseline-staleness failure in a smaller package.
- `atomic-commit` hardcoded one `Co-Authored-By:` trailer. History carries two variants across 189
  commits. It now copies the caller's rather than inventing one.
- `atomic-commit` told the agent to *write* the commit-message file, contradicting its own
  "emits commands, does not run them". It now emits the heredoc that writes it.
- `ui-critic`, `test-writer`, `schema-auditor` descriptions were narrowed to stop them poaching
  from `/code-review` and `midwife`.
- The six-row agent roster in `AGENTS.md` was deleted. The harness injects every agent's
  `description` into the session automatically — observed this session, when five agents created
  mid-session appeared without a restart — so the table was a hand-maintained second copy of
  something already present, i.e. this repo's one recurring defect, freshly installed. `AGENTS.md`
  now carries only what a description cannot say.
