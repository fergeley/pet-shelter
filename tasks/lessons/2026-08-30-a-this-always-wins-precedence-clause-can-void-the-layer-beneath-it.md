# A "this always wins" precedence clause can void the layer beneath it

**Learned:** 2026-08-30

The agent spec split into an always-loaded constitution of absolute invariants plus a mechanics
file whose entire job was carving exceptions to them. The mechanics file opened with what read as
good hygiene: *"if this file and an invariant disagree, the invariant wins."*

That single line made every exception illegal. "TRIVIAL: no ledger" lost to "write the ledger
before close." Incident mode's one question lost to "halting is for one-way doors only." The whole
principle the mechanics existed to express — ceremony priced to decision gravity — was formally
void, and nothing in the file was self-evidently broken.

It had already caused real drift: the invariant said "three failed hypotheses", the mechanics said
"three **distinct** failed hypotheses", precedence resolved toward the invariant, and the single
word carrying the entire anti-gaming mechanism was silently non-binding.

**Rule:** when a document says another document always wins, check what the losing document is
*for*. If its purpose is to qualify the winner, the clause is not hygiene, it is a deletion. Write
"X states the default; Y narrows it only where Y says so explicitly and names it," and require
every narrowing to be marked so an unmarked conflict reads as a bug rather than as silent defeat.
