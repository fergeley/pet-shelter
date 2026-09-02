# The mechanics moved from `.claude/agents/midwife.md` to `.claude/skills/midwife/SKILL.md`

**Decided:** 2026-08-31

Also closes `tasks/open/agent-auto-delegation-unobserved.md` (opened 2026-08-30), which is deleted
rather than answered — the conversion removed its subject. Its text is quoted below where it bears.

## The fence, checked before it was moved

`2026-08-30-agent-spec-four-layer-split.md` put the mechanics outside `CLAUDE.md` because
"**Layer 2** — conditional mechanics… **Paid for only on invocation**", against the failure of
`CLAUDE.md` bloat taxing every trivial task. **That fence is about conditional loading, not about
the container.** A skill has identical economics: description resident, body on invocation. The
same entry's sorting test — *"Must it bind even when the agent isn't explicitly invoked? → L1.
Otherwise → L2"* — says L2 was always meant to be *explicitly invoked*. The agent container was
incidental, and T1's attempt to prove *automatic* delegation was a drift from the original design.

## Why the container was wrong

**1. A subagent does not inherit `CLAUDE.md`.** `SKILL.md` opens by asserting "`CLAUDE.md` holds
the invariants and the four triage tests; both are loaded already." A subagent "starts with a
fresh, isolated context window. It doesn't see your conversation history, the skills you've already
invoked, or the files Claude has already read." The old open entry named this exact unknown:
"that an invoked `midwife` inherits `CLAUDE.md` the same way the proxy did." Every invariant and
all four triage tests were riding on an unverified assumption. A skill runs where `CLAUDE.md` is
already loaded, so the assertion cannot be false. **Settled by construction, not by measurement** —
which invariant 2 ranks higher.

**2. The halt lands on a proxy.** §3's only legal halt is "STOP and await the human", reserved for
one-way doors. A subagent cannot await a human — `AskUserQuestion` is never passed to subagents,
by design — so it hands back to the *main agent*, which has the authority to answer the question
itself. A one-way-door decision silently becomes a model decision. That is precisely what the halt
exists to prevent.

The 2026-08-30 Cliff litmus test recorded "**Halted.** Nothing deleted, no history rewritten" and
is not contradicted: halting degrades to return-and-hand-back, which is the documented workaround,
and a human was on the other end of that run. Nothing guaranteed it would be.

**3. The isolatable half is already a different agent.** `spike-runner` *is* Phase 2 in a fresh
context. What remains — triage, framing, the gate, build-and-verify, ledger — is multi-phase work
sharing context with a human in the loop, which is the canonical "use the main conversation" case.
Midwife-as-agent was an agent whose only context-isolatable component is another agent.

## What was deliberately not done

- **Templates stay in `.claude/templates/`.** `CLAUDE.md`'s resident triage consults
  `triage-rules.md` *before* any mechanics load. Bundling it inside the skill would put it out of
  reach at the one moment it is needed.
- **No thin agent kept as a second entry point.** Two doors to one room is this repo's recurring
  defect with a bow on it.
- **The five references to the old path in `tasks/decisions/` are left stale**, per
  `tasks/README.md`: an entry describing a superseded layout stays as written, because it was true
  when written. Do not repair them.
- **No path indirection for the nine live references.** They were updated by hand. Pointers to one
  file are not duplication, and a variable would be harder to read than the path.

## Cost, and what would reverse this

Nine reference updates; net zero lines in the kill-condition scope. The one thing given up is a
fresh context window for a long GRAVE task — which Anthropic's own guidance says not to want here.

**Unmeasured, and it is the honest weak point:** whether a skill gets auto-invoked more reliably
than an agent gets auto-routed. No evidence either way. The argument is about the *cost of being
wrong*: a missed skill invocation costs nothing and the session continues, a missed delegation
costs a context window, and a *successful* delegation is where the halt defect lives. That is
reasoning, not data — **ASSERTED**.

Reverse this if a GRAVE task is ever shown to need context isolation that `spike-runner` cannot
provide. A reversal is a new dated entry, not an edit to this one.
