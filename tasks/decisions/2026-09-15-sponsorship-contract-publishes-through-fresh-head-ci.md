# Publish the sponsorship contract through fresh-head CI and a squash merge

**Decided:** 2026-09-15 - branch `codex/sponsorship-contract`, reviewed at
`7aace895ff4f02fdc2c5583b9156f7b70337a022` against `origin/master` at
`a2f7cf1721fd8d151b76c8a8657fe04769688838` before this entry was added.

## Context

The implementation and its local verification were complete, but the branch did not yet exist on
GitHub. Publishing and merging it is a separate one-way door: a pull request can be closed, while a
commit on `master` can only be countered by another commit. A concurrent Claude worktree also holds
ten intentional, overlapping, uncommitted paths and must not be used as an implicit source of truth.

Live publication probes found no existing remote `codex/sponsorship-contract` branch or pull
request. A fresh fetch left the candidate zero commits behind and twelve ahead of `origin/master`.
`git merge-tree --write-tree origin/master HEAD` exited successfully with tree
`0785284e1ae2f0dd016615c150baff2201b42aaf`; the independent range audit found 42 expected paths,
no generated or binary artifacts, no environment or credential files, and no production endpoint.

## Decision

Publish this branch under an educational pull request that explains the revised architecture,
atomic receipt boundary, security checks, evidence, and remaining release blockers. Merge only when
all checks in the final GitHub rollup pass for the exact reviewed head and the current base.

Use GitHub's squash merge. The CI workflow documents the repository's squash policy and lints the
pull-request title as the commit that will reach `master`. Squashing also prevents an intermediate
feature commit from preserving a rewrite of a decision introduced earlier in the same unpublished
range: `master` receives that decision once, in its final form, as the ledger contract requires.
The pull-request title must therefore pass `scripts/commit-msg.mjs` and tell the truth as a commit
subject.

Do not force-push, import the concurrent dirty tail, or alter its worktree. If the base or head moves,
refresh the merge-tree, range review, and GitHub checks before merging. A configured preview build
may be created automatically by the pull request; this decision authorizes no production deploy,
database mutation, migration activation, secret change, or live email send.

## Evidence required at merge time

- the remote branch object equals the local published head;
- the pull request's head and base OIDs match the refreshed local refs;
- each GitHub check is successful or explicitly non-required and neutral, with no pending, failed,
  cancelled, or stale required result;
- GitHub reports the pull request mergeable; and
- after the squash, a fresh fetch observes the pull request as merged and its merge commit on
  `origin/master`.

## Consequences

The twelve development commits remain reviewable on the feature branch and pull request, but only
the linted squash subject and final tree enter `master`. The intentionally dirty Claude worktree
remains recoverable and receives a head/PR handoff instead of being reset or cleaned. Production
activation, the conflicting ROS registration values, the non-durable email boundary, and general
donations that issue receipts before bank reconciliation remain outside this merge.

Related: [[2026-09-14-public-pet-checkout-records-a-pending-sponsorship]],
[[2026-09-14-reconciliation-issues-the-receipt-inside-the-pledge-transaction]].
