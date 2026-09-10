# Overtaken by 160 commits is a rebuild, not a merge

**Learned:** 2026-09-04

A feature branch built against a 7-day-old base met a master that had grown its own
`PetSponsorship` model on the same table, its own `src/actions/sponsorships.ts`, and a
repository layer replacing the `serverStore.ts` the branch still imported. Ten files
conflicted. Resolving them would have resurrected a deleted module, clobbered the
sponsorship ledger and reverted schema work.

Rebuilding on current master took less time than the merge would have, and produced a
better result: master's two-mode persistence contract replaced a `try/catch` fallback,
an existing `flushAuditLogWrites()` replaced a duplicate that was about to be written,
and a coordinator-reconciled `ACTIVE` status made a whole double-opt-in subsystem
unnecessary — it is a stronger guarantee than an email click, because a human confirmed
the money arrived.

**Rule:** when a branch is far enough behind that the trunk has independently solved the
same problem, the conflict list is the wrong thing to read. Ask what master would make
unnecessary, and delete rather than merge it. Related: "When a branch is overtaken,
shrink it" below — this is the same rule one order of magnitude further along.
