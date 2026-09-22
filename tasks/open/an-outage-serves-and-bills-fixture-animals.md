# During a database outage the public profile serves a demo animal, and checkout bills against it

**Status:** ASSERTED · opened 2026-09-22 · residual of
`decisions/2026-09-22-a-pet-the-database-lacks-is-a-missing-pet.md`, found by the review of it

That change stopped `findServerPetByIdAsync` serving the `src/data/pets.json` mirror after a
*successful* query that found no row. It left the other door open, which is the right default and
the wrong thing to leave unwritten:

    } catch (err) {
      handlePersistenceError("Prisma pet find by id", err, "read");
      return findServerPetById(id);     // ← still the fixture
    }

`handlePersistenceError` rethrows only under `STRICT_PERSISTENCE`, and that flag is set in exactly
two places — `package.json`'s `test:integration` script and `vitest.config.mts`. **No deployed
environment sets it.** So in production a transient read failure on `prisma.pet.findUnique` is
swallowed and the mirror answers.

For an id that really is in `pets.json` — `pet-001`, unarchived there — that means:

- `/pets/pet-001` renders the demo animal "Bella". `getPetById`'s exact-id guard does not refuse
  it: the guard compares `pet.id` to the requested id, and here they match exactly. The guard
  only ever refused *case-variants*.
- `createPetSponsorshipAction` resolves the same fixture and records a pledge in the real ledger
  with `petId: "pet-001"`, `petName: "Bella"` — money taken against an animal the shelter may not
  have, during a window where nobody is watching the database.

Serving a stale read rather than an error is the documented dual-layer design and is not in
question. What is in question is narrower: **the fixture is not a stale read.** It is bundled demo
content that no shelter ever entered, and on the checkout path it is attached to a payment. The
distinction is the one
`tasks/lessons/2026-09-03-a-fallback-that-fabricates-data-is-a-defect-not-resilience.md` draws —
a cache asserts nothing, substitute data asserts "this is the animal".

**ASSERTED, not measured.** Reasoned from the code and from where the flag is set; no outage has
been provoked against a running instance, and `tasks/open/pets-json-fallback-reach-unverified.md`
still asks whether this fallback is reached in production at all. That entry asks *whether*; this
one says what it costs *if* it is.

Options, none chosen: evict the denied id from the mirror so a later outage cannot serve it
(cheap, and the reason `petMissingRowIsAnAnswer.test.ts` deliberately does not assert that the
queried id survives); or mark mirror-sourced pets so the profile can render a degraded state and
checkout can refuse; or accept it for the profile and refuse it for checkout only, on the ground
that a page can be wrong for a minute and a pledge cannot.

**Settles when:** someone decides whether a fixture animal may be served during an outage, and
whether it may be *billed* against during one — the two can legitimately be answered differently
— and the chosen answer is pinned by a test that provokes a read failure in non-strict mode and
asserts what the profile and the checkout each do.
