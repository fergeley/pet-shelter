# An empty FAQ table is pinned as an answer, not an outage

**Decided:** 2026-09-03 · Closes `tasks/open/faq-empty-publish-set-has-no-regression-test.md`,
open for the length of one afternoon

`tests/integration/faqEmptyPublishSet.test.ts` now holds the property that
`getServerFaqsAsync` falls back to `src/data/faqs.json` **only** from its
`catch`. A successful query returning no rows means staff have unpublished
everything, and the page must render empty.

## What settled it

Four tests, run under the `integration` project:

    ✓ returns nothing when the query succeeds with no rows
    ✓ still falls back to the fixture when the query fails
    ✓ propagates the failure instead of falling back under strict persistence
    ✓ filters the rows the database returned rather than the fixture

Green with `STRICT_PERSISTENCE` both on and off, so it holds under
`npm run test:integration` as CI runs it.

**Mutation-checked rather than assumed.** Reverting the reader to the guard it
used to have —

    if (rows.length > 0) { return filterFaqItems(items, normalised); }

— turns the first test red with the fixture in the failure message:

    AssertionError: expected [ { id: 'faq-017', …(5) }, …(19) ] to deeply equal []

All twenty launch questions, resurrected by an admin unpublishing them. That is
the defect, reproduced on demand.

## Why it needed pinning at all

The wrong shape is next door. `petRepository.getServerPetsAsync` uses the count
guard, and `tests/integration/support/prismaDouble.ts` justified its
empty-by-default reads in terms of it — *"`getServerPetsAsync` only trusts the
database when it returns at least one row"* — stated as though it were a house
rule. Anyone making the two readers consistent had two adjacent precedents
pointing at the bug and nothing pointing away from it. That docstring now says
which reader the rationale describes, and names this suite.

Whether the pet reader's own guard is right is a separate question, still open
in `tasks/open/pets-json-fallback-empty-means-outage.md`.

## What was deliberately not built

`PrismaDouble` gained `faq.findMany` and nothing else. The FAQ write paths —
`create`, `update`, `delete`, and the `$transaction` + `$queryRaw … FOR UPDATE`
that reordering uses — have no suite here, and a delegate nothing calls drifts
from the shape the repository actually needs. They get their doubles with the
test that needs them.
