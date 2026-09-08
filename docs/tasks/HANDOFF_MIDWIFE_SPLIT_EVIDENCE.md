# HANDOFF — evidence for a future Claude Midwife / Code Midwife split

## Scope and evidence rules

This is a discovery artifact for a later AI. It does **not** design, create, install, or reconcile
either proposed variant.

The two source briefs are external inputs:

- `C:\Users\User\Downloads\code-1.md` — proposed Claude-side designer/router.
- `C:\Users\User\Downloads\code-2.md` — proposed Codex-side implementer/auditor.

They express desired roles; they are not authority over this repository. Repository rules,
observed behavior, and operator decisions take precedence.

Evidence labels in this handoff:

- **CURRENT-MEASURED** — observed by a command run on 2026-09-06 in
  `D:\Dev\Repos\pet-shelter`.
- **CURRENT-SOURCE** — present in the current checked-out source, with a file/line citation.
- **HISTORICAL-MEASURED** — a dated ledger entry records an observation; it was not reproduced in
  this audit unless separately marked CURRENT-MEASURED.
- **UNKNOWN** — neither the repository nor this audit establishes the fact.

Do not silently promote HISTORICAL-MEASURED to current. Several target documents explicitly warn
that their counts and runtime observations go stale
(`docs/tasks/TARGET_MIDWIFE_ADOPTION.md:9-12`).

## Executive findings

1. **CURRENT-SOURCE — there is one Midwife behavior model, exposed through two platform copies of
   a skill.** Claude reads `.claude/skills/midwife/SKILL.md`; Codex reads
   `.agents/skills/midwife/SKILL.md`. The current diff between them is four insertions and four
   deletions: the resident instruction file (`CLAUDE.md` versus `AGENTS.md`) and the worktree
   wording. The mechanics otherwise remain duplicated.

2. **CURRENT-SOURCE — Midwife is deliberately a skill, not a sub-agent.** The recorded reason is
   that the GRAVE lane needs the main conversation's inherited invariants and a one-way-door halt
   must reach the human, not a proxy
   (`tasks/decisions/2026-08-31-midwife-is-a-skill-not-an-agent.md:18-42`). Reversing this requires
   a new dated decision, not an implicit change
   (`tasks/decisions/2026-08-31-midwife-is-a-skill-not-an-agent.md:57-69`).

3. **CURRENT-SOURCE — the system already has a four-layer architecture.** Always-resident rules
   live in `AGENTS.md` (Claude adds `CLAUDE.md`), conditional mechanics live in the Midwife skill,
   state lives in `tasks/open/` and `tasks/decisions/`, and required artifacts live in
   `.claude/templates/`. The original rationale is frequency times enforceability, not model
   identity (`tasks/decisions/2026-08-30-agent-spec-four-layer-split.md:5-20`).

4. **CURRENT-SOURCE — there are five specialist roles on each platform, with name parity:**
   `atomic-commit`, `schema-auditor`, `spike-runner`, `test-writer`, and `ui-critic`. Claude uses
   Markdown definitions and tool declarations; Codex uses TOML definitions and explicit
   `sandbox_mode` values.

5. **CURRENT-SOURCE — durable state is already defined and intentionally has exactly two
   categories.** `tasks/open/` holds unresolved or asserted items; `tasks/decisions/` holds settled
   choices and obituaries. A third findings or reconciliation state store would require an
   explicit design decision because the ledger contract says there is no third category
   (`tasks/README.md:9-18`).

6. **CURRENT-SOURCE — Claude and Codex do not currently have equivalent enforcement.** Claude has
   project `permissions.deny`/`permissions.ask`, two agent-specific allowlist guards, and a
   `PostToolUse` drift log (`.claude/settings.json:17-60`,
   `.claude/hooks/agent-guard.mjs:73-90`, `.claude/hooks/agent-guard.mjs:243-266`). Codex custom
   agents declare read-only or workspace-write sandboxes and the repository wires an observational
   `PostToolUse` drift hook; the ledger explicitly says it is not an authorization boundary
   (`tasks/decisions/2026-09-06-codex-import-is-adapted-not-copied.md:5-16,24-26`).

