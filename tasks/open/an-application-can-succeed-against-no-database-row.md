# An adoption application can be told it succeeded when no database row was written

**Status:** open · opened 2026-09-22 · reasoned from the code and the schema during review of the submission-guard change, not reproduced against a live database

`submitApplication` checks its target animal against the database and refuses one that is missing,
archived or not adoptable. When the database cannot answer, `findServerPetByIdAsync` falls back to
the `src/data/pets.json` mirror, which answers under the exact id that was posted — so the guard's
exact-id comparison cannot fire, and `isArchived` and `status` are read off the fixture.

Two ways in:

- the database answers "no such row" for an id that *is* in `pets.json` — a row never seeded, or
  removed out of band. This is the missing-row half, and a parallel branch closes it by returning
  `null` after a successful empty read;
- the query *throws*. `handlePersistenceError` rethrows only under `STRICT_PERSISTENCE`, which
  nothing outside `vitest.config.mts` and one npm script sets. In production the mirror answers.
  This half is deliberate and must stay — a swallowed database error must not fail the mutation
  (`tasks/lessons/2026-09-04-a-dual-layer-fallback-must-never-let-a-swallowed-database-error-fail.md`).

**What it costs is worse than applying for a demo animal.** `AdoptionApplication.petId` carries a
foreign key to `Pet.id` (`prisma/schema.prisma:174-175`). An application accepted against an id the
`Pet` table does not hold raises P2003 on insert, and `insertServerApplication` hands that to
`handlePersistenceError(…, "write")`, which rethrows only P2002. So the insert is swallowed too:
the application exists in the in-memory mirror until the next process restart, and the applicant is
returned `success: true` with a reference code for a record that reached no database and that the
tracking portal will not find after a redeploy. Nothing logs an error in production, because the
write-kind warning is the only signal and it is a console line.

This is not new to the guard — the same silent-success shape existed before, when the archive check
read the fixture — but the guard is what now makes the claim "the animal was checked against the
database", and that claim does not hold on these paths.

The honest fix is not another per-caller check; the id comparison is already there and cannot see
this. It is either a reader that tells its caller which source answered, so a *write* path can
refuse what a *read* path is happy to serve from the fixture, or a write that does not swallow
P2003. The second is the smaller one and is probably right on its own: a foreign-key violation is a
deterministic caller error, not a transient outage, which is the same argument `persistenceMode.ts`
already makes for rethrowing P2002 in every mode.

**Settles when:** a submission that cannot be persisted does not report success — either because
the write path distinguishes a fixture-backed resolution from a database one, or because
`handlePersistenceError` treats P2003 the way it treats P2002 — pinned by a strict-persistence test
that arranges a `findUnique` miss on a real `pets.json` id and asserts the caller is not told the
application succeeded.
