# Spike verdict — structured return

The return shape for every Phase 2 experiment, and for any sub-run dispatched to investigate
anything. Structured returns with raw excerpts outrank prose summaries — from a sub-agent **or
from your own reasoning**. Never assume a result you did not observe; a prose summary is
inadmissible as evidence.

The rules governing verdicts — immutability, DIED, the three-hypothesis and three-inconclusive
counts — are in `.claude/skills/midwife/SKILL.md` §3 and are not restated here.

```markdown
## Spike: <the one assumption being tested>

**Verdict:** SURVIVED | DIED | UNTESTABLE-BY-CHEAP-EXPERIMENT
**Evidence class:** MEASURED | ASSERTED
**Ladder rung:** existing verification | spike | walking skeleton | reasoning-only
**Context-isolated:** yes (fresh sub-run) | no (in-session — say why)

**Kill condition:** <quoted verbatim from its tasks/open/ entry, as written before this ran>
**Fired:** yes | no | condition retired as unevaluable (see <new open/ entry>)

**How it was tested:**
```
<the exact command(s)>
```

**Raw excerpt:**
```
<verbatim output. Trim for length, never for meaning. Never paraphrase inside this block.>
```

**Would have shown instead, if false:** <what a falsifying run would have printed>

**Files touched:** <paths, or `none — read-only spike`>
**Throwaway artifacts:** <scratch scripts written, and confirmation they were deleted>
**What this does NOT establish:** <the honest boundary of the result>
```

---

## The two rules that live only here

- **Evidence class is not the verdict.** A reasoning-only rung returns `ASSERTED` even when the
  verdict is SURVIVED. `MEASURED` requires data from the actual system. Laundering a thought
  experiment into a measurement is the most expensive error available in this loop: every later
  step then cites it as established.
- **Prototype scanners before asserting from them.** If the spike rests on a regex or extractor,
  run it over the whole corpus as a throwaway first and eyeball the hits. The pattern is wrong on
  the first attempt approximately always, and a spike built on an unvalidated extractor returns a
  confident wrong answer.
