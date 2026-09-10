# When a branch is overtaken, shrink it; do not integrate faster

**Learned:** 2026-09-03

**What happened:** the sponsor portal had its storage layer overtaken by `master` twice in
one day. First `Donation` + `ReceiptSequence` superseded its `SponsorContribution`. The
merge resolving that was still being written when `d301e74` landed `PetSponsorship`, which
superseded the annotation table that merge had just built. Nine commits arrived between one
`git fetch` and the next.

The instinct both times was to re-integrate — rewrite the storage layer against whatever
`master` now had. That is a race you lose: a third rewrite would have collided a third time.

**What worked instead:** reduce the branch to the part nobody else is building. Here that
was the supporter *account* — sessions, tier derivation, gating, the portal UI — and
`PetSponsorship.userId`, a column whose comment already read *"Reserved for a future
supporter account."* The other session had left the slot open. The branch went from
carrying its own ledger to adding one table and one foreign key, and merged.

**How to apply:** when a merge conflict is a whole subsystem rather than a few files, stop
resolving and ask *which half of this branch is uncontested?* Ship that half. Read the
other side's model comments before designing against them — they frequently describe the
seam you are about to build, and occasionally they describe your branch by name.

**Corollary on adopting the other implementation wholesale.** `PENDING_PAYMENT → ACTIVE`
replaced this branch's `PENDING`/`CONFIRMED`, and is better: it says *why* an unreconciled
pledge grants nothing. `countsTowardFunding()` replaced a restatement of the same rule.
Taking their vocabulary rather than mapping onto it removed code and a class of drift.

---