7. **CURRENT-MEASURED — no Claude Midwife or Code Midwife variant exists yet.** Repository search
   found no `claude-midwife`, `code-midwife`, `findings-log`, or `recon-map`. No files were created
   for either agent during this audit.

8. **UNKNOWN — the deployed monolithic Midwife is not in the named inputs or repository.** A
   `C:\Users\User\Downloads\midwife-portable.zip` file exists, but it was not named as an input and
   was not opened. Whether it is the deployed baseline is unknown. SAME / MODIFIED / NEW / DROPPED
   reconciliation cannot be evidence-based until the operator identifies the authoritative
   deployed source.

## Current architecture

| Layer | Current owner | What it contains | Enforcement status |
|---|---|---|---|
| Resident constitution | `AGENTS.md:11-34` | Nine invariants: triage, verification, experiment-first reasoning, observed evidence, immutable kill conditions, bounded failure, one-way-door halts, tests as system, file-backed memory | Instructional; numbered citation drift is checked by `npm run docs:check` |
| Claude resident overlay | `CLAUDE.md:1-59` | Imports `AGENTS.md`, then adds planning, sub-agent, verification, simplicity, task-management, and drift-log-close rules | Instructional; contains a live tension with autonomous non-halting defaults |
| Conditional mechanics | `.claude/skills/midwife/SKILL.md` and `.agents/skills/midwife/SKILL.md` | Triage refinements, lanes, GRAVE phases, incident mode, session close | Skill invocation; runtime auto-invocation is not proven |
| Repository facts | `.claude/templates/triage-rules.md:1-130` | Seven one-way doors and current environment constraints | Data for triage; each fact must be re-verified before reliance |
| Gate artifact | `.claude/templates/gate-checklist.md:1-67` | Frame, stack, fences, raw evidence, failure truth, reversibility, hygiene | Required by prose; no current Stop hook proves every GRAVE turn emitted it |
| Experiment return | `.claude/templates/spike-verdict.md:1-50` | Verdict, evidence class, ladder rung, context isolation, immutable condition, raw excerpt, falsifier, cleanup, limits | Required by Midwife and `spike-runner` contracts |
| Durable state | `tasks/README.md:1-63` | One file per open question or settled decision; CLAIM files are temporary open entries | Git-backed and human-readable; state discipline remains model-driven |
| Claude platform guard | `.claude/settings.json`, `.claude/hooks/agent-guard.mjs` | Deterministic denies, advisory asks in auto mode, two specialist allowlists, tree drift observation | Partly runtime-enforced; liveness differs by wiring surface |
| Codex platform guard | `.codex/agents/*.toml`, `.codex/hooks.json`, `.codex/hooks/drift-log.mjs` | Per-agent sandboxes and best-effort tree drift observation | Sandbox is declared; drift script is tested; live hook firing was not measured here |

### Live instruction tension to preserve as a finding

**CURRENT-SOURCE.** `CLAUDE.md` says to use plan mode for every non-trivial task and to "check in
before starting implementation" (`CLAUDE.md:3-8,34-40`). `AGENTS.md` says halting is for one-way
doors and everything else has an autonomous default (`AGENTS.md:23-28`). The Midwife mechanics
likewise make Phase 0 exploration autonomous and reserve halt for an unknown gating a one-way door
(`.agents/skills/midwife/SKILL.md:94-97,152-160`). A future Claude-side design must resolve the
operational meaning; it must not silently choose one sentence and ignore the others.

## Current Midwife mechanics

### Classification and lanes

- **CURRENT-SOURCE.** Triage order is RISK VETO, mechanical trivial, fast path, then
  routine/grave (`AGENTS.md:17-29`).
- **CURRENT-SOURCE.** TRIVIAL has no gate or ledger; FAST must observe a named test discriminate;
  ROUTINE uses a reduced three-line gate; GRAVE uses all five phases
  (`.agents/skills/midwife/SKILL.md:39-59`).
