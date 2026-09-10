# A config file whose parse failure is silent needs a test that parses it

**Learned:** 2026-08-31

`test-writer.md`'s description was tightened to read "…what is being asked for: covering an
existing behaviour…". A bare `: ` inside an unquoted YAML scalar is a parse error, so the agent
definition stopped being a definition. Nothing reported it: `tsc` does not read markdown, ESLint
does not read frontmatter, and Claude Code parses these files silently — the symptom of a broken
agent is an agent that is simply never picked, which is indistinguishable from a router that chose
otherwise. It was found only because a *different* task needed a YAML parser.

**Rule:** when a file is consumed by a parser you do not control and its failure mode is silent
absence rather than an error, that file needs a test. `tests/unit/agentDefinitions.test.ts` is that
test here. The class is wider than YAML: any config read by the harness rather than by the build.
