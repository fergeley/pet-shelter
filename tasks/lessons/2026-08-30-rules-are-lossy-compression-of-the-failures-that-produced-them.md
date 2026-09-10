# Rules are lossy compression of the failures that produced them

**Learned:** 2026-08-30

Reconstructed an agent spec from its nine stated rules when the original prose was unavailable. The
rules came back intact. The *mechanisms they were derived from* did not — and they came back
specifically in their **pre-fix** form, because a fix leaves no trace in the rule it produced. The
fence-sweep step was reinvented at build time, which is exactly where it had been before someone
moved it to analysis time to stop post-gate redesigns.

The sharpest instance: "three failed hypotheses kill the design" does not say the hypotheses must
be *distinct*. That missing word was the whole anti-reward-hacking mechanism, and nothing in the
rule's text could have revealed it was gone.

**Rule:** a rule is a compressed artifact of a failure. Rebuilding from rules alone reproduces the
policy and loses the reason, so the rebuild silently reverts every fix that was folded into
wording. When reconstructing anything from its summary, treat the middle details as *drafts that
have not been reviewed*, say so explicitly, and get them diffed against the source before relying
on them. Keep the failure next to the rule — see the `**Why:**` shape used throughout this file.