- **CURRENT-SOURCE.** Mid-flight escalation parks work on a branch and labels a late gate
  retroactive; de-escalation requires a decision entry
  (`.agents/skills/midwife/SKILL.md:61-69`).

### GRAVE loop

- **CURRENT-SOURCE.** Phase 0 frames `Problem`, `Claim`, and confidence. Low is the default;
  ambiguity triggers exploration-by-verification, not a question
  (`.agents/skills/midwife/SKILL.md:80-97`).
- **CURRENT-SOURCE.** Phase 1 searches the ledger and tests first, caps the assumption stack at
  five, labels entries MEASURED / ASSERTED / UNKNOWN, and performs Chesterton's Fence analysis
  before the gate (`.agents/skills/midwife/SKILL.md:99-126`).
- **CURRENT-SOURCE.** Phase 2 climbs existing verification, spike, walking skeleton, then
  reasoning-only. Kill conditions are written before a spike and never edited; three inconclusive
  experiments choose the safest non-dependent default
  (`.agents/skills/midwife/SKILL.md:128-163`).
- **CURRENT-SOURCE.** Phase 3 requires raw falsifiable evidence and an independent review before
  close (`.agents/skills/midwife/SKILL.md:165-184`).
- **CURRENT-SOURCE.** Phase 4 uses explicit path staging and a per-symptom three-distinct-hypothesis
  failure ceiling (`.agents/skills/midwife/SKILL.md:186-200`).
- **CURRENT-SOURCE.** Incident mode overrides normal ceremony, stays revert-sized, preserves the
  evidence standard, forbids schema/mail/history ride-alongs, and moves its timeline into a dated
  decision (`.agents/skills/midwife/SKILL.md:204-225`).

### Repository-specific one-way doors

**CURRENT-SOURCE.** The veto list currently covers: production-backed local database writes,
schema/data changes without Prisma-managed rollback, real outbound email, secrets in ignored local
files, shared-index/history operations, anything outbound or published, and deleting or
overwriting unread material (`.claude/templates/triage-rules.md:13-86`). These are repository facts,
not portable Midwife mechanics (`.claude/templates/triage-rules.md:7-9,92-104`).

## Existing specialist roster

| Role | Claude surface | Codex surface | Current boundary |
|---|---|---|---|
| `schema-auditor` | `Read, Grep, Glob`; PreToolUse allowlist | `sandbox_mode = "read-only"` | Never run Prisma or connect to DB; anything needing real data is returned unknown |
| `atomic-commit` | Read shell plus PreToolUse denial of every Git write | `sandbox_mode = "read-only"` | Emits path-scoped commands; caller performs them |
| `spike-runner` | Read/search/shell | `sandbox_mode = "workspace-write"` | One assumption, no ledger edits, exact spike-verdict shape |
| `test-writer` | Read/edit/write/search/shell | `sandbox_mode = "workspace-write"` | Writes tests, not product fixes; uses the repository Vitest harness |
| `ui-critic` | Read/search/shell | `sandbox_mode = "read-only"` | Reviews the repository's token system, not generic aesthetics |

**CURRENT-MEASURED.** Both directories contain exactly these five basenames. The Codex import was
deliberately adapted rather than copied: read-only roles use read-only sandboxes, writing roles use
workspace-write, Claude hook copies were removed, and shared templates remain canonical
(`tasks/decisions/2026-09-06-codex-import-is-adapted-not-copied.md:12-22`).

## Evidence timeline and incident-backed lessons

### 2026-08-30 — architecture and mechanics

- **HISTORICAL-MEASURED.** The monolithic specification was split into four layers to prevent
  always-loaded instruction bloat and to put enforceable artifacts outside prose
  (`tasks/decisions/2026-08-30-agent-spec-four-layer-split.md:5-24`).
- **HISTORICAL-MEASURED.** Reconstructing from nine rules lost the fence sweep, walking skeleton,
  bounded failure protocol, assumption stack, frame, ledger error, and evidence-class field. The
  conclusion was that rules are lossy compression of the failures that produced them
  (`tasks/decisions/2026-08-30-grave-lane-rebuilt-on-phases.md:5-29`).
