# The pet reader cannot tell an empty table from an unreachable one

**Status:** ASSERTED · opened 2026-09-03 · noticed while writing `faqRepository`

`getServerPetsAsync` falls back to `src/data/pets.json` on a count, not on an
error:

    const dbPets = await prisma.pet.findMany({ ... });
    if (dbPets && dbPets.length > 0) { return ...map(mapDbPetToPet); }
    // falls through to the in-memory fixture

So a successful query returning zero rows serves fixture pets. Whether that is
right depends on a question nobody has answered: **can this table legitimately
be empty?** For FAQs the answer was yes — staff unpublishing everything is a
supported action — and the same shape was a real defect there, fixed in PR #13
(`tasks/open/faq-empty-publish-set-has-no-regression-test.md`).

For pets it is arguable in the other direction. A shelter listing zero animals
is more plausibly a broken connection than a deliberate state, and showing
fixture animals may beat showing an empty directory.

`faqRepository.ts:142` already asserts as much in passing — *"appropriate for a
catalogue that is never legitimately empty"* — but that is a claim made from the
neighbouring file by someone who did not check, not a decision by anyone who
owns the pet path. `petRepository`'s own comment describes the storage strategy
and is silent on the trigger.

Adjacent to `tasks/open/pets-json-fallback-reach-unverified.md`, which asks
whether the fallback is ever reached in production at all. This entry asks a
different question: given that it is reached, is the *trigger* correct.

`getServerApplicationsAsync` and `settingsRepository` are worth the same read.

**Settles when:** someone decides, per reader, whether an empty result is an
answer or an outage — and the chosen one is written down where the guard is.
