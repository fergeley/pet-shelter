# TARGET: Agent guardrails — what is settled, what is open

- **Written**: 2026-09-05, closing the command-fence work stream
- **Supersedes the open questions in**: `HANDOFF_GUARD_TO_FIRST_PARTY_PERMISSIONS.md` §1 and §4
- **Status of that handoff**: §1a done, §1b done, §4.2 done, §4.3 answered negatively, §4.5 open
- **Rule for reading this**: every number below was produced by running something. Where a claim
  was reasoned and not measured it says so. Re-run before relying on it — a document cannot waive
  verification (`AGENTS.md`).

---

## 1. Settled — measured, with the command that measured it

### 1.1 `permissions.deny` enforces. `permissions.ask` does not prompt.

| Probe | Rule matched | Result |
|---|---|---|
| `Read(./package-lock.json)` | `deny` | **refused** — "denied by your permission settings" |
| `git stash list` (×2) | `ask` → `Bash(git stash*)` | ran, no prompt |
| `git branch -D <nonexistent>` | `ask` → `Bash(git branch -D*)` | ran, no prompt |

Session runs at `permissionMode: auto`. The second `ask` probe is the informative one: destructive
verb, leading token, exact prefix match — still unprompted. **Put anything that must actually be
blocked in `deny`. Treat `ask` as advisory.**

**The probe the handoff proposed could not have answered its own question.** `git stash list` was
chosen for being harmless, and harmlessness is exactly what makes the classifier wave it through.
A decisive probe needs a genuinely destructive command as the **leading token**, which cannot be
aimed at a scratch repo — `git -C <scratch> stash push` no longer prefix-matches — and aimed here
would destroy a concurrent session's work. **No safe decisive probe exists. This stays open.**

### 1.2 Prefix matching is defeated by anything before the verb

`permissions` rules match from the start of the command string. Twelve shapes are now pinned in
`tests/unit/agentGuard.test.ts` with a control test proving the same verbs *are* caught when they
lead:

```
cd src && git reset --hard      FOO=1 rm -rf build       sh -c 'git reset --hard'
true; git clean -fd             sudo rm -rf build        $(git reset --hard)
true & rm -rf build             env rm -rf build         'rm' -rf build
echo x | xargs rm -rf           bash -c "rm -rf build"   git -c core.pager=cat reset --hard
```

This is a **ledger, not a fence**. Nothing enforces it. An entry changing sides silently is the
regression it exists to catch.

### 1.3 A `Read(dir/**)` deny rule also blocks shell commands that merely name the path

`find . -path ./node_modules -prune` was refused — the standard idiom for *excluding* a directory
was read as an attempt to read it. The path resolved against the **project root**, not the shell's
cwd, so it fired on a clone sitting in the scratchpad.

Worse, `Read(./node_modules/**)` forbade `node_modules/next/dist/docs/`, which `AGENTS.md` line 1
**mandates** reading before writing any Next.js code. A deny rule forbidding what the instructions
require. Narrowed to `**/*.{js,mjs,cjs,map}`; both directions verified — the guide reads, a `dist`
`.js` is still refused, the `find` idiom runs.

**Rule: `deny` carries what must be impossible. It is not the place for context hygiene or taste.**

### 1.4 Settings files are classifier-fenced, and the fence tightened

`~/.claude/settings.json` refuses every agent edit. `.claude/settings.json` **now refuses an Edit
too** — earlier in this work it accepted one. Both required the human. Budget for that: a change to
either file is a handoff, not a step.

### 1.5 The fence is dormant, not deleted

`.claude/hooks/agent-guard.mjs` still contains the full irreversible-command parser. What changed is
wiring, and the two wirings differ:

- `.claude/settings.json` wires it **`PostToolUse`**, whose branch ends in `allow()` — the fence is
  never reached for the main conversation.
- `.claude/agents/{schema-auditor,atomic-commit}.md` still wire it **`PreToolUse`**, so those two
  sub-agents still run the parser that was judged unfit for everyone else.

Not resolved. Recorded so it is a decision rather than an accident.

---

## 2. Settled — the two external systems

Both MIT. Both cloned and read, not summarised from their READMEs.

### 2.1 ECC / GateGuard (`github.com/affaan-m/ecc`) — a speed bump, not a fence

`scripts/hooks/gateguard-fact-force.js:1264-1274` denies a destructive command **once**, then
`return rawInput; // allow retry after facts presented`. The identical second attempt succeeds. It
is a fact-forcing device by design, and it fails open on exception, on state-write failure, and to
three env kill-switches.

It reached the same architecture we abandoned — regex plus a hand-rolled character tokenizer, two
passes stacked because the first was bypassable and shipped **GHSA-4v57-ph3x-gf55**. Verified gaps
in 2,039 lines and 174 adversarial tests: `sudo rm -rf /`, `FOO=1 rm -rf /`, `xargs rm -rf`, `eval`,
`prisma db push`. `grep -c "sudo\|xargs"` returns **0** in the source *and* in the 2,876-line suite.

