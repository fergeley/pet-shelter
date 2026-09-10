# A guard cannot be tested against the thing it observes

**Learned:** 2026-09-05

Three assertions in `tests/unit/agentGuard.test.ts` were coupled to this working tree, and they were
found one at a time, each fix removing only the case in front of me. `git checkout docs` needed
`docs/` clean and went red when a handoff document landed there. The drift test needed the repo
dirty and went red the moment that was committed. `git checkout package.json` needed package.json
clean and went red when one npm script was added.

The middle two are the tell: **no single tree state satisfied both**, so the suite could not be green
before and after a commit. That is not flakiness, it is a contradiction that had been sitting there.

**Rule:** an assertion about a tool that reads `git status` must run against a repo the test creates.
And when a defect has a shape rather than a location, grep for the shape before declaring it fixed —
[[anything-written-twice-diverges]] applies to test coupling, not only to prose.
