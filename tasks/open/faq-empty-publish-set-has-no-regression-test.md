# Nothing stops the FAQ fixture from resurrecting itself when every entry is unpublished

**Status:** open · opened 2026-09-03 · from the PR #13 review

`getServerFaqsAsync` returns whatever Prisma gives it and falls back to
`src/data/faqs.json` **only** from its `catch`. That is deliberate: an empty
result means staff have unpublished everything, which is an answer, not an
outage. The earlier version gated the fallback on `rows.length > 0`, so
unpublishing every entry restored all 20 launch questions — including copy that
had been deliberately retracted — and no admin action could empty `/faq`.

The fix is in `src/lib/server/faqRepository.ts` and was verified live before
merge, unpublishing one category and then all of them. **No test pins it.**

That matters because the wrong shape is the one used next door:

    // src/lib/server/petRepository.ts — getServerPetsAsync
    if (dbPets && dbPets.length > 0) { ... }   // else fall through to the fixture

An edit "aligning" the FAQ reader with its neighbour reintroduces the bug and
stays green. See also `tasks/open/pets-json-fallback-empty-means-outage.md` for
whether the pet reader's own guard is right.

## What the test would be

`tests/integration/support/prismaDouble.ts` already exists and is used by
`auditLogFlush`, `rbacAuthorization` and `softDeleteFiltering`. Point the double
at an empty `faq.findMany` result and assert the reader returns `[]` rather than
the 20 fixture rows; then make it throw and assert the fixture *does* come back.
Both halves are needed — asserting only the first passes trivially against a
reader that has lost its fallback entirely.

**Settles when:** that test exists and fails if the `catch` is changed to a
count check.
