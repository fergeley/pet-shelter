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
After ANY correction from the user: write the pattern as a new file in tasks/lessons/
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
Capture Lessons: Add a file to tasks/lessons/ after corrections
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

## Closing a session

**Standing order, set 2026-09-10.** A session is not finished when the code works. It is finished
when the next person can pick it up without asking you anything. Run these in order and report
what each returned — announcing "done" without them is not a close.

1. **Verify, and name what you ran.** Every gate that applies: `typecheck`, `test`,
   `test:components`, `test:integration`, `lint`, `docs:check`, `build`. A gate that cannot run is
   reported with its exact command, its failure, and the residual risk — that rule is `AGENTS.md`
   "Verification"; what this adds is that the check happens *at close*, not only when convenient.
   A gate deferred earlier in the session gets one more attempt here before it is reported as a
   gap. **In a worktree, `npm run build` needs `npm ci` first** (vitest resolves by walking up to
   the parent checkout; Turbopack will not compile outside its workspace root) **and throwaway
   `SESSION_SECRET`/`ADMIN_SECRET_KEY` passed inline** — `next build` sets `NODE_ENV=production`,
   which turns the missing-secret warning into a throw. Never copy `.env.local` across to satisfy
   it: that file points `DATABASE_URL` at the production branch.
2. **Read the drift log** (above) and account for every path in it. Anything touched that is not in
   a commit is either staged deliberately or explained out loud.
3. **Write the ledger** per `tasks/README.md` — live threads and conclusions-reached-without-
   evidence to `tasks/open/`, choices someone could reasonably reverse to `tasks/decisions/`, and
   delete any `open/` entry this session actually closed.
4. **Write the lessons**, one new file each: `tasks/lessons/<YYYY-MM-DD>-<slug>.md`, shaped as
   `# <title>`, a `**Learned:** YYYY-MM-DD` line, then the pattern and its **Rule:**. Never edit
   another session's lesson to add yours — a new path is what makes two sessions unable to
   collide. Only patterns that would change a future decision; a "lesson" that restates the diff
   is noise, and every session reads this directory.
5. **Fill in the review section of `tasks/todo.md`**, including what was deliberately *not* done
   and why — the omissions are the part nobody can reconstruct from the code.
6. **Commit and push.** Message checked with `node scripts/commit-msg.mjs`.
7. **Say plainly whether the session can be closed**, what remains open, and the single next
   command if there is one.

Steps 3–5 are not paperwork. Everything this session learned that is not in one of those three
files is lost at the context boundary, and the cost lands on whoever picks the branch up.