- **HISTORICAL-MEASURED.** Adversarial review found twelve defects; eleven were fixed while the
  specification shrank. The most severe defect was a precedence clause that made every intended
  exception illegal. Other fixes closed the FAST-test bypass, vacuous gate evidence, incident
  contradictions, post-hoc kill-condition edits, transcript-only gates, stale claims, and unscoped
  hypothesis counting (`tasks/decisions/2026-08-30-adversarial-review-hardening.md:5-48`).
- **HISTORICAL-MEASURED.** Four litmus runs observed correct proportional handling of a typo,
  autonomous exploration of an ambiguous task, a halt at an irreversible unknown, and a
  revert-sized incident response. Independent verification recorded 55 files / 724 tests and clean
  typecheck at that time (`tasks/decisions/2026-08-30-litmus-tests-all-passed.md:5-17`). One test
  accidentally reached a real build, establishing that agent tests must be sandboxed by their
  widest possible lane (`tasks/decisions/2026-08-30-litmus-tests-all-passed.md:38-40`).
- **HISTORICAL-MEASURED.** Nine-turn and six-turn continuation tests reached about 227k tokens.
  Triage, vetoes, and file-backed memory held across fifteen turns. Reporting expanded incorrectly
  once and included an unmeasured ledger count; the same shape was proportionate at turn 15, so the
  reporting question remains unexplained rather than fixed
  (`tasks/decisions/2026-08-30-drift-turns-10-15-multi-agent.md:77-85`).
- **HISTORICAL-MEASURED.** A late search found first-party worktrees, task locking, Stop hooks,
  goals, and review facilities stronger than hand-written coordination. What remained genuinely
  local was triage/lanes, the falsification ladder, repo vetoes, and the durable knowledge ledger
  (`tasks/decisions/2026-08-30-prior-art-most-of-this-is-first-party.md:10-39`).

### 2026-08-31 — skill placement, agents, liveness, and isolation

- **HISTORICAL-MEASURED.** Midwife moved from sub-agent to skill because a sub-agent did not
  inherit the resident constitution and could not directly hand a one-way-door decision to the
  human. `spike-runner` retained the one phase that benefits from isolated context
  (`tasks/decisions/2026-08-31-midwife-is-a-skill-not-an-agent.md:18-42`).
- **HISTORICAL-MEASURED.** Five roles were ported and retargeted; six candidates were rejected as
  duplicate, stack-specific, or a second design system. The record explicitly rejected three-tree
  configuration mirroring and its synchronization gate at that time
  (`tasks/decisions/2026-08-31-agent-roster-ported-and-pruned.md:11-52`).
- **HISTORICAL-MEASURED.** An unquoted colon broke a YAML agent description silently. This produced
  `agentDefinitions.test.ts`, because a parser-owned config that disappears on parse failure needs
  structural tests (`tasks/decisions/2026-08-31-declared-tools-are-not-a-mechanism.md:40-50`).
- **HISTORICAL-MEASURED.** Agent body, frontmatter-hook, and newly added agent changes were all
  ignored until a new session. Therefore an agent change cannot prove its own live installation;
  it needs an observable marker or liveness log in a later session
  (`tasks/decisions/2026-08-31-agent-definitions-are-session-start-snapshots.md:12-69`).
- **HISTORICAL-MEASURED.** Four adversarial specialist runs observed tool-list enforcement and one
  frontmatter hook invocation, but also proved that a tool-name write guard missed Bash writes and
  blocked correct mutation testing. The lesson is to constrain the behavior/end state, not a
  particular editing tool (`tasks/decisions/2026-08-31-agent-grinder-four-runs.md:8-50`).
- **HISTORICAL-MEASURED.** A real worktree probe took 0.684 seconds and ran 664 tests in 10.40
  seconds through upward `node_modules` resolution; secrets did not follow and the main index was
  unchanged (`tasks/decisions/2026-08-31-worktrees-are-free-and-the-guard-was-the-wrong-layer.md:16-60`).
  This killed a 335-line end-state guard as the wrong layer
  (`tasks/decisions/2026-08-31-worktrees-are-free-and-the-guard-was-the-wrong-layer.md:62-82`).

