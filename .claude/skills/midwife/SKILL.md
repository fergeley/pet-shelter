---
name: midwife
description: Use when AUTHORING a change that touches production data, secrets, deploys, migrations, git history, or a cross-module contract; whose blast radius exceeds one file; or whose behaviour no existing test covers. Delivers verified change under pre-registered kill conditions rather than plausible change under prose confidence. Not for typos, renames, or one-line fixes with a named covering test — and not for reviewing a diff that already exists, which is /code-review's job.
---

# The Midwife — mechanics

`CLAUDE.md` holds the invariants and the four triage tests; both are loaded already.

**Precedence.** An invariant states the default. This file may **narrow** one, but only where it
says so explicitly and names it — every such narrowing below is marked `narrows invariant N`. An
unmarked conflict is a bug in this file: log it in `tasks/open/` and follow the invariant.

Repo-specific inputs this file deliberately does not contain:

- One-way doors and environment limits → `.claude/templates/triage-rules.md`
- The Build Gate → `.claude/templates/gate-checklist.md`
- The structured return → `.claude/templates/spike-verdict.md`
- Ledger contract, and what is settled or open → `tasks/README.md`, `tasks/decisions/`, `tasks/open/`

---

## §1 Triage

The four tests are in `CLAUDE.md` and run before this file loads. Two refinements:

- **Diff size is not gravity.** One character in a permission check is GRAVE; a 400-line fixture
  is TRIVIAL.
- **Re-verify a veto entry only when test 0 might actually fire on it.** `triage-rules.md` says
  not to cite it as evidence, but re-running every verification in it before a typo fix costs more
  than the typo. Check the entries the task plausibly touches — and if that file describes doors
  this task cannot reach, it has told you nothing you needed.

Re-triage the moment the task turns out to be other than what was asked. That is the normal case,
not a failure — see escalation below.

---

## §2 Lanes

Ceremony is priced to the decision. GRAVE ceremony on a FAST task is the same defect as skipping
it, in the other direction, and it teaches the human to route around you.

**TRIVIAL** — Do it. No gate, no ledger, no phases. One-line report.
*(narrows invariant 9: a TRIVIAL task closes with no ledger write.)*

**FAST** — *(narrows invariant 9 the same way.)* Before editing, **run the named test case**.
After editing, run it again. **If it passed both times, it never covered the change** — the
fast-path claim was false, so re-triage to ROUTINE and say so. Naming a test is not evidence that
it covers anything; observing it discriminate is (invariant 4). Report the verdict with the raw
excerpt.

**ROUTINE** — Phase 0 and Phase 1 inline in your reply, then Phase 4's failure protocol during the
build. **Reduced gate** — three lines: `Claim:`, raw evidence, `Not verified:`. Ledger entry only
if a reversible decision was made.

**GRAVE** — The full lane, §3. All five phases. Gate mandatory, ledger mandatory, including for a
design you killed.

**Escalation.** Moving up a lane needs no permission. But escalating *mid-flight* — you triaged
FAST, opened the file, and it is GRAVE — means you have already built, and the gate must not be
written to describe work already done as though it preceded it. So: **park the diff on a scratch
branch** (never `git stash`), run the phases, and if the gate is emitted after any build, label it
`retroactive:` in its heading and say what was built before it.

**De-escalation** — deciding mid-flight that a GRAVE task is really FAST — is the move that ships
the accident. Write the rationale to `tasks/decisions/` first. It goes there, not `open/`: it is a
settled judgement with no settle condition, and it must never be deleted.

---

## §3 The GRAVE lane

Five phases, in order: no build before the gate, no gate before falsification, no stack before
searching memory, no spike before checking for pre-paid experiments. Every phase boundary emits a
**written artifact** — dispositions decay across a long session, artifacts do not, because an
artifact is either present or visibly missing.

### Phase 0 — Frame

Emit two lines, as output, not as internal thought:

```
Problem: <one sentence>
Claim:   <approach X, because Y>
frame-confidence: low | high
```

**`low` is the default.** `high` requires citing the ticket line or `decisions/` entry the frame
came from. A `low` frame is not a failure — it becomes **the top entry of the Phase 1 stack** and
gets tested like any other assumption.

**If the problem cannot be stated from the ticket plus repo context, do NOT halt.** The autonomous
default is **exploration-by-verification**: read the relevant code paths, run the existing tests
and record what they actually cover, trace one real request end-to-end. Then frame from observed
behaviour. Halting in Phase 0 is illegal.

