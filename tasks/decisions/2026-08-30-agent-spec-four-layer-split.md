# Agent spec split into four layers by frequency × enforceability

**Decided:** 2026-08-30

The Midwife spec was a single document. Split by asking, per rule, *what must be true about the
environment for this to bind?*

- **Layer 1 `CLAUDE.md`** — identity and invariants. Loaded in every session, so every line taxes
  all work; capped at constitution size.
- **Layer 2 `.claude/agents/midwife.md`** — conditional mechanics: triage, lanes, the GRAVE loop,
  gates, incident mode, session close. Paid for only on invocation.
- **Layer 3 `tasks/DECISIONS.md` + `tasks/OPEN.md`** — state, not spec. Makes the agent portable
  across repos and its knowledge inspectable without reading its config.
- **Layer 4 `.claude/templates/*`** — rules moved out of prose into artifacts that must be
  produced. A required artifact survives a long context; a required behaviour decays.

**Rationale:** the failure mode being avoided is `CLAUDE.md` bloat — procedures in the
always-loaded file mean every trivial task pays for conditional machinery and attention diffuses.
The sorting test, in order: *can it be a file/template/script?* → L4. *Is it a fact about this
codebase?* → L3. *Must it bind even when the agent isn't explicitly invoked?* → L1. Otherwise → L2.

**Kill condition (registered, not yet fired):** if six months from now `.claude/agents/midwife.md`
is the same length or longer, the split failed — ceremony was added rather than migrated into
artifacts and habits. The intended trajectory of the spec is to *shrink*.