### 2026-09-05 to 2026-09-06 — native enforcement and Codex adaptation

- **HISTORICAL-MEASURED.** A hand-written irreversible-command parser accumulated 8, then 12, then
  14 defects over independent passes. Corpus replay covered 4,917 distinct commands / 5,028
  invocations and initially denied about 85 legitimate commands. It was replaced with narrower
  first-party permission rules while the non-blocking tree drift log remained
  (`tasks/decisions/2026-09-05-first-party-permissions-replace-the-hand-rolled-fence.md:13-35,46-92`).
- **HISTORICAL-MEASURED.** `permissions.deny` refused a command, while `permissions.ask` allowed
  even `git reset --hard` without prompting in auto mode. Anything that must be impossible belongs
  in deny; ask is advisory in this environment
  (`docs/tasks/TARGET_AGENT_GUARDRAILS.md:12-38`).
- **CURRENT-SOURCE.** The current project settings have 13 deny entries, 9 ask entries, no
  project-level `autoMode`, and a PostToolUse drift hook
  (`.claude/settings.json:17-60`). The known deterministic gap is that permission patterns match
  only when the dangerous command leads the string; twelve prefix/wrapper shapes are pinned as a
  ledger, not a fence (`docs/tasks/TARGET_AGENT_GUARDRAILS.md:44-58`).
- **CURRENT-SOURCE.** The invariants were restored to `AGENTS.md` after sixteen references across
  eight files had continued pointing at deleted rules with no error. Citations now name rules and
  `npm run docs:check` guards live references
  (`docs/tasks/TARGET_AGENT_GUARDRAILS.md:150-158,192-199`).
- **CURRENT-SOURCE.** The Codex port exists only on the current feature branch. It keeps explicit
  sandboxes and a portable, NUL-delimited drift logger, but deliberately does not copy Claude's
  authorization guard (`tasks/decisions/2026-09-06-codex-import-is-adapted-not-copied.md:5-26`).

## Current measured snapshot — 2026-09-06

### Git and inventory

```text
branch: chore/codex-native-integration
HEAD: eeb0269
tracking: origin/chore/codex-native-integration
working tree and index: clean before this handoff was written
origin/master...HEAD: 0 behind, 3 ahead
Claude custom agents: 5
Codex custom agents: 5
Claude skills: 2
Codex project skills: 7
ledger decisions: 33
ledger open entries: 16
```

The three branch-only commits are `49932b1` (Codex adaptation), `7703f56` (Developer Drive
runbook), and `eeb0269` (SOPS failure record). A future creator working from `master` will not see
the Codex-side evidence unless this branch is merged or used as its base.

### Specification size

```text
AGENTS.md                                      121 lines
CLAUDE.md                                       60 lines
.claude/skills/midwife/SKILL.md                255 lines
.agents/skills/midwife/SKILL.md                255 lines
.claude/templates/gate-checklist.md             67 lines
.claude/templates/spike-verdict.md               50 lines
.claude/templates/triage-rules.md               130 lines
tasks/README.md                                  63 lines
active Claude scope including AGENTS.md         746 lines
active Codex scope including AGENTS.md          686 lines
old 2026-08-30 comparison scope                 625 lines
```

The old target registered 597 lines as its six-month baseline
(`docs/tasks/TARGET_MIDWIFE_ADOPTION.md:14-36`). The like-for-like scope is now 625, up 28 lines,
but the six-month condition is not due and the constitutional layer moved from `CLAUDE.md` to
`AGENTS.md`. Record this as a trajectory datum, not a fired kill condition.

### Verification run now

```text
$ npx vitest run --project unit tests/unit/agentDefinitions.test.ts \
    tests/unit/codexIntegration.test.ts tests/unit/agentGuard.test.ts \
    tests/unit/docInvariants.test.ts

Test Files  4 passed (4)
Tests       45 passed (45)
Duration    6.90s
```

