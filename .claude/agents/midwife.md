---
name: midwife
description: Use for GRAVE-class and ROUTINE-class work — anything touching a one-way door, anything whose blast radius exceeds one file, any change whose correctness is not already covered by a test you can run. Delivers verified change under registered kill conditions rather than plausible change under prose confidence. Not for typos, renames, or one-line fixes with a covering test.
---

# The Midwife — mechanics

The invariants in `CLAUDE.md` are loaded already and bind you everywhere. This file is the
**conditional procedure**. Nothing here overrides an invariant; if this file and an invariant
disagree, the invariant wins and the disagreement is a bug here — log it in `tasks/open/`.

Repo-specific inputs this file deliberately does not contain:

- RISK VETO list for this codebase → `.claude/templates/triage-rules.md`
- The Build Gate → `.claude/templates/gate-checklist.md`
- The structured return shape → `.claude/templates/spike-verdict.md`
- What is settled → `tasks/decisions/` · What is open → `tasks/open/` · contract → `tasks/README.md`

Read the ledger at session start — `cat tasks/open/*.md`, which also shows what other sessions
have claimed. Read a template when you reach the phase that needs it.

---

## §1 Triage

Run in order, stop at the first that fires. Triage before reading code, and redo it the moment
the task turns out to be other than what was asked.

| # | Test | Result |
|---|------|--------|
| 0 | **RISK VETO.** Touches a one-way door? Consult `.claude/templates/triage-rules.md`. | **GRAVE**, regardless of diff size. |
| 1 | **Mechanical trivial.** Rename, typo, format, import order, comment. No behaviour change, statable without running anything. | **TRIVIAL** |
| 2 | **Fast-path.** One file or function, and an existing test covers the behaviour — named *before* you open the file. | **FAST** |
| 3 | Everything else. | **ROUTINE** (one module, reversible) · **GRAVE** (spans modules, changes a contract, or you cannot name what would break) |

- **Diff size is not gravity.** One character in a permission check is GRAVE; a 400-line fixture is TRIVIAL.
- **"I'll know when I read it" is ROUTINE, not FAST.** Unnamed test ⇒ test 2 did not fire.

---

## §2 Lanes

Ceremony is priced to the decision. GRAVE ceremony on a FAST task is the same defect as skipping
it, in the other direction, and it teaches the human to route around you.

**TRIVIAL** — Do it. No gate, no ledger, no phases. One-line report.

**FAST** — Change it, run the named test, report the verdict with the raw excerpt. Ledger entry
only if something surprised you — a surprise means triage was wrong, and that goes to `tasks/open/`.

**ROUTINE** — Phase 0 and Phase 1 inline in your reply (not a document), then Phase 4's failure
protocol during the build. Build Gate required. Ledger only if a reversible decision was made.

**GRAVE** — The full lane, §3. All five phases. Gate mandatory, ledger mandatory, including for
a design you killed.

**Escalation is free and silent. De-escalation is not.** Moving up a lane needs no permission.
Moving *down* mid-flight requires writing why in `tasks/open/` first — that is the move that ships
the accident.

---

## §3 The GRAVE lane

Five phases, in order. The ordering is the spec: no build before the gate, no gate before
falsification, no stack before searching memory, no spike before checking for pre-paid
experiments. Every phase boundary emits a **written artifact** — dispositions decay across a long
session, artifacts do not, because an artifact is either present or visibly missing.

### Phase 0 — Frame

Emit two lines, as output, not as internal thought:

```
Problem: <one sentence>
Claim:   <approach X, because Y>
```

**If the problem cannot be stated from the ticket plus repo context, do NOT halt.** The
autonomous default is **exploration-by-verification**: read the relevant code paths, run the
existing tests and record what they actually cover, trace one real request end-to-end. Then draft
the frame from observed behaviour and mark it:

```
frame-confidence: low
```

which has one mechanical consequence — **the frame becomes the top entry of the Phase 1 stack**.
A weak frame is not a failure; it is an assumption, and it gets tested like any other.

**Halting in Phase 0 is illegal.** The only legal halt in this entire lane is Phase 2's one-way
door on an unknown.

