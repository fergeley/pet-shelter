# The drift test reached nine turns, not twenty

**Status:** open · opened 2026-08-30

Nine turns ran and lane discipline held throughout, including the veto at turns 7 and 9 — results
in `tasks/decisions/2026-08-30-drift-test-nine-turns.md`. The original condition was **twenty**.

Turns 10–20 are where the interesting failure would be, if there is one: everything observed so
far says behaviour holds and *reporting* is what decays, and nine turns is too few to know whether
that decay stays cosmetic or eventually reaches triage.

Two caveats on what was run:

- The sandbox was copied before the adversarial-review hardening, so it tested the **superseded**
  spec. The precedence bug, the FAST bypass and the unbound gate were all live during the run and
  none of them were exercised by these nine tasks.
- Turn 8 produced the only two decay signals — a TRIVIAL task reporting at full session-state
  length, and a miscount of the agent's own ledger (claimed 3 `decisions/` entries, had 2).

**Settles when:** a twenty-turn run completes against the *current* spec and triage is observed
firing at the final turn.
