@AGENTS.md

Workflow Orchestration
1. Plan Mode Default
Enter plan mode for ANY non-trivial task (3+ steps or architectural decisions)
If something goes sideways, STOP and re-plan immediately - don't keep pushing
Use plan mode for verification steps, not just building
Write detailed specs upfront to reduce ambiguity
2. Subagent Strategy
Use subagents liberally to keep main context window clean
Offload research, exploration, and parallel analysis to subagents
For complex problems, throw more compute at it via subagents
One tack per subagent for focused execution
3. Self-Improvement Loop
After ANY correction from the user: update tasks/lessons.md with the pattern
Write rules for yourself that prevent the same mistake
Ruthlessly iterate on these lessons until mistake rate drops
Review lessons at session start for relevant project
4. Verification Before Done
Never mark a task complete without proving it works
Diff behavior between main and your changes when relevant
Ask yourself: "Would a staff engineer approve this?"
Run tests, check logs, demonstrate correctness
5. Demand Elegance (Balanced)
For non-trivial changes: pause and ask "is there a more elegant way?"
If a fix feels hacky: "Knowing everything I know now, implement the elegant solution"
Skip this for simple, obvious fixes - don't over-engineer
Challenge your own work before presenting it
6. Autonomous Bug Fixing
When given a bug report: just fix it. Don't ask for hand-holding
Point at logs, errors, failing tests - then resolve them
Zero context switching required from the user
Go fix failing CI tests without being told how
Task Management
Plan First: Write plan to tasks/todo.md with checkable items
Verify Plan: Check in before starting implementation
Track Progress: Mark items complete as you go
Explain Changes: High-level summary at each step
Document Results: Add review section to tasks/todo.md
Capture Lessons: Update tasks/lessons.md after corrections
Core Principles
Simplicity First: Make every change as simple as possible. Impact minimal code.
No Laziness: Find root causes. No temporary fixes. Senior developer standards.
Minimal Impact: Changes should only touch what's necessary. Avoid introducing bugs.

## Context & Session Hygiene

The rule lives in `AGENTS.md` and is not restated here. Reset on **task milestones**, never on a
token estimate: a model cannot reliably count its own tokens, and the counting spends the attention
it is trying to protect. This file used to carry numeric thresholds that asked for exactly the
self-metering `AGENTS.md` forbids — three copies of one rule, three different answers.

**At session close, read the drift log before writing the ledger.** It records every file write in
the session, including the `cat >` and `sed -i` writes no tool-name matcher can see, so a "while I'm
here" edit is visible at review time rather than at merge time:

```bash
cat "$TEMP/claude-agent-drift.log"      # Windows; $TMPDIR elsewhere
```

