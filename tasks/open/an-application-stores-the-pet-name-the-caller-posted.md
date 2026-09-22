# An adoption application stores the pet name the caller posted, not the animal's

**Status:** open · opened 2026-09-22 · read from the code while fixing the `petId` check beside it, not exercised

`submitApplication` now resolves the posted `petId` against the database and refuses an animal it
cannot find, one that is archived, and one that is not adoptable. The record it then writes still
takes the *name* from the request:

    petId: validated.petId,
    petName: validated.petName,

The id is checked and the name is not, although the action is holding the resolved animal by the
time it builds that draft — `pet.name` is in scope one block above.

A server action is a public POST endpoint, so the two fields can disagree for any caller who does
not go through the form. `petName` is what the applicant's confirmation email, the staff alert and
the admin list all display, and what `markCachedPetAdopted` falls back to matching on when the id
does not hit. So a submission can be recorded, acknowledged and worked by staff under a name that
belongs to no animal, or to a different one.

Low severity and not a leak: the id is what every downstream lookup actually uses, React escapes
the name everywhere it renders, and through the UI the two cannot diverge — the form sets both
together from the selected pet.

Deliberately not fixed in the change that found it. `petName: pet.name` is a one-line repair and
the existing suites would stay green, but it changes what a public write path stores, and the
ledger entry that work settled
(`submit-application-checks-a-fixture-and-no-status.md`) asked only for the target animal to be
*checked*. Riding an unrequested change to stored data into a pull request whose claim is about
validation is the thing that makes a review's job harder, not easier. See
`tasks/decisions/2026-09-22-a-public-adoption-submission-validates-its-target-against-the-database.md`.

**Settles when:** the stored `petName` comes from the resolved animal rather than the request — or
it is decided on purpose that the applicant's copy is worth keeping as posted, with the reason
recorded — pinned by a test that submits a valid `petId` with a mismatched `petName` and asserts
on what the written record holds.
