# Measure a guard's false-positive rate against real history before arming it

**Learned:** 2026-09-05

`~/.claude/projects/<sanitized-cwd>/**/*.jsonl` holds every session transcript. Extracting each
`tool_use` block for `Bash`/`PowerShell` gave **4,917 distinct commands, 5,028 invocations** from 71
files — every shell command this project has ever run. Replaying them through the guard denied
**151 (3.02%)**, and the *composition* was the finding: 46 were the file *path* `prisma/seed.ts`
appearing in `git diff --`, `git add` and `sed -n`; 21 were `git -C .claude/worktrees/<name>`, the
isolation mechanism this repo recommends. Roughly 85 of 151 were legitimate work. After four fix
rounds: 79 (1.57%), mostly true positives.

57 unit tests and three review rounds had all passed, and none of them found this — because they
tested the cases their author had imagined, and the corpus tested what people actually run.

**Rule:** for any gate that will fire on real commands, replay the transcript corpus before arming
it, and read the denials rather than the rate. A guard's survival is decided by its false-positive
rate, because a rate high enough to annoy gets the override set permanently and then the guard
uninstalled — which is what happened to this repo's `test-writer` path rule and its `pre-commit`
hook. Extends [[prototype-scanners-before-asserting]] from the extractor to the whole guard.