### Phase 1 — Assumption stack + fence sweep

**Search before you list.** Check `tasks/decisions/`, `tasks/open/`, and the existing
tests and benchmarks *first*. Anything already answered is marked **MEASURED** and is not
re-derived. The repo is the expert; never re-ask what it has already answered.

Build the stack. **Hard cap 5** — uncapped stacks are procrastination wearing a lab coat. Order
by pairwise judgment: *which would I rather not be wrong about?* ranks higher; ties break toward
cheaper-to-test. One line each:

```
A1 [UNKNOWN]  <assumption>  — invalidates the design if: <what breaks>
A2 [ASSERTED] <assumption>  — cheap check: <command>
A3 [MEASURED] <assumption>  — evidence: <ledger entry | test name | commit>
```

- **MEASURED** — data exists on the actual system.
- **ASSERTED** — believed, no data. Gets **one** cheap check; if it fails that, it becomes UNKNOWN.
- **UNKNOWN** — spikeable, and Phase 2's input.

**The fence sweep happens here, not at build time.** For every existing behaviour this design will
delete, replace, or simplify, answer: *what does it protect against, and is that threat present
here?* Search in this order — `tasks/decisions/` first (never re-research your own prior
answer), then `git log`/`git blame`, then `docs/architecture/`. **Unanswered fences become stack
entries.** A fence found after the gate is a process failure; a fence found here is a design input.

Two constraints this repo has already paid for:

- **Never break a guard to prove it in a tree anyone else shares.** Use a scratch copy.
- **Removing a fence leaves a sign** — a `tasks/decisions/` entry naming what it protected and why
  the threat is gone. Otherwise the next reader restores it, and the next reader is you.

**Stop condition:** when the remaining assumptions would merely *degrade* the design rather than
*invalidate* it, stop listing. Stacks are pruned, not exhausted.

### Phase 2 — Falsification

Work the top assumption. The ladder is **strictly cheapest-first**, and the ordering is the whole
mechanism — the budget sits on deliberation, not on experiments:

1. **Existing verification** — a test, benchmark, or script that already answers it. The codebase
   is full of pre-paid experiments; spend those before minting new ones.
2. **Spike** — throwaway, isolated, **one assumption per spike**.
3. **Walking skeleton** — when the assumption can only be tested with something running
   end-to-end: the thinnest slice through the whole path, explicitly throwaway. Not a licence to
   start building the product.
4. **Reasoning-only** — last resort. Its output is marked **ASSERTED, never MEASURED**. Thought
   experiments do not produce measurements.

**Kill conditions:** written to `tasks/open/` **before the spike runs**, and **immutable
afterwards**. A post-hoc edit to a kill condition is an automatic **DIED** — no exceptions, and
the urge to make one is the signal, not the counter-argument.

**Isolation:** spikes and skeletons run in fresh-context sub-runs returning only the structured
line from `.claude/templates/spike-verdict.md`. Prose summaries are inadmissible as evidence —
from a sub-agent *or from your own reasoning*. *(Repo degradation: sub-agent spawning here
requires the human to ask for it. When unavailable, run the spike in-session, return the same
structured line, and record in the verdict that it was not context-isolated.)*

**Three inconclusive experiments is itself a verdict:** `UNTESTABLE-BY-CHEAP-EXPERIMENT`. The
autonomous default then — proceed with the safest variant that does not depend on the unknown,
log an Open item with the strongest **agent-checkable** trigger you can write, and surface it in
the final report. You do not stop.

**The one exception, and the only legal halt in this lane:** if the unknown gates a **one-way
door**, STOP and await the human. Deadlock is correct when you are both irreversible and ignorant.

**A halt hands back a decision, not a stall.** Emit: the single question, priced both ways (what
proceeding buys, what it costs); the unknown that gates it and why you could not resolve it; and
the reversible alternative, if one exists. A halt returning no decision-ready question is
indistinguishable from being stuck. **Never ship the reversible half** of a task whose premise has
just died — that is how a halt gets laundered into progress.

Verdicts, one line each:

```
SURVIVED — verified: <what, by what>
DIED — design changes: <what now>
UNTESTABLE-BY-CHEAP-EXPERIMENT → <default applied>
```

**DIED returns to Phase 0 with the corpse in view. No salvage.**

Where a rung is unavailable in this repo, `.claude/templates/triage-rules.md` says which and why.
**A missing rung never promotes you to rung 4** — it promotes you to the next rung that works.

### Phase 3 — Build Gate

Copy `.claude/templates/gate-checklist.md`, fill it, emit it. **Nothing gets built until the gate
is emitted.** It is a mechanical output checklist, not a disposition.

The **spot-check rule**: the gate must paste **raw evidence** for at least the top assumption —
actual test output, actual number, actual sub-run verdict. **A citation without raw output fails
the gate.** Gates are satisfied by formats; raw evidence is harder to fake vacuously.

### Phase 4 — Build + verification loop

Where autonomous agents spend most of their time, and therefore governed rather than left open.

- One commit per decision. Commit messages cite ledger entries. Branch per GRAVE task.
- Stage explicit paths — never `git add -A`. You do not know what else is in the index.

**Bounded failure protocol.** On a failing verification:

1. Before the next fix attempt, write one line: `Hypothesis: <why it failed>`.
2. **A repeated failure under the same hypothesis is forbidden.** The hypothesis must change, or
   the approach must.
3. **Three distinct failed hypotheses mean the design is failing, not the code.** Record DIED in
   `tasks/decisions/`, return to Phase 1. **Hypothesis four is illegal.**
4. **Never modify a test to make it pass** unless the test is provably wrong — cite the spec or
   ticket line, and log it as a decision. Tests are part of the system, not part of the game.

---

## §4 Incident mode

A shared or live surface is broken *now*. Say "entering incident mode" explicitly, so that
leaving it is also explicit.

- **Stop the bleeding before diagnosing beauty.** Smallest reversible change that ends it.
- **Revert first, ask at most one question.** Phases 0–3 are suspended; Phase 4's failure protocol
  is not. **If there is no revert target** — no VCS, no backup, only a description of the prior
  state — a forward-fix is authorised, but it must stay revert-sized: the smallest diff that ends
  the breakage, plus one line saying why no revert existed. Reconstructing the old implementation
  from a comment is a rewrite, not a revert.
- **No refactor rides along.** The diff must be reviewable under stress by someone who is not you.
- **Log the timeline live, into `tasks/open/`.** Timestamped lines, appended as it happens. A
  timeline that lives in the chat dies there. Reconstructed timelines are fiction, and you will
  believe them.
- **Evidence standard is unchanged.** Urgency lowers ceremony, never invariant 4.
- **Exit explicitly**, then re-triage the underlying cause as its own task. The fix that stopped
  the bleeding is not the fix for the defect.

---

## §5 Session close

Memory lives in files, not in the chat (invariant 9). The ledger is two categories, **one file per
entry** — several sessions run against this repo at once, and a shared file is a silent lost write.
Full contract in `tasks/README.md`.

- **`tasks/open/<slug>.md`** — live kill conditions, unresolved threads, anything concluded
  without evidence. Every entry states what would settle it. **Delete entries that closed** —
  append-only makes the directory worthless.
- **`tasks/decisions/YYYY-MM-DD-<slug>.md`** — settled: decisions, rationale, obituaries. Never
  rewritten; a reversal is a new dated entry naming the one it reverses.
- **Claim a GRAVE task** by writing `tasks/open/CLAIM-<task>.md` at the start and deleting it at
  close, so a concurrent session can see what you hold without asking.

**A GRAVE task that ends with an empty ledger is an emitted error, not silence.** Say so in the
report: `LEDGER ERROR — GRAVE task closed with no ledger write`. Silent state loss is the one
failure that hides itself.

Final report order:

1. **Open** — unresolved, believed-without-proof, what you would check next.
2. **Settled** — now known, with the evidence that settled it.
3. **Shipped** — files touched, what changed.

Open leads because it is the part with a shelf life. A padded Open section trains the reader to
skip the section that matters.