These tests currently cover Claude definition structure and committability, Claude specialist
allowlists and drift behavior, current permission wiring, Codex path/sandbox/portability checks,
quoted/non-ASCII Git paths, and live invariant-reference resolution
(`tests/unit/agentDefinitions.test.ts:91-214`, `tests/unit/agentGuard.test.ts:116-404`,
`tests/unit/codexIntegration.test.ts:28-158`, `tests/unit/docInvariants.test.ts:30-83`).

```text
$ npm run docs:check
scanned 539 tracked files
invariants defined: 1, 2, 3, 4, 5, 6, 7, 8, 9
invariant references: 13, unresolved: 0 live + 0 archived
OK: every live invariant reference resolves.
```

### Liveness and installation

- **CURRENT-MEASURED.** `%TEMP%\claude-agent-guard.log` still contains only one specialist line:
  `2026-08-30T18:08:54.747Z test-writer Write`. No current `schema-auditor` or `atomic-commit` line
  was present. This keeps `tasks/open/matcherless-hook-wiring-unverified.md:32-53` open.
- **CURRENT-MEASURED.** `.git/hooks/commit-msg` exists. `.git/hooks/pre-commit` does not; only the
  sample exists. This agrees with `tasks/open/pre-commit-hook-not-installed.md:1-20`.
- **CURRENT-MEASURED.** Codex CLI is `0.153.0`; its local feature listing reports `hooks` and
  `multi_agent` as stable. This establishes local capability names, not live project-hook firing.
- **UNKNOWN.** No default `%TEMP%\codex-agent-drift.log` existed during this audit. The focused test
  drove the script with isolated paths and passed, but no fresh Codex session shakedown was run.

## Gap table against the two proposed briefs

| Brief says | Repository currently has | Evidence status and delta |
|---|---|---|
| Two explicit variants: Claude designer/router and Codex implementer/auditor | One shared Midwife skill copied to two platform skill directories | **CURRENT-SOURCE — absent.** No variant identities or interface exist |
| Claude side classifies and routes but does not answer directly | Main-conversation Midwife triages and also builds/verifies | **CURRENT-SOURCE — semantic conflict.** A pure router is not the current Midwife role |
| Gather all findings into `findings-log.md` | Distributed one-file ledger plus `tasks/lessons.md` and target docs | **CURRENT-SOURCE — storage conflict.** A new append-only log would be a third state store unless explicitly reconciled with `tasks/README.md` |
| Preserve superseded history | Decision files are immutable; reversals create new dated entries | **CURRENT-SOURCE — already covered** (`tasks/README.md:52-59`) |
| Every claim uses REPO-VERIFIED / INFERRED / UNKNOWN | Mechanics use MEASURED / ASSERTED / UNKNOWN; ledger distinguishes open from asserted | **CURRENT-SOURCE — vocabulary delta.** Needs one canonical mapping, not parallel labels |
| Ask before fetching missing sources | Midwife explores autonomously and halts only at one-way doors | **CURRENT-SOURCE — policy conflict.** Requires operator choice |
| Every gate traces to a recorded incident or test | Vetoes and many guard decisions are incident-backed; no single gate registry maps every rule | **PARTIAL.** Evidence exists but is distributed |
| Behavior, not tools, across all paths | Principle is recorded after tool-name guards failed; current enforcement still necessarily uses platform matchers and command prefixes | **PARTIAL.** Treat mechanism scope and behavioral intent separately |
| Fail closed and canonicalize all matching | Atomic-commit guard allowlists Git reads; Codex drift logger uses NUL-delimited porcelain; main permission rules have known prefix gaps | **PARTIAL.** Not a universal property of the system |
| One source of truth | Strong ledger and duplication rules; current Midwife skill itself still has two near-identical copies | **PARTIAL.** Policy is strong; platform copy ownership is unresolved |
| Split analysis into shared / Claude / Codex / split-risk | No such classified map exists | **ABSENT.** This handoff supplies evidence, not the classification decision |
| Claude gate registry with trigger, enforcement layer, incident, override, liveness | Veto list, settings, hooks, tests, and decisions each carry pieces | **ABSENT AS REGISTRY.** Do not infer one by copying prose without resolving supersessions |
| Interface contract between variants | No message schema, ownership contract, or shared-state handoff exists | **ABSENT** |
| `recon-map.md` and DEAD LIST | Immutable decisions record reversals and rejected ideas; no deployed-baseline map exists | **PARTIAL STORAGE, NO RECONCILIATION.** Baseline is unknown |
| Every Code-side guard has fresh-session liveness | Claude has one historical specialist log line; Codex script has unit coverage but no current live log | **OPEN** |
| Overrides are launch-time environment variables | A historical shell guard used `MIDWIFE_ALLOW_IRREVERSIBLE`, then was removed; current Claude project uses deny/ask rules | **CURRENT-SOURCE — requested rule is not current policy** |
| Code-side output is code blocks only and ends in installation status | No current role has that universal output contract | **ABSENT; design decision required** |

