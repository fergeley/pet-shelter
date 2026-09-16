# `getPublicPets` trusts its filter argument, and disagrees with the gallery about bad values

**Status:** ASSERTED · opened 2026-09-16 · from the fourth review of PR #38, reasoned from the code

`getPublicPets(filters?: PetFilterInput)` in `src/actions/pets.ts` is a public server action — any
visitor can call it — and it does not parse its argument through `petFilterSchema`. Two
consequences, neither exercised:

- **A crafted non-string `search` throws.** `matchesPetSearch` calls `.trim()` on the query, so
  `{ search: 123 }` is a `TypeError` inside the action and a server error for the caller. No data is
  exposed; it is a robustness gap on a public endpoint, not a leak.
- **It disagrees with the gallery about unrecognised values.** PR #38 made the gallery resolve every
  URL value against `petFilterSchema` (`resolveFilters` in `usePetGalleryController`), treating an
  unrecognised value as "not filtering". The action still compares with plain equality, so
  `getPublicPets({ species: "Dog" })` returns nothing where `/pets?species=Dog` shows every animal.

Why it was left: no production caller passes this action filters. `/pets` stopped narrowing
server-side in PR #38 so the track tabs could count the whole population; the home page and the
donation widget call it with no argument. The filter path is reached only by tests and by a
hand-crafted request.

The search rule itself is already shared (`src/lib/domain/petSearch.ts`); the species, gender,
status, age and size checks are still two copies.

**Settles when:** the action resolves its input through the same schema-backed resolution the
gallery uses — ideally one function both call — with a test that a non-string field is rejected or
ignored rather than thrown on. Or the filter argument is removed from the public action, if nothing
is going to pass one.
