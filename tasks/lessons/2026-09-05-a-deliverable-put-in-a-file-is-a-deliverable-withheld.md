# A deliverable put in a file is a deliverable withheld

**Learned:** 2026-09-05

Asked where four stale config entries were, I wrote the corrected lines to a scratchpad file and
sent it as an attachment. The reply: *"why dont you give me your corrections here instead of
sending somewhere i cant see."* The content was right and the delivery made it useless — the
terminal is where this user reads, and a file card is a place they have to go.

The reasoning that produced it was "four long JSON lines are awkward to read in a terminal." That
optimises the wrong thing. Awkward-but-present beats tidy-but-elsewhere.

**Rule:** anything the user must ACT on — a patch to paste, a command to run, a decision to make —
goes in the response body, in full, even when it is long or ugly. A file is for something they
would open in another program anyway (a built artifact, a screenshot, a dataset), never for the
answer itself. If a thing is worth attaching, still put its actionable content inline and treat the
attachment as the copy, not the original.