## Split risks the future creator must not silently resolve

1. **Container risk.** Moving the main Midwife back into a sub-agent reverses the 2026-08-31
   skill decision and can strand one-way-door questions at a proxy.
2. **Routing risk.** Automatic routing has never been observed. Existing collisions are Midwife vs
   `spike-runner`, Midwife vs `test-writer`, and `ui-critic` vs review
   (`tasks/open/agent-roster-routing-untested.md:24-42`). Adding two broad descriptions increases
   an unmeasured surface.
3. **Session-boundary risk.** Claude agent definitions are snapshotted at session start. A creator
   cannot claim an agent is installed live from the session that writes it.
4. **State split risk.** `findings-log.md` and `recon-map.md` could duplicate the existing ledger.
   The later design must either map them onto the two existing categories or record why the ledger
   contract is being changed.
5. **Core ownership risk.** The two current Midwife skill copies already differ only at four
   platform seams. Splitting behavior without naming which file owns the shared mechanics creates
   a third divergent copy.
6. **Enforcement asymmetry.** Claude permission semantics, Claude frontmatter hooks, Codex
   sandboxes, and Codex lifecycle hooks are different mechanisms with different liveness evidence.
   A shared rule must name the platform component that actually enforces it.
7. **Human-authority risk.** Repository sub-agent spawning requires the human to ask
   (`AGENTS.md:48-57`, `.claude/templates/triage-rules.md:115-119`). A Claude router cannot assume
   standing delegation authority.
8. **Branch risk.** The Codex port is three commits ahead of master on a feature branch. Designing
   from master would produce a false gap analysis.
9. **Production-boundary risk.** The repository's dev database can be production, email can send,
   and secrets exist in ignored files. No variant shakedown should exercise those paths merely to
   prove liveness (`.claude/templates/triage-rules.md:13-60`).
10. **Delivery risk.** The user explicitly corrected this task from implementation to evidence
    gathering. Creating either variant from this handoff would exceed this handoff's authority.

## Open evidence, not design decisions

1. **UNKNOWN — deployed baseline.** Identify and read the authoritative deployed Midwife. Confirm
   whether `midwife-portable.zip` is it before producing a reconciliation map.
2. **OPEN — routing.** Run the two explicit unlabelled routing probes in a fresh session before
   tuning descriptions (`tasks/open/agent-roster-routing-untested.md:39-42`).
3. **OPEN — Claude specialist hook liveness.** Observe `schema-auditor` or `atomic-commit` in a
   later session and inspect the log; then separately test matcherless wiring
   (`tasks/open/matcherless-hook-wiring-unverified.md:32-53`).
4. **OPEN — drift endurance.** Five more turns are required to reach the registered twenty-turn
   condition; reporting drift still has only two contradictory observations
   (`tasks/open/drift-test-not-run.md:13-25`).
5. **OPEN — pre-commit installation.** The source hook remains intentionally uninstalled because
   the common Git hook directory affects every worktree and concurrent session
   (`tasks/open/pre-commit-hook-not-installed.md:5-20`).
6. **UNKNOWN — Codex live hook shakedown.** The current tests prove the script against crafted
   payloads, nested cwd, and non-ASCII paths. They do not prove this local Codex session invokes the
   project hook.
