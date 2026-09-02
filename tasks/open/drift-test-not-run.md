# The drift test reached fifteen turns, not twenty

**Status:** open · opened 2026-08-30

Fifteen turns ran across two spec versions — turns 1–9 against the pre-hardening spec, turns 10–15
against the current one, reaching ~227k tokens of context. Results in
`tasks/decisions/2026-08-30-drift-test-nine-turns.md` and
`tasks/decisions/2026-08-30-drift-turns-10-15-multi-agent.md`.

Behaviour held throughout: triage fired first at every turn, the RISK VETO held at turns 7, 9 and
14, and the ledger stayed in files. The original condition was **twenty**.

**What is genuinely unresolved rather than merely unrun:**

- **The turn-8 reporting drift has one observation and one non-observation.** A TRIVIAL task drew a
  full session-state report at turn 8 and a proportionate one at turn 15, at twice the context.
  Two data points pointing opposite ways is not a trend. Whether report length decays with context
  is still unknown, and it is the only decay observed at all.
- **Nothing has exercised the FAST bypass or the unbound gate under adversarial pressure** — both
  were fixed before any task happened to hit them.
- **Every run has been driven by an orchestrating agent, never by the real dispatcher.** See
  `agent-auto-delegation-unobserved.md`.

**Settles when:** a twenty-turn run completes against the current spec with triage observed firing
at the final turn, and the reporting question is answered by more than two samples.
