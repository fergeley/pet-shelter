# An adoption audit row can name a pet the transaction never updated

**Status:** ASSERTED · opened 2026-09-22 · found reviewing
`decisions/2026-09-22-an-approval-marks-the-id-it-asks-for.md`, which does not close it

`atomicUpdateApplicationStatus` writes the pet transition audit row from the **mirror**, while the
database update is keyed on the application's `petId` and skipped entirely when that is empty:

    if (targetStatus === "APPROVED" && current.petId) {      // applicationRepository.ts:376
      await tx.pet.updateMany({ where: { id: current.petId }, data: { status: "Adopted" } });
    }
    ...
    const adoptedPet = markCachedPetAdopted(current.petId ?? "", current.petName);
    if (adoptedPet) {
      recordAuditLog({ action: "PET_STATUS_TRANSITION_ADOPTED", entityId: adoptedPet.id, ... });
    }

For a legacy application carrying no `petId` — the case the name fallback in
`markCachedPetAdopted` exists to serve — the transaction does not touch `pets` at all, yet the
mirror marks an animal adopted and an audit row is written naming it. The audit log then records
a pet status transition that Postgres never performed, and a rehydrate silently reverts the mirror
while the audit row stays.

That is the inversion of the invariant stated at the top of `petRepository.ts`: *"database first,
mirror second… a cache entry can therefore never describe a state the database refused."* Here
the cache describes a state the database was never asked about.

The larger version of this — an attacker-supplied `petId` matching no row, so `updateMany` hits 0
rows while the name fallback picks a victim — was closed on 2026-09-22 by requiring an id that
was supplied to resolve on its own. What remains is narrower and not attacker-reachable:
`applicationFormSchema` requires a non-empty `petId`, so only rows already in the table can carry
an empty one.

**Not fixed with that change on purpose.** The repair is in the caller, not the repository, and it
is a real product question rather than a mechanical one: either key the audit row off the row the
transaction actually updated (`updateMany` returns a count, so "0 rows" is detectable), or decline
to write a transition audit row when no database transition happened, or backfill `petId` for the
legacy rows and delete the fallback entirely. The third closes this and the residual in the
decision entry together, and is the only one that removes the ambiguity rather than documenting
it.

**Settles when:** no `PET_STATUS_TRANSITION_ADOPTED` row can be written for an approval whose
transaction updated zero `pets` rows — pinned by a test that approves a legacy application with an
empty `petId` and asserts on what was audited, not only on what the mirror holds.