**Taken:** its evasion corpus, as §1.2's ledger. **Not taken:** the fact-forcing gate — it needs the
same parser.

### 2.2 Ponytail (`github.com/DietrichGebert/ponytail`) — zero enforcement

`grep` for `permissionDecision`, `"deny"`, `exit(2)` across the repo returns nothing. The Claude Code
plugin wires `SessionStart`, `SubagentStart`, `UserPromptSubmit` — all context injection, none able
to block a tool call. Every path ends `process.exit(0)`.

Its safety table, from its own benchmark:

| arm | safe |
|---|--:|
| baseline (no skill) | 100% (20/20) |
| ponytail | 100% (20/20) |
| yagni-oneliner | 95% (19/20) |

"100% safe" **ties doing nothing**. `grep -c -i complete` on the results file returns 0 — the
completeness control its own harness docs call mandatory was built and never reported. Agents ran
with Bash disallowed, so no arm ever ran a test. The `~54%` is a mean dominated by three
hand-build-a-UI-widget tasks; its six backend tasks are 44→44, 36→33, 33→26.

**Taken:** the ladder and the ceiling-comment convention into `AGENTS.md` (~20 lines, as procedure —
`CLAUDE.md` states simplicity as a value and gives no method), and the `check-rule-copies.js` idea
as `scripts/check-doc-invariants.mjs`. **Not taken:** the plugin — `SubagentStart` injects
unconditionally and would land inside the narrow-contract agents.

---

## 3. The transferable lessons

**A guard that reads the working tree cannot be tested against the tree it runs in.** Three
instances in one file, discovered one at a time because each fix only removed the case. One test
needed `docs/` clean, another needed the repo dirty — no single tree state satisfied both, so the
suite could not be green before *and* after a commit. Every such assertion needs a repo the test
owns.

**A test that reimplements the thing it checks is not a test.** The invariant guard's first test
copied the reference regex rather than importing it. It would have stayed green while the shipped
parser broke.

**A tool that names the pattern it hunts will flag itself.** The invariant guard's first green run
was impossible until it excluded its own source and test. Keep such an exclusion pinned at a known
size — asserted in a test — or it becomes the way real findings get silenced.

**Numbered cross-references between files rot silently.** Nine invariants were deleted from
`CLAUDE.md` and 16 citations across agents, skills, templates and a hook kept pointing at nothing —
including two in the replacement text itself. Nothing errored, because the citation and the
definition live in different files. Citations now name their rule in words; `npm run docs:check`
catches a new numbered one.

**Hand-rolled shell parsing does not converge.** Two independent projects, the same architecture,
the same first-token anchoring, the same bypasses. Ours took three review rounds and a corpus replay
to abandon; theirs took a CVE. If a shape must be blocked, block it in `permissions.deny`.

**Run the guard, don't read it.** Every defect above was found by executing, never by inspection —
including in code that had just passed review. Mutation-check in *both* directions: the injected
violation must fail, and the corrected form must pass.

---

## 4. Open

| # | Item | Why it is open |
|---|---|---|
| 4.1 | `permissions.ask` liveness | No safe decisive probe exists (§1.1). Needs a destructive leading token, which cannot be aimed at a scratch repo and cannot be aimed here. |
| 4.4 | `tasks/open/triage-rules-section-2-is-stale.md` | §2 is a RISK VETO entry whose own verification command now returns the opposite of what it claims. Filed, not fixed. |

### Closed since this document was written (same day, on the human's call)

- **4.2 — the fence binding two sub-agents.** Deleted. 520 lines out of `agent-guard.mjs`,
  790 → 266, along with the 35 tests that exercised it. The two agent rules and the drift log
  stay; they are allowlists, not shell parsing. §1.5 above is superseded: there is now no fence
  anywhere, for any actor. Probed rather than reasoned — a main-conversation `git reset --hard`
  returns ALLOW, `schema-auditor` running `ls` is still denied, `atomic-commit` running `git add`
  is still denied.
- **4.3 — nothing read the drift log.** `CLAUDE.md`'s session close now reads it before the
  ledger write.
- **4.5 — three context-hygiene copies.** `AGENTS.md` won on the merits: reset on task
  milestones, never on a token estimate. `CLAUDE.md` and `GEMINI.md` now point at it and state
  nothing themselves, so there is one copy rather than three that agree today.
- **4.6 — the nine invariants.** Restored, to `AGENTS.md` rather than `CLAUDE.md`, because every
  agent reads that file and `CLAUDE.md` is the one that lost them. Invariant 7 keeps "halting is
  for one-way doors only" and drops its plan-mode parenthetical, so it no longer contradicts the
  workflow section `CLAUDE.md` carries. Citations stay by name; `npm run docs:check` fails a
  numbered one and now reports all nine defined.
