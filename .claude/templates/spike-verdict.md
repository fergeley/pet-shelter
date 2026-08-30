# Spike verdict — structured return

The return shape for every Phase 2 experiment (`.claude/agents/midwife.md` §3), and the required
return shape for any sub-run dispatched to investigate anything.

Structured returns with raw excerpts outrank prose summaries — from a sub-agent **or from your own
reasoning** (invariant 4). A prose summary is inadmissible as evidence.

```markdown
## Spike: <the one assumption being tested>

**Verdict:** SURVIVED | DIED | UNTESTABLE-BY-CHEAP-EXPERIMENT
**Evidence class:** MEASURED | ASSERTED
**Ladder rung:** existing verification | spike | walking skeleton | reasoning-only
**Context-isolated:** yes (fresh sub-run) | no (in-session — say why)

**Kill condition:** <quoted verbatim from its tasks/open/ entry, as written before this ran>
**Fired:** yes | no

**How it was tested:**
```
<the exact command(s)>
```

**Raw excerpt:**
```
<verbatim output — failing assertion, counts, exit code, the row.
 Trim for length, never for meaning. Never paraphrase inside this block.>
```

**Files touched:** <paths, or `none — read-only spike`>
**Throwaway artifacts:** <scratch scripts written, and confirmation they were deleted>

**What this does NOT establish:** <the honest boundary of the result>
```

Then one line into the lane's running record:

```
SURVIVED — verified: <what, by what>
DIED — design changes: <what now>
UNTESTABLE-BY-CHEAP-EXPERIMENT → <default applied>
```

---

## Rules

- **Evidence class is not the verdict.** A reasoning-only rung returns `ASSERTED` even when the
  verdict is SURVIVED. `MEASURED` requires data from the actual system. Laundering a thought
  experiment into a measurement is the most expensive error available in this loop — every later
  step then cites it as established.
- **One assumption per spike.** A spike testing two things proves neither when it fails.
- **Quote the kill condition, never restate it.** Restating is how it drifts into something the
  result happens to satisfy. **A post-hoc edit to a kill condition is an automatic DIED.**
- **DIED returns to Phase 0 with the corpse in view. No salvage.** Three *distinct* failed
  hypotheses end the design, not the code; hypothesis four is illegal.
- **Three inconclusive experiments is a verdict, not a stall:**
  `UNTESTABLE-BY-CHEAP-EXPERIMENT`. Then proceed with the safest variant that does not depend on
  the unknown, log the Open item with the strongest agent-checkable trigger, surface it in the
  report. Do not halt — unless the unknown gates a one-way door, which is the only legal halt.
- **Prototype scanners before asserting from them.** If the spike rests on a regex or extractor,
  run it over the whole corpus as a throwaway first and eyeball the hits. The pattern is wrong on
  the first attempt approximately always, and a spike built on an unvalidated extractor returns a
  confident wrong answer.
