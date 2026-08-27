# Live Postgres verification & schema integrity audit

Executing `docs/tasks/TARGET_SCHEMA_TYPE_INTEGRITY.md` §2 (the standing "never verified against real
Postgres" gap) plus §3 P-E. Branch `feat/tnrm-rehabilitation`.

## Critique of the brief as given

The brief's own steps could not be run as written. Recorded here because the reasoning is the
deliverable, not just the fix.

- [x] **`npm run db:push` targeted Neon production, not localhost.** `prisma.config.ts` loaded
      `.env.local` first, and that file carries a Neon URL with `NEON_BRANCH=production`. The brief
      also asked for `.env.local` to be rewritten — it holds live credentials and must not be
      touched by tooling.
- [x] **`db:push` and `db:seed` resolved different databases.** The seed used `import "dotenv/config"`
      (loads `.env` only; this repo has none), so it fell through to a hardcoded localhost default
      while the push went to Neon. Both exit 0. A green pair proving nothing.
- [x] **An integration probe would have run in memory.** `isLedgerPersistent()` keys off
      `DATABASE_URL`, but `src/lib/server/prisma.ts` falls back to a hardcoded localhost URL, so with
      the variable unset the ledger silently takes its in-memory branch and every assertion passes.
- [x] **`recordDonationReceipt()` does not exist** — the export is `issueDonationReceipt()`.
- [x] **`AdoptionApplication.petName` is documented in §3 P-E, not §2**, and P-E is explicitly
      "model comments only", not an audit.
- [x] **`npm run test:integration` proved nothing** — one file asserting an env var is set.

## Work

- [x] `prisma/env.ts` — one resolver for the CLI and the seed, so they cannot diverge again
- [x] Seed refuses a non-local target (`ALLOW_REMOTE_SEED=true` to override)
- [x] `db:up`, `db:down`, `db:push:local`, `db:seed:local`; `test:db` pinned to localhost
- [x] Tier 3b `integration-db` vitest project — fails rather than skips without a database, and is
      kept out of `test:all` so the no-Docker baseline stays honest
- [x] `donationLedger.postgres.test.ts` — rollback, unique index, 8-way concurrency, integer sen
- [x] `schemaIntegrity.postgres.test.ts` — `rehab*` columns and the two tables were really pushed;
      fixtures round-trip
- [x] Probes refuse a non-local host before opening a connection
- [x] P-E model + field comments on `AdoptionApplication` and `AuditLog`
- [x] Stale `src/lib/donationLedger.ts` / `src/lib/userStore.ts` paths corrected
- [x] `TARGET_SCHEMA_TYPE_INTEGRITY.md` §2.1 / §2.2 / §5 / §6 / §8 updated
- [ ] **BLOCKED** — `npm run db:up && npm run db:push:local && npm run db:seed:local && npm run test:db`

## Blocker

WSL2 is broken on this machine: every `wsl` call returns
`Wsl/CallMsi/Install/REGDB_E_CLASSNOTREG`. Docker Desktop's only context is `desktop-linux`, which
requires it, and there is no native Postgres on the host. Repair needs an elevated shell
(`wsl --update`) and a Docker Desktop restart; Windows 11 Home rules out the Hyper-V backend.

## Review

Verified green: `npx tsc --noEmit` 0 errors · `npm run lint` 0 errors · `npm test` 537/537 ·
`npm run test:all` 538/538.

Verified by execution, not inspection:

- `npm run db:seed` against the real `.env.local` **refuses**, naming the Neon production host.
- `vitest --project integration-db` with a Neon-shaped URL **refuses** before connecting.
- `npm run test:db` with no database **fails** with exit 1 and an actionable message — it does not
  skip.

The Tier-3b suites have never been run green. They are written and wired; the claim being made is
"the harness exists and fails correctly when the database is absent", not "the ledger is verified
against Postgres". That second claim stays open until the blocker above is cleared.
