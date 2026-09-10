# Read the branch you are merging into before you build on the one you left

**Learned:** 2026-09-03

**2026-09-03.** A sponsorship feature was built against `9799dfe`. By the time it was ready,
`feature/frontend` had merged: 343 files, +40,606 lines. The branch had independently grown its own
`money.ts`, its own receipt-number generator, its own donation ledger and its own copy of the LHDN
constants — all four of which already existed on master, better. Its receipt numbers were random
4-digit draws against master's gapless `ReceiptSequence`, so merging would have put two allocators
on one series.

A `git rebase` would have merged the duplication in and reported success. What caught it was
reading master's `tasks/decisions/` and its schema *before* resolving a single conflict.

**Rule:** when a branch has been open long enough that master moved, the first step is not `rebase`,
it is `git log --stat base..origin/master` and reading the decision records. Rebase resolves text;
it has no opinion about whether your module is now the second copy of something. Ask "what exists on
master now that I would not write today?" and delete rather than merge it.

**Corollary — check the baseline is green before you claim a regression is yours or isn't.**
`npm test` on that clean master failed 4 tests, from a `chore(ui):` commit that moved one colour
token and pushed text contrast under WCAG AA. Without that measurement, any failure after the rebase
would have been attributed to the feature.
