# A pet profile still falls back to a fixture when the database says the row does not exist

**Status:** open · opened 2026-09-16 · residual of the second review of PR #38

`findServerPetByIdAsync` treats "the database answered, and there is no such row" the same as "the
database could not be reached": both fall through to the in-memory mirror.

    if (isDatabasePersistent()) {
      try {
        const row = await prisma.pet.findUnique({ where: { id: id.trim() }, ... });
        if (row) { ... return pet; }
      } catch (err) { ...; return findServerPetById(id); }
    }
    return findServerPetById(id);        // ← also reached after a successful null

PR #38 closed the half of this that defeated its own claim. Postgres matches ids case-sensitively
and the mirror does not, so `/pets/PET-001` missed the database, matched fixture `pet-001` —
unarchived — and served an animal the database had archived. `getPetById` now refuses any result
whose id is not exactly the one requested, pinned by
`tests/integration/softDeleteFiltering.test.ts` ("does not serve an archived animal through a
case-variant of its id").

What remains, observed in that same suite's arrangement rather than in production:

- **An id present in `pets.json` but absent from a populated database is served at its exact
  URL.** The catalogue does not list it — `getServerPetsAsync` trusts the database whenever it
  returns at least one row — so the animal is unreachable from `/pets` and reachable at
  `/pets/<id>`. A hard-deleted row, or a fixture id production was never seeded with, shows the
  bundled demo animal publicly. It is not an *archived* animal leaking; it is demo data leaking.
- **Every public profile view now rewrites the shared mirror**, moving the viewed animal to its
  front. Before PR #38 an anonymous GET never mutated module state. During a database outage
  `getServerPetsAsync` serves that mirror as the catalogue, so its order would follow recent
  profile views. Cosmetic; recorded so it is met as a known effect.

Both are the repository's fallback policy, which is the open question in
`tasks/open/pets-json-fallback-empty-means-outage.md` — can this table legitimately be empty, and
does "no row" ever mean "ask the fixture"? Settling that one settles the first bullet here.

**It is not only the profile.** The third review of PR #38 found a second public caller with the same
exposure: sponsorship checkout, `src/actions/sponsorships.ts`, resolves the animal with
`findServerPetByIdAsync(validated.petId)`. A posted `petId` of `PET-001` misses Postgres, falls
through to the mirror, and records a pledge against fixture `pet-001` under the fixture's name —
including when the database has that animal archived. The exact-id guard PR #38 added protects
`getPetById` alone; it was the right fix for that PR's claim and the wrong place for the general
one. Guarding each caller does not scale past two, which is the argument for the repository fix
below over another per-caller check.

**Settles when:** `findServerPetByIdAsync` returns `null` after a *successful* database read that
found nothing, falling back to the mirror only when the database is not persistent or the query
throws — checked against the update and archive mutations that also read through it — or the
fallback policy is decided the other way on purpose and this entry is closed with that decision.
