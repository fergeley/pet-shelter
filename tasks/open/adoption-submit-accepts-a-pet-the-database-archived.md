# `submitApplication` still reads the fixture mirror, so it accepts archived animals

**Status:** open · opened 2026-09-22 · found by review, not yet reproduced against a running app

`#89` settled "a pet the database lacks is a missing pet" for `findServerPetByIdAsync`, and its
decision entry names sponsorship checkout as the other caller it fixed. A third caller was not
changed: the public, unauthenticated adoption submission.

`src/actions/applications.ts:108` does

    const pet = findServerPetById(validated.petId);
    if (pet && pet.isArchived) return { success: false, ... }

— the **synchronous** mirror, not the async reader. Two consequences follow from that one call:

1. **A `null` falls through to acceptance.** The guard only refuses when a pet is found *and*
   archived. A `petId` the database has never held is accepted.
2. **On a cold instance the mirror is still `src/data/pets.json`.** So a submission naming
   `pet-001` after staff archived that animal reads the fixture's `isArchived: false`, the
   application is accepted, and the confirmation email goes out — for an animal that is no longer
   adoptable.

This is the same defect class `#89` closed elsewhere, and `src/actions/pets.ts:115` currently
describes `findServerPetById` as what "the update and archive mutations read with", which does not
account for a public write path also using it.

Not fixed here on purpose: it was found while reviewing the bulletin branch, it belongs to no part
of that change, and fixing it there would put an unrelated correction to a public submission path
inside a PR about community notices.

**Settles when:** `submitApplication` resolves the pet through the async reader, refuses a
`petId` the database does not have, and a test covers both the archived case and the missing case
— or a decision entry records why the mirror is the right source for this one caller.
