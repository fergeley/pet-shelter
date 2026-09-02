# Build Gate — Phase 3

Fill it, emit it, **and append it to the task's `tasks/open/CLAIM-<task>.md`**. A gate that lives
only in the transcript dies there. **Nothing gets built until the gate is emitted.**

`[x]` is a claim you are making. `[ ]` is a claim you are declining to make, with the reason — an
honestly unchecked line is a passing gate. Deleting a line is not.

**ROUTINE uses the reduced form:** `Claim:`, raw evidence, `Not verified:`. Nothing else.

```markdown
## Build Gate — <task>  ·  lane: ROUTINE | GRAVE  ·  branch: <name>
## [retroactive: built before this gate — <what was built>]   ← only if escalated mid-flight

### Phase 0 — frame
- [ ] `Problem:` <one sentence>
- [ ] `Claim:` <approach X, because Y>
- [ ] `frame-confidence:` low | high   (high requires citing where the frame came from;
      low means the frame is A1 in the stack below)

### Phase 1 — stack + fences
- [ ] Assumption stack pasted below, ≤5 entries, each MEASURED | ASSERTED | UNKNOWN,
      ordered by "which would I rather not be wrong about".
- [ ] Memory searched *before* listing — grepped `tasks/decisions/` and `tasks/open/` for this
      question. Nothing re-derived that the repo had already answered.
- [ ] **Fence sweep complete.** Every existing behaviour this design deletes/replaces/simplifies
      is cited (ledger entry, commit, ADR) or logged as an Open item. `n/a — nothing removed`
      is a valid fill.

### Phase 2 — falsification
- [ ] **RAW EVIDENCE for the highest-ranked entry that is NOT MEASURED**, pasted verbatim.
      A citation without raw output **fails this gate**.
      Command: `...`
      Output:
      ```
      <actual output>
      ```
      **Would have shown instead, if false:** <...>
      ← if you cannot answer this, the command did not test the assumption.
      (A MEASURED entry is satisfied by pasting the verbatim cited line, not by re-deriving it.)
- [ ] Every other *invalidating* assumption: "we know X because we measured/observed Y" — or a
      logged Open item with an agent-checkable trigger (a command plus its expected output).
- [ ] Kill conditions were written to `tasks/open/` before the spike ran and not edited after.
      Outcome: fired / did not fire / retired-as-unevaluable / n/a.
- [ ] **Failure Truth** — what actually happens when this breaks in production: <one line>
- [ ] **Reversibility** — how this gets undone: <one line>

### Hygiene
- [ ] **No ride-alongs.** The diff contains this task and nothing else.
- [ ] **Ledger** — `tasks/decisions/` appended if a decision was made; `tasks/open/` holds every
      conclusion reached without evidence; this gate appended to the CLAIM file.

**Not verified:** <name every ASSERTED and UNKNOWN entry from the stack above, verbatim, plus
anything else a reviewer must not assume. If the stack has ASSERTED or UNKNOWN entries and this
line does not name them, the gate is not filled.>
```

---

## Filling it honestly

- **The raw-evidence line is the gate.** Everything else is a format, and formats are cheap to
  satisfy. Paste the output, and say what it would have shown had the assumption been false.
- **Do not fill the gate before doing the work.** Writing it first and making it true afterwards
  converts a check into a plan, and it checks nothing. If you escalated mid-flight and genuinely
  built first, label it `retroactive:` — an honest retroactive gate is worth something; a
  retroactive gate pretending to be prospective is worth less than none.
