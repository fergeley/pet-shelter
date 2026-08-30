# Twelve defects found by adversarial review, eleven fixed

**Decided:** 2026-08-30

A hostile reviewer was pointed at the spec with instructions to attack rather than follow it —
vacuous compliance, contradictions, uncovered cases, cost. It found twelve. Three structural
claims were verified against the files before acting; all three held.

## The one that mattered most

`midwife.md` said *"Nothing here overrides an invariant; if this file and an invariant disagree,
the invariant wins."* The invariants are written as unconditional absolutes, and the mechanics
file's entire purpose is carving exceptions to them. **By its own precedence rule, every exception
was already illegal** — "TRIVIAL: no ledger" lost to invariant 9, incident mode's one question
lost to invariant 7, and the whole "ceremony is priced to the decision" principle was void.

Worse, the duplication had *already* diverged where it counted: invariant 6 read "three failed
hypotheses", the mechanics read "three **distinct** failed hypotheses", and precedence resolved
toward the invariant — deleting the single word that was the entire anti-reward-hacking mechanism.
That word had been identified as load-bearing earlier the same day and was silently non-binding.

**Fix:** an invariant now states the *default*; the mechanics may **narrow** one only where it
says so explicitly and names it (`narrows invariant N`), and an unmarked conflict is a bug in the
mechanics. Four narrowings are now marked. `distinct` was added to invariant 6.

## The rest

| # | Defect | Fix |
|---|---|---|
| 2 | FAST required *naming* a covering test, never that it covered anything — a one-line bypass of the whole apparatus, and single-file changes are most changes | Run the named case before and after; if it passes both, it never covered the change → re-triage to ROUTINE |
| 3 | Gate's raw-evidence rule let the agent pick its own target, ranked by unauditable self-assessment; nothing bound the output to the assumption; and a MEASURED top entry was unsatisfiable (Phase 1 forbids re-deriving, Phase 3 failed you for citing) | Evidence targets the highest-ranked **non-MEASURED** entry; new required line `Would have shown instead, if false:`; MEASURED satisfied by pasting the cited line |
| 4 | Incident vs one-way door gave opposite orders — a live outage *is* a veto item, so triage demanded the full lane and a halt exactly when speed matters. And the incident timeline lived in `open/`, which requires a settle condition and mandates deletion at close, destroying the postmortem | Incident mode explicitly outranks test 0 and constrains *how* not *whether*; timeline moves to `decisions/` on exit |
| 5 | An unmeasurable kill condition forced a false DIED or a quiet restatement — the rule modelled bad faith only, while the realistic case is environmental (this repo's own broken Docker) | Third disposition: **retired, not edited** — supersede via a new entry, leave the original verbatim |
| 6 | The gate, the spec's most important artifact, existed only in the transcript — the one medium the spec says things die in | Appended to the task's CLAIM file, moves to `decisions/` at close |
| 7 | CLAIM files failed exactly when needed: a crashed session's claim is indistinguishable from a live one, so a crash became a permanent work stoppage | CLAIM carries `session` / `updated` / `phase` / `paths`; stale-after-4h with no commits may be taken over |
| 8 | Mid-flight escalation — the *normal* case — had no defined effect on work already built | Park the diff on a branch (never stash), and a gate emitted after a build is labelled `retroactive:` |
| 9 | Hypothesis counter had no scope and no reset, so three unrelated failures killed a healthy design; and writing the third hypothesis line cost an obituary while omitting it cost nothing | Scoped per failing verification, resets when it passes |
| 10 | Four fields whose cheapest legal fill was worthless — notably `frame-confidence`, where `high` was always free and honesty was strictly penalised | `low` is the default; `high` requires a citation. `Not verified:` must name every ASSERTED/UNKNOWN entry verbatim. Agent-checkable trigger defined as a command plus expected output. ROUTINE's reduced gate defined as three lines |
| 12 | **Circular load order:** the description said "use for GRAVE-class work", but the triage table that produces the class lived inside the file you had to already invoke — while `CLAUDE.md` forbade inlining it | The four triage tests are now resident in `CLAUDE.md`, with that prohibition explicitly excepted. The `description` was rewritten in terms a router can evaluate, without lane jargon |

**Deduplication (#11)** — the repo's signature defect, applied to its own spec: kill-condition
immutability existed in 4 copies, the evidence standard in 4, the three-hypothesis rule in 3
(already diverged). Deleted the restatements from `spike-verdict.md`, the self-duplicate inside
`triage-rules.md`, and reduced `midwife.md` §5 to a pointer at `tasks/README.md`.

**Net effect: the spec shrank.** 613 → 593 lines *while* absorbing twelve fixes; `midwife.md`
254 → 238. The kill condition registered on 2026-08-30 — "if the spec is the same length or longer
in six months, the split failed" — has not fired.

## Declined

- **Deleting invariant 3** ("Deliberation is the expensive resource. Spend experiments freely").
  The reviewer is right that it has no mechanical consequence — the ladder already encodes
  cheapest-first — but the nine invariants are the human's design and the constitution is where
  non-mechanical commitments belong. Flagged, not removed.
- **Deleting the sub-run preference** as unfollowable. Softened to "where sub-runs are available"
  rather than dropped; the intent is still right when the environment permits it.
