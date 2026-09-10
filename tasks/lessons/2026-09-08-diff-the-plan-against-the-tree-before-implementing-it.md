# Diff the plan against the tree before implementing it

**Learned:** 2026-09-08

Four of the six steps in the task had already shipped: the pillars, the featured-animal grid with
its status badges, and the quick-action cards all existed in `1137d3e` and earlier. Two of the
remaining instructions were actively wrong for this repo — the named test path
(`tests/unit/components/`) runs under `environment: "node"`, where `vitest.config.mts` deliberately
does not mount components, and the specified commit subject was 74 characters against a 72-char
hard limit the repo's own linter enforces.

Ten minutes of reading the tree turned "implement six things" into "implement one thing, fix two
instructions, and leave four alone".

**Rule:** treat a handed-down plan as a claim about the codebase, not a description of it. Read the
files it names and run the commands it prescribes *before* writing code — a plan that restates
shipped work will otherwise be re-implemented on top of itself, which is
[[the repo's top defect shape]].