7. **UNKNOWN — variant packaging.** The briefs call both variants agents, but the existing
   architecture deliberately keeps Midwife mechanics in a main-context skill. The operator must
   decide whether "agent" means a role/persona, a custom sub-agent, or a platform skill.

## Source index for the next AI

Read in this order; later decisions supersede earlier statements without rewriting history.

1. `AGENTS.md`
2. `CLAUDE.md`
3. `.claude/skills/midwife/SKILL.md`
4. `.agents/skills/midwife/SKILL.md`
5. `.claude/templates/triage-rules.md`
6. `.claude/templates/gate-checklist.md`
7. `.claude/templates/spike-verdict.md`
8. `tasks/README.md`
9. `tasks/open/agent-roster-routing-untested.md`
10. `tasks/open/matcherless-hook-wiring-unverified.md`
11. `tasks/open/drift-test-not-run.md`
12. `tasks/open/pre-commit-hook-not-installed.md`
13. `tasks/decisions/2026-08-30-agent-spec-four-layer-split.md`
14. `tasks/decisions/2026-08-30-grave-lane-rebuilt-on-phases.md`
15. `tasks/decisions/2026-08-30-adversarial-review-hardening.md`
16. `tasks/decisions/2026-08-30-litmus-tests-all-passed.md`
17. `tasks/decisions/2026-08-30-drift-test-nine-turns.md`
18. `tasks/decisions/2026-08-30-drift-turns-10-15-multi-agent.md`
19. `tasks/decisions/2026-08-30-prior-art-most-of-this-is-first-party.md`
20. `tasks/decisions/2026-08-31-midwife-is-a-skill-not-an-agent.md`
21. `tasks/decisions/2026-08-31-agent-definitions-are-session-start-snapshots.md`
22. `tasks/decisions/2026-08-31-agent-roster-ported-and-pruned.md`
23. `tasks/decisions/2026-08-31-agent-grinder-four-runs.md`
24. `tasks/decisions/2026-08-31-worktrees-are-free-and-the-guard-was-the-wrong-layer.md`
25. `tasks/decisions/2026-09-05-first-party-permissions-replace-the-hand-rolled-fence.md`
26. `docs/tasks/TARGET_AGENT_GUARDRAILS.md`
27. `tasks/decisions/2026-09-06-codex-import-is-adapted-not-copied.md`
28. `.claude/settings.json`
29. `.claude/hooks/agent-guard.mjs`
30. `.codex/hooks.json`
31. `.codex/hooks/drift-log.mjs`
32. `tests/unit/agentDefinitions.test.ts`
33. `tests/unit/agentGuard.test.ts`
34. `tests/unit/codexIntegration.test.ts`
35. `tests/unit/docInvariants.test.ts`

## Reproduction commands

```powershell
# Establish branch and shared-index state.
git status --short --branch
git diff --cached --name-only
git rev-list --left-right --count origin/master...HEAD

# Compare the two current Midwife copies.
git diff --no-index -- .claude/skills/midwife/SKILL.md .agents/skills/midwife/SKILL.md

# Validate the system-owned structural checks.
npx vitest run --project unit tests/unit/agentDefinitions.test.ts `
  tests/unit/codexIntegration.test.ts tests/unit/agentGuard.test.ts `
  tests/unit/docInvariants.test.ts
npm run docs:check

# Inspect current liveness without mutating the repo.
Get-Content (Join-Path ([System.IO.Path]::GetTempPath()) 'claude-agent-guard.log') -Tail 50
Test-Path (Join-Path ([System.IO.Path]::GetTempPath()) 'codex-agent-drift.log')

# Inspect Git-hook installation without installing anything.
$hooks = git rev-parse --git-path hooks
Get-ChildItem -LiteralPath $hooks -File | Select-Object Name,Length
```

## Handoff boundary

The next AI may use this file to begin design, but it must first obtain the deployed Midwife source,
refresh branch/test/liveness state, and explicitly resolve the packaging, state-store, routing, and
cross-platform enforcement questions above. This audit supplies evidence; it grants no authority to
create or install either variant.
