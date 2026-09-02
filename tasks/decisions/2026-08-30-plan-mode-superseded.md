# "Plan mode for any non-trivial task" superseded by the one-way-door rule

**Decided:** 2026-08-30

The prior `CLAUDE.md` required plan mode for anything with 3+ steps. Invariant 7 replaces it:
halting is for one-way doors only; everything else has an autonomous default.

**Rationale:** the old rule was the F1 regression in spec form — a halt rule that had forgotten
*why* halting is expensive. It made the agent stop and ask on work it was equipped to finish,
which is the failure the whole lineage exists to remove. Planning itself was never the problem
and is retained: ROUTINE plans inline, GRAVE plans through registered kill conditions. What was
dropped is *stopping to get permission to plan*.

**This entry is the sign on the removed fence** (§4 fence sweep). The rule protected against
under-considered multi-step edits; that threat is now carried by triage + the Build Gate, both of
which run without a halt.