### Phase 1 — Assumption stack + fence sweep

**Search before you list.** `grep` `tasks/decisions/` and `tasks/open/` for the specific question,
and check the existing tests — do not read the ledger wholesale, it grows without bound. Anything
already answered is marked **MEASURED**, cited, and not re-derived. The repo is the expert.

Build the stack. **Hard cap 5.** Order by *which would I rather not be wrong about?*; ties break
toward cheaper-to-test. One line each:

```
A1 [UNKNOWN]  <assumption>  — invalidates the design if: <what breaks>
A2 [ASSERTED] <assumption>  — cheap check: <command>
A3 [MEASURED] <assumption>  — evidence: <ledger entry | test name | commit>
```

**MEASURED** — data exists on the actual system. **ASSERTED** — believed, no data; gets one cheap
check, and failing it makes it UNKNOWN. **UNKNOWN** — spikeable, and Phase 2's input.

**The fence sweep happens here, not at build time.** For every existing behaviour this design will
delete, replace, or simplify: *what does it protect against, and is that threat present here?*
Search `tasks/decisions/` first, then `git log`/`git blame`, then `docs/architecture/`.
**Unanswered fences become stack entries.** A fence found after the gate is a process failure.

Never break a guard to prove it in a tree anyone else shares — use a scratch copy. Removing a
fence leaves a sign: a `tasks/decisions/` entry naming what it protected and why the threat is gone.

**Stop condition:** when the remaining assumptions would merely *degrade* the design rather than
*invalidate* it, stop listing. Stacks are pruned, not exhausted.

### Phase 2 — Falsification

Work the top assumption. The ladder is **strictly cheapest-first**:

1. **Existing verification** — a test, benchmark or script that already answers it.
2. **Spike** — throwaway, isolated, **one assumption per spike**.
3. **Walking skeleton** — the thinnest end-to-end slice, explicitly throwaway. Not a licence to
   start building the product.
4. **Reasoning-only** — last resort, output marked **ASSERTED, never MEASURED**.

Where a rung is unavailable here, `triage-rules.md` says which and why. **A missing rung never
promotes you to rung 4** — it promotes you to the next rung that works.

**Kill conditions** go to `tasks/open/` **before the spike runs** and are **immutable**. A
post-hoc edit is an automatic **DIED**.

**A condition that cannot be evaluated is retired, not edited** — the environment changed, the
condition did not become wrong. Write a *new* `open/` entry naming and superseding it, leave the
original verbatim, and record the unmeasurability in the verdict. Retiring a condition that *can*
still be evaluated is an automatic DIED.

**Isolation:** spikes run in the `spike-runner` sub-agent, returning only the `spike-verdict.md`
structure. Where sub-runs are unavailable, run in-session and record `Context-isolated: no`.

**Three inconclusive experiments is a verdict:** `UNTESTABLE-BY-CHEAP-EXPERIMENT`. Then proceed
with the safest variant not depending on the unknown, log an Open item with an **agent-checkable
trigger** — a command plus its expected output, runnable here with no human setup; if none exists,
the trigger must say `no agent-checkable trigger exists` — and surface it. You do not stop.

**The only legal halt in this lane:** the unknown gates a **one-way door**. STOP and await the
human. **A halt hands back a decision, not a stall:** the single question priced both ways, the
gating unknown and why you could not resolve it, and the reversible alternative if one exists.
**Never ship the reversible half** of a task whose premise has just died.

`SURVIVED — verified: …` / `DIED — design changes: …` / `UNTESTABLE-BY-CHEAP-EXPERIMENT → <default>`.
**DIED returns to Phase 0 with the corpse in view. No salvage.**

### Phase 3 — Build Gate

Fill `.claude/templates/gate-checklist.md`, emit it, **and append it to the task's
`tasks/open/CLAIM-<task>.md`** — a gate that exists only in the transcript dies there, which is
the failure this whole file is built against. **Nothing gets built until the gate is emitted.**

**Raw evidence targets the highest-ranked stack entry that is *not* MEASURED**, and carries one
extra line: `Would have shown instead, if false: <…>`. Output that would look identical either way
is not evidence. A MEASURED entry is satisfied by pasting the verbatim cited line from its ledger
entry or test — not by re-deriving it, which Phase 1 forbids.

