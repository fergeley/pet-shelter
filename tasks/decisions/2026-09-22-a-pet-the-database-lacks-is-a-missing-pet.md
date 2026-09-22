# A pet the database does not hold is a missing pet, not a cue to serve the fixture

**Decided:** 2026-09-22

Closes `tasks/open/pet-profile-falls-back-to-a-fixture-the-database-lacks.md`, the residual of the
second and third reviews of PR #38, by taking the option its "Settles when" named first.

`findServerPetByIdAsync` fell through to the `src/data/pets.json` mirror on both exits of its
database branch — after a thrown query *and* after a query that succeeded with no row. It now
returns `null` for the second, and reaches the mirror only from its `catch` or when
`isDatabasePersistent()` is false.

    if (!row) return null;          // was: fall out of the `if` and into the mirror

## Why this way

The two readers beside it had already answered the same question in the same direction, and the
inconsistency was the defect rather than the policy:

- `getServerPetsAsync` returns `[]` for an empty table and falls back only from its `catch`.
  Pinned by `softDeleteFiltering.test.ts`, "returns an empty array without falling back to
  fixtures when the database is merely empty".
- `getServerFaqsAsync` does the same, after the same bug was fixed there in PR #13
  (`decisions/2026-09-03-empty-faq-table-is-pinned-as-an-answer.md`).

So the catalogue and the profile disagreed about the same table. An id in `pets.json` but absent
from a populated database was omitted from `/pets` and served at `/pets/<id>` — unreachable from
the grid, reachable by direct link — and `src/actions/sponsorships.ts` recorded pledges against
the fixture's name and id through the same read. A hard-deleted row, or a fixture id production
was never seeded with, was enough to publish a demo animal on a live shelter.

Fixed at the repository rather than per caller. PR #38's exact-id guard in `getPetById` was the
right fix for that PR's claim and the wrong place for the general one; there were already two
callers, and the third (`submitApplication`) is queued.

## What this deliberately stops serving

Named so the next person meets it as a decision rather than as a bug:

- **A database that is reachable but unseeded now 404s every profile.** That is already what the
  catalogue does there — `/pets` is empty in the same state — so the two surfaces now agree, and
  the honest empty state is the one `tasks/lessons/2026-09-03-a-fallback-that-fabricates-data-is-a-defect-not-resilience.md`
  argues for on any surface that makes a claim about a real animal.
- **A pet whose `insertServerPet` write was swallowed in non-strict mode while reads kept
  working** lives only in the mirror, and now 404s. The mirror is documented as "a fallback read
  source, never a source of truth" at the top of `petRepository.ts`; serving it would be the
  mirror acting as truth. The write already warns (`kind: "write"` warns in every environment).
- **The outage path is untouched and still tested.** A thrown query still serves the mirror in
  non-strict mode, and still rethrows under `STRICT_PERSISTENCE`. Asserting only that a missing
  row returns `null` would also pass against a reader that had lost its fallback entirely, so
  `petMissingRowIsAnAnswer.test.ts` pins both halves plus the no-database path.

  **Stated as a virtue above; it is also a residual, and the first draft of this entry said only
  the first half.** Preserving the fallback means that during a real outage `/pets/pet-001` still
  renders the demo animal and checkout still bills a pledge against it — the same exposure this
  entry is named for, reached by the other door. No deployed environment sets
  `STRICT_PERSISTENCE`, so that is production behaviour, not a test-only path. Filed as
  `tasks/open/an-outage-serves-and-bills-fixture-animals.md`. The review of this change caught
  the omission; it is recorded here rather than quietly widened, because "the outage path is
  untouched" and "the outage path is fine" are different claims and only the first is true.

## Not closed by this

- **Sponsorship checkout still accepts an *archived* animal.** The entry this settles named the
  checkout exposure as covering both a missing animal and an archived one; only the first is a
  repository question, because an archived pet is a row the database really has. Refiled as
  `tasks/open/sponsorship-checkout-accepts-an-archived-animal.md` rather than left in this
  entry's prose — `open/` mirrors to a public GitHub issue and a settled decision does not, so
  burying a live money-taking gap here would have removed it from the only list anyone reads.
  Found by the review of this change; not observed in production.

- **Every public profile view still rewrites the shared mirror**, moving the viewed animal to its
  front, so during an outage the catalogue's order follows recent profile views. Carried over
  from the closed entry's second bullet, unchanged and still cosmetic: an anonymous GET mutating
  module state is worth knowing about, and the sync is what lets a later outage serve a recently
  viewed animal. Recorded here so deleting the open entry does not lose it.
- **`submitApplication` is being fixed concurrently, on `worktree-adoption-submit-guards`.** That
  branch switches the action to `findServerPetByIdAsync` and deletes
  `tasks/open/submit-application-checks-a-fixture-and-no-status.md` in favour of its own decision
  entry, `2026-09-22-a-public-adoption-submission-validates-its-target-against-the-database.md`.
  It is built
  on the same base commit as this branch, so on its own it inherits the *pre-fix* reader and a
  fixture id still resolves there; the two changes compose, and neither is complete without the
  other. Nothing was written to that open entry from here — it is another session's to close, and
  editing a file someone is deleting buys a modify/delete conflict for a note nobody needed. The
  two branches touch disjoint paths (`src/actions/applications.ts` there, `petRepository.ts`
  here), so whichever merges second should re-run the other's suite rather than trust the clean
  merge.
- **The other two readers named in `tasks/open/pets-json-fallback-empty-means-outage.md`** —
  `getServerApplicationsAsync` and `settingsRepository` — are unexamined. That entry has been
  narrowed to them.

## Comments corrected as part of this

Three comments described the pre-fix trigger and were being read as the spec, which is how the
pet reader kept looking intentional:

- `tests/integration/support/prismaDouble.ts` justified its empty-by-default reads by
  "`getServerPetsAsync` only trusts the database when it returns at least one row" — untrue since
  that reader was fixed.
- `tests/integration/faqEmptyPublishSet.test.ts` pointed at the pet readers as "two nearby
  precedents pointing the wrong way".
- `src/actions/pets.ts` carried "what this does not close", naming this exact gap.
