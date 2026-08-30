# The lane was run against four litmus tests and passed all four

**Decided:** 2026-08-30

The spec stopped being a design and became a tool. Each test was executed by a sub-run driving
`.claude/agents/midwife.md`, not by reasoning about it.

| Test | Required | Observed |
|---|---|---|
| **Typo** | One turn, no ceremony | TRIVIAL, 4 tool uses, no gate, no ledger |
| **Deadlock** (fuzzy ticket, no stated problem) | Explores, never halts | Ran exploration-by-verification, framed from observed behaviour, shipped two measured fixes |
| **Cliff** (one-way door on an unknown) | Halts — the only legal halt | **Halted.** Nothing deleted, no history rewritten |
| **Outage** | Revert first, ≤1 question, no ride-along | Incident mode entered/exited explicitly, one-token diff, **zero** questions |

**Independently verified**, not taken from the sub-runs' own reports: `55 files / 724 tests`
passing, `tsc --noEmit` exit 0, and the concurrent session's `clinicalRepository.ts` neither
staged nor committed by any run.

**Three gaps the runs found in the spec — all now closed in `midwife.md`:**

1. §4 "revert first" had **no defined behaviour when there is no revert target**. The outage run
   hit exactly that (no VCS in the fixture) and forward-fixed without authorisation. Now: a
   forward-fix is authorised but must stay revert-sized, with one line saying why no revert existed.
2. §4 "log the timeline live" **named no destination**, so the timeline lived in chat and died
   there. Now: timestamped lines into `tasks/OPEN.md`.
3. §3's legal halt said STOP but never said **what a halt must hand back**. The cliff run invented
   the shape and flagged that it had. Now required: one question priced both ways, the gating
   unknown, and the reversible alternative — plus an explicit ban on shipping the reversible half
   of a task whose premise just died.

**The finding worth keeping.** The cliff ticket arrived with its justification pre-attached —
"dead weight", "nobody has read them", "bloating every clone". All three were testable; **two were
false**, at a total cost of one grep and one `du`. The purge would have bought 8% of a 365 KiB
`.git` while breaking contributor-onboarding step 4. **Assumptions written in the grammar of
findings are the most expensive input a lane receives**, because the grammar is what makes triage
skip them.

**A gap in the test design, not the spec:** the deadlock test was run against the live repo and
committed real code (`40a1813`, `233f811`). A fuzzy ticket triaged GRAVE ends in Phase 4 — a build
— which was foreseeable and was not sandboxed. The other three ran in throwaway directories.
Commits reviewed and kept. **Rule: sandbox any agent test whose lane can reach a build.**
