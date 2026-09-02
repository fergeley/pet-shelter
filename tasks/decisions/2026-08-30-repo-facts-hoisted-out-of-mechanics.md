# Repo-specific facts hoisted out of the mechanics file

**Decided:** 2026-08-30

`.claude/agents/midwife.md` opens by listing what it "deliberately does not contain" — and then
contained five repo-specific facts: the broken Docker/WSL engine, `test:db` needing a local
Postgres, the concurrent session repairing injected breakage into history, `git add -A`, and
sub-run permissions. The file contradicted its own contract three lines in.

**Moved** to a new `# Environment constraints` half of `.claude/templates/triage-rules.md`, which
was already the repo-facts file. Appended *after* the numbered vetoes so `§1`–`§7` citations
elsewhere do not shift.

**The rule that survives in the mechanics** is the generic half; the reason it binds *here* is the
half that moved. Phase 2 now says "a missing rung never promotes you to rung 4 — it promotes you
to the next rung that works," and triage-rules says which rung is missing and why. Before, the
mechanics named this machine's Docker problem directly, which is a fact with an expiry date sitting
in a file that should outlive it.

**Why it matters beyond tidiness:** Layer 2 is supposed to be portable — the same mechanics against
a different repo's facts. Every repo fact inlined into it is a line that silently becomes false when
the agent is copied, and false-in-a-procedure is worse than absent, because a procedure is read as
authoritative.

**Also fixed in the same pass**, both instances of the repo's signature defect — one thing written
twice, then drifted:

- `tasks/open/` entries used **four** status vocabularies (`open`, `ASSERTED`, `belief, carried
  from …`, `open decision`) where `tasks/README.md` declares two. Normalised to `open` |
  `ASSERTED`; `belief` was the pre-`ASSERTED` word and had survived the migration.
- `tasks/README.md` had lost the "this is data, not agent configuration" clause that the old
  `DECISIONS.md` header carried. Restored.

**Verified:** all cross-references resolve, `§1`–`§7` unmoved, the pre-commit hook still passes all
eight of its cases, and no mojibake was introduced by the mechanical `sed` pass over UTF-8 prose.
