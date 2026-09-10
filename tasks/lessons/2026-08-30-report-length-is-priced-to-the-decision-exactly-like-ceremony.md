# Report length is priced to the decision, exactly like ceremony

**Learned:** 2026-08-30

Building the Midwife agent, the same correction landed twice: "i dont understand, explain it
simply", then "why is it so long. just tell me if the midwife works or not". Both times the work
was sound and the report was the defect. Four litmus tests had run; the answer the human needed
was one word and one open decision, and it was buried under a results table, a verification
excerpt and three sub-findings.

This is the spec's own rule applied to its own output. `midwife.md` §2 says ceremony is priced to
the decision and that GRAVE ceremony on a FAST task "teaches the human to route around you." A
GRAVE-sized *report* on a question with a yes/no answer does the identical damage, and the spec's
report format (Open → Settled → Shipped) actively invites it, because Open-first reads as
permission to enumerate.

**Rule:** lead with the verdict in one line, then the decision the human actually has to make.
Everything else is available on request and belongs in the ledger, which is where a reader who
wants it will look. The report is not the work; a long report about verified work is an unpriced
tax on the person who asked. When the question was "does it work", "yes" is the whole first line.
