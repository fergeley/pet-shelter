# The ledger is one file per entry, not two files

**Decided:** 2026-08-30

`tasks/DECISIONS.md` and `tasks/OPEN.md` are replaced by `tasks/decisions/` and `tasks/open/`,
one file per entry. The contract is `tasks/README.md`.

**The defect this fixes.** Both files were ordered **newest-first**, so every entry was inserted
at the top. Several Claude Code sessions run against this repo concurrently and any of them may
invoke the agent, and §5 requires *every* run to write the ledger before close. Every session was
therefore appending to the same region of the same two files — a guaranteed conflict rather than a
probabilistic one, and the losing write is silent.

That ordering choice was made for human readability and its concurrency cost was never considered.
Newest-first is the correct presentation and the worst possible storage.

**Why this shape and not a lock, a merge driver, or per-session files.** Two sessions never touch
the same path, so git merges the directories with no machinery at all. Per-session ledger files
would also avoid the conflict but would fragment the shared memory the ledger exists to be —
the point is that sessions read *each other's* entries.

**The taxonomy is unchanged.** Still exactly two categories, Open and Settled; only the storage
shape moved. This is explicitly not a third category.

**It also answers coordination for free.** A claim is just an open entry: a session starting a
GRAVE task writes `open/CLAIM-<task>.md` and deletes it at close, so reading `open/` at session
start shows what every other session is working on. No lock, no protocol, no new concept — which
is why this was preferred over a dedicated claims file.

**Reversible:** `cat tasks/open/*.md > OPEN.md` reconstructs the old shape.

**Migration was mechanical and verified lossless** — a throwaway splitter cut each file at its `##`
headings, and a checker confirmed every produced body appears verbatim in its source and that
entry counts matched (6 → 6 decisions, 5 → 5 open, the last then split into its five
independently-settling parts). Both scripts were deleted.

**Not rewritten:** entries in `decisions/` that name `tasks/DECISIONS.md` describe the layout that
was current when they were written. Correcting them would be rewriting settled history, which
`tasks/README.md` forbids. This entry is the pointer that resolves them.
