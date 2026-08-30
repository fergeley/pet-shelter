# Build Gate — Phase 3

Copy the block, fill it, emit it. **Nothing gets built until the gate is emitted**
(`.claude/agents/midwife.md` §3). Required for GRAVE; required in reduced form for ROUTINE.

This is a mechanical output checklist, not a disposition. `[x]` is a claim you are making; `[ ]`
is a claim you are declining to make, with the reason — an honestly unchecked line is a passing
gate. Deleting a line is not.

```markdown
## Build Gate — <task>  ·  lane: ROUTINE | GRAVE  ·  branch: <name>

### Phase 0 — frame
- [ ] `Problem:` <one sentence>
- [ ] `Claim:` <approach X, because Y>
- [ ] `frame-confidence:` high | low   (if low: the frame is A1 in the stack below)

### Phase 1 — stack + fences
- [ ] Assumption stack pasted below, ≤5 entries, each marked MEASURED | ASSERTED | UNKNOWN,
      ordered by "which would I rather not be wrong about".
- [ ] Memory searched *before* listing — `tasks/decisions/`, `tasks/open/`, existing tests.
      Nothing re-derived that the repo had already answered.
- [ ] **Fence sweep complete.** Every existing behaviour this design deletes/replaces/simplifies
      is either cited (ledger entry, commit, ADR) or logged as an Open item. `n/a — nothing
      removed` is a valid fill. A fence found after this gate is a process failure.

### Phase 2 — falsification
- [ ] Every *invalidating* assumption carries one sentence: "we know X because we
      measured/observed Y" — or a logged Open item with an agent-checkable trigger.
- [ ] **RAW EVIDENCE for the top assumption, pasted verbatim below.**
      A citation without raw output **fails this gate**.
      Command: `...`
      Output:
      ```
      <actual test output / actual number / actual sub-run verdict>
      ```
- [ ] Kill conditions were written to `tasks/open/` before the spike ran, and were not edited
      afterwards. Outcome: fired / did not fire / n/a.
- [ ] **Failure Truth** — what actually happens when this breaks in production: <one line>
- [ ] **Reversibility** — how this gets undone: <one line>

### Hygiene
- [ ] **No ride-alongs.** The diff contains this task and nothing else — no opportunistic
      refactor, no unrelated formatting, no other session's files staged.
- [ ] **Ledger** — `tasks/decisions/` appended if a decision was made; `tasks/open/` holds
      every conclusion reached without evidence.

**Not verified:** <the honest list — what a reviewer must not assume from this gate.>
```

---

## Filling it honestly

- **The raw-evidence line is the gate.** Everything else is a format, and formats are easy to
  satisfy vacuously. Paste the output.
- **A gate with every box ticked is suspicious, not impressive.** Most real work leaves something
  unproven; *Not verified* is where this artifact's value actually sits.
- **Do not fill the gate before doing the work.** If you write it first and make it true
  afterwards, you have converted a check into a plan, and it checks nothing.
