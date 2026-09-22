# Two readers still cannot tell an empty table from an unreachable one

**Status:** ASSERTED · opened 2026-09-03 · narrowed 2026-09-22, the pet and FAQ halves are settled

A repository read can fall back to its bundled fixture on a *count* rather than on an *error*:

    const rows = await prisma.<model>.findMany({ ... });
    if (rows && rows.length > 0) { return ...; }
    // falls through to the in-memory fixture

A successful query returning nothing then serves fixture data. Whether that is right depends on a
question that has to be answered per reader: **can this table legitimately be empty?**

**Answered, for three readers.** All three now treat an empty or absent result as an answer and
fall back only from their `catch`:

- FAQs — staff unpublishing everything is a supported action. Fixed in PR #13, pinned by
  `tests/integration/faqEmptyPublishSet.test.ts`
  (`decisions/2026-09-03-empty-faq-table-is-pinned-as-an-answer.md`).
- The pet catalogue, `getServerPetsAsync` — pinned by `tests/integration/softDeleteFiltering.test.ts`,
  "returns an empty array without falling back to fixtures when the database is merely empty".
- A single pet, `findServerPetByIdAsync` — the last one holding the old shape, and the one where
  it was publishing demo animals at their exact URL and taking sponsorship pledges against them.
  Settled 2026-09-22 by `decisions/2026-09-22-a-pet-the-database-lacks-is-a-missing-pet.md`,
  pinned by `tests/integration/petMissingRowIsAnAnswer.test.ts`.

**Unexamined, and all this entry now asks about:** `getServerApplicationsAsync` and
`settingsRepository`. Nobody has decided whether an empty result from either is an answer or an
outage, and neither has a test that would notice the difference. Settings in particular may want
the opposite answer from the pet readers — a missing settings row plausibly *should* fall back to
a shipped default — which is the reason this is a per-reader question and not a house rule.

Adjacent to `tasks/open/pets-json-fallback-reach-unverified.md`, which asks whether the fallback
is ever reached in production at all. This entry asks a different question: given that it is
reached, is the *trigger* correct.

**Settles when:** someone decides, for `getServerApplicationsAsync` and `settingsRepository`,
whether an empty result is an answer or an outage — and the chosen one is written down where the
guard is, with a test that fails if the trigger is changed back.
