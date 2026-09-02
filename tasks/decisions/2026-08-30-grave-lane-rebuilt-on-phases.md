# GRAVE lane rebuilt on the recovered phase structure

**Decided:** 2026-08-30

The first draft of `.claude/agents/midwife.md` was reconstructed from the nine invariants alone,
because the source design existed only in a conversation. The source was then recovered and the
draft failed its own five-question diff on three of five counts. Rewritten as five phases.

**What the reconstruction lost, and why each loss was predictable:**

| Lost mechanism | Recovered as | Why it vanished |
|---|---|---|
| Fence sweep at analysis time | Phase 1 | Reinvented at build time — its *pre-fix* position. Only the fix lived in conversation. |
| Walking skeleton rung; reasoning-only floor | Phase 2 ladder, 4 rungs | Collapsed to 3 rungs with "reading code" as the floor — an activity, not an epistemic status. |
| Bounded failure protocol | Phase 4 | The build step did not exist at all; the middle of the loop was ungoverned. |
| Assumption stack, cap 5, MEASURED/ASSERTED/UNKNOWN | Phase 1 | Absent entirely. |
| `Problem:` / `Claim:` frame lines | Phase 0 | Absent entirely. |
| Empty-ledger error emission | §5 | "Write before close" without an error is silence, which is the failure it exists to catch. |
| MEASURED vs ASSERTED on the verdict artifact | `spike-verdict.md` | Present in prose, absent from the artifact — the one rule Layer 4 was supposed to make unforgettable. |

**Rationale for keeping the phase labels** rather than the numbered steps that carried the same
rules: the labels are cosmetic, but they make future diffs against the source design mechanical
rather than interpretive. That is worth the two lines it costs.

**The generalisable finding:** a reconstruction from *rules* preserves the rules and loses the
*mechanisms the rules were derived from* — and loses them specifically in their pre-fix form,
because a fix leaves no trace in the rule it produced. Invariant 6 says "three failed hypotheses";
it does not say the hypotheses must be *distinct*, and that missing word was the entire
anti-reward-hacking mechanism. **Rules are lossy compression of the failures that produced them.**
