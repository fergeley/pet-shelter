# Self-review is blindest where it is most confident

**Learned:** 2026-09-03

**What happened:** I self-critiqued the sponsor portal and produced twelve findings,
including one I graded critical. An external code review then found, as its *first*
finding, a full account takeover in the account-claim challenge — the single mechanism I
had written the most defensive prose about, in code comments, a commit message and a
design guide.

**Why I missed it.** I had reasoned "a receipt number is delivered only in the donor's own
e-Receipt, so possession proves identity", written that down three times, and never
re-derived it. Reviewing my own work, I checked the parts I was unsure about and skimmed
the part I had already argued for. The care I put into justifying it is exactly what
stopped me re-examining it.

**How to apply:** when self-reviewing, treat your own confident explanations as the *first*
place to look, not the last. Specifically: for every security property you have written
prose about, re-derive it from the attacker's side once, ignoring what you wrote. And do
not let a self-critique substitute for an independent one — mine was thorough and still
missed the worst bug on the branch.

**Related:** [[stress-test-all-the-way]].

---
