# The donation ledger has now run green against a real PostgreSQL

**Decided:** 2026-09-03 · Closes `tasks/open/donation-ledger-unverified-on-postgres.md`,
open since 2026-08-28.

## What settled it

`npm run test:db` ran green in CI on `5367676`:

    ✓ integration-db  tests/integration/db/donationLedger.postgres.test.ts (8 tests) 787ms
        ✓ takes the Postgres branch rather than the in-memory ledger
    ✓ has the donation ledger tables
    ✓ enforces the composite receipt-serial uniqueness as a real index
    ✓ round-trips a written value unchanged
    Strict persistence against Postgres — pass (49s)

Run: https://github.com/fergeley/pet-shelter/actions/runs/33654368415

That is the settle condition the open entry named, met in CI rather than locally.

## Why it took four fixes to get there

The entry assumed the gap was that nobody had *run* the probes. The truth was worse: the
CI job that runs them had been failing before it reached a database, so the coverage
everyone assumed existed had never executed once since the Prisma 7 upgrade. Four defects
were stacked, each hiding the next:

1. **`prisma db push --skip-generate`** — Prisma 7 removed the flag. The step died with
   `unknown or unexpected option`, taking both database jobs with it.
2. **The password never matched.** The service container ran `POSTGRES_PASSWORD: postgres`,
   but `npm run test:db` pins `postgrespassword` through cross-env, so the script's value
   silently overrode the job's and the probes failed `28P01` against a healthy database.
   `docker-compose.yml` and the `db:*:local` scripts had always used `postgrespassword`;
   CI was the odd one out.
3. **The job never seeded.** `schemaIntegrity.postgres.test.ts` verifies a seed round-trip,
   so an empty database failed it with "No fixture pets found" — a message about the seed,
   printed by a test named for the schema.
4. **A comparison that could never pass.** `expect(row?.status).toBe(fixture.status)` read
   the raw column, but `PetStatus` declares `In_Rehabilitation @map("In Rehabilitation")`:
   Postgres stores the spaced string and the Prisma client returns the identifier. The
   application was never affected — `petRepository` reads through `fromDbPetStatus` — so
   this was the assertion being wrong, not the mapper.

## What this does and does not establish

**Does:** the ledger takes the Postgres branch under a real server; the `Donation` and
`ReceiptSequence` tables exist as pushed; the composite receipt-serial uniqueness is a real
index rather than a Prisma-side promise; a written value round-trips unchanged.

**Does not:** say anything about the Neon production branch, which has drifted separately
and is still the reason `db push` must not be pointed at it casually. Nor about gapless
numbering under real concurrency — the probes are sequential.

## The lesson worth keeping

A CI job that fails in setup is worse than no CI job, because the badge and the job list
both suggest coverage that has never run. The three months this went unnoticed are the
cost. Prefer a check that fails loudly on its first broken assumption to one that dies in
its own scaffolding.