**The gate is self-assessment, so a GRAVE task does not pass on it alone.** Before closing, get an
independent look at the diff — `/code-review`, or a sub-run that sees the diff and the criteria and
*not* the reasoning that produced it. You cannot review your own work: you know what you meant, so
you read the intent rather than the code, and the fences you failed to notice while writing are the
ones you will fail to notice while checking. Its findings are inputs to the gate.

They are not orders. A reviewer asked to find gaps will find some even when the work is sound, and
chasing every one produces defensive scaffolding nobody needed. Act on what affects correctness or
a stated requirement; record the rest as optional and move on.

### Phase 4 — Build + verification loop

- One commit per decision, citing ledger entries. Branch per GRAVE task.
- Stage explicit paths — never `git add -A`. You do not know what else is in the index.

**Bounded failure protocol.** On a failing verification:

1. Before the next attempt, write `Hypothesis: <why it failed>`.
2. A repeated attempt under the **same** hypothesis is forbidden — it must change, or the approach must.
3. **Three distinct failed hypotheses against the same failing verification** mean the design is
   failing, not the code. Record DIED in `tasks/decisions/`, return to Phase 1. Hypothesis four is
   illegal. **The count is per-symptom and resets when that verification passes** — three
   unrelated failures in three files do not kill a healthy design.
4. **Never modify a test to make it pass** unless it is provably wrong: cite the spec or ticket
   line, and log it as a decision.

---

## §4 Incident mode

A shared or live surface is broken *now*. Say "entering incident mode" explicitly.

**Incident mode outranks triage test 0** *(narrows invariants 1 and 7)*. A live outage is itself a
one-way door, so the veto list would otherwise force the full lane and a halt at the moment speed
matters most. Here the veto list constrains **how**, not **whether**: revert-sized diffs, no schema
writes, no outbound mail, no history rewrite. **The only halt is when the fix is itself
irreversible and you are ignorant of its effect.**

- **Stop the bleeding before diagnosing beauty.** Revert first; **at most one question**
  *(narrows invariant 7)*. Phases 0–3 are suspended; Phase 4's failure protocol is not.
- **If there is no revert target** — no VCS, no backup — a forward-fix is authorised but must stay
  revert-sized, with one line saying why no revert existed.
- **No refactor rides along.** The diff must be reviewable under stress by someone who is not you.
- **Log the timeline live** into `tasks/open/CLAIM-incident-<slug>.md`, timestamped as it happens.
  **On exit, move it to `tasks/decisions/YYYY-MM-DD-incident-<slug>.md`** — it is the postmortem,
  and the open/ contract would otherwise require deleting it.
- **Evidence standard is unchanged.** Urgency lowers ceremony, never invariant 4.
- **Exit explicitly**, then re-triage the underlying cause as its own task.

---

## §5 Session close

The ledger contract — two categories, one file per entry, what goes where — is `tasks/README.md`.
Read it rather than a copy of it here.

**Isolation before coordination.** File collisions are solved by running each session in its own
worktree — `claude --worktree <name>` — which the harness *enforces*: it blocks edits, commands and
git redirects that reach the main checkout. Prefer that to any protocol written here. A rule the
environment enforces beats a rule you have to remember, which is the whole argument of this file.

**Only when sessions share one tree** does the fallback apply. Before writing a file, in any lane:
`grep -l "<path>" tasks/open/CLAIM-*.md` — **glob it; re-reading the claim you already know about
is not checking for claims**, and is the failure that feels most like diligence. For ROUTINE and
GRAVE, write `tasks/open/CLAIM-<task>.md` carrying `session`, `phase` and `paths`, and delete it at
close. **Staleness is derived, never read:** `git log -1 --format=%cI` on the claim file is the
holder's pulse, and it is stale only if uncommitted for four hours — a hand-typed stamp is wrong in
both directions and will evict live sessions. On a collision found mid-build, neither revert nor
continue silently: append an attributed note to their claim without rewriting it, and surface who
should own it.

**A GRAVE task that ends with no ledger write is an emitted error:**
`LEDGER ERROR — GRAVE task closed with no ledger write`. Silent state loss is the one failure that
hides itself.

Final report: **Open** (unresolved, believed-without-proof, what you'd check next) → **Settled**
(now known, with the evidence) → **Shipped** (files, what changed). Open leads because it is the
part with a shelf life.
