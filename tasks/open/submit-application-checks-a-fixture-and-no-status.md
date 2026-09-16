# `submitApplication` checks archiving against a fixture, lets an unknown pet through, and checks no status

**Status:** ASSERTED · opened 2026-09-16 · read from the code during the second review of PR #38, not exercised

`src/actions/applications.ts`, the public adoption submission:

    // Verify target pet exists and is not archived
    const pet = findServerPetById(validated.petId);
    if (pet && pet.isArchived) {
      return { success: false, error: "This animal is currently archived ..." };
    }

Three separate gaps in those four lines, each reasoned from the code and none run:

1. **`findServerPetById` is the synchronous mirror read.** A cold process seeds that mirror from
   `src/data/pets.json`, so the archive check reads the *fixture's* `isArchived`, not the
   database's. This is the defect PR #38 fixed in `getPetById` — `/pets/[id]` served an animal the
   database had archived — present in the write path beside it. See
   `tasks/lessons/2026-09-10-a-predicate-is-only-as-true-as-the-read-underneath-it.md`, of which
   this is the third occurrence in the pet reads.
2. **`pet && …` passes when the pet is not found.** An id the mirror does not hold — any animal
   that exists only in the database, or an id that exists nowhere — skips the check entirely and
   the application is accepted against it. The comment above the check says "verify target pet
   exists"; the code does not.
3. **No status check.** An application for an `Adopted`, `Pending` or `In Rehabilitation` animal
   is accepted. PR #38 closed the one UI path that made that reliable — the gallery's "Adoption
   Form" button preselected `filteredPets[0]`, which the Adopted tab makes an adopted animal — but
   the server is the boundary, and anyone can post to it.

Not fixed in PR #38 deliberately: the file belongs to the adoption-form work merged in #39, the
right rule for gaps 2 and 3 is a product decision (should Pending accept a second application?
`PetDetailView` renders Pending's button disabled, which suggests no), and a change to a public
write path deserves its own review rather than riding in a catalogue PR.

**Settles when:** the action resolves the pet through `findServerPetByIdAsync` with an exact-id
match (as `getPetById` now does), rejects a pet that is not found, and rejects any pet whose
`getPetStatusPresentation(status).isAdoptable` is false — with a strict-persistence integration
test that arranges an archived *and* an adopted row under a real fixture id, since an id absent
from `pets.json` passes against the broken code for the wrong reason.
