# A missing Docker is not a missing database tier

**Learned:** 2026-09-14

For eleven days every entry touching persistence carried the same line: `npm run test:db` needs
Postgres on `localhost:5432`, Docker cannot start here (WSL is not registered), so the Prisma
branch is ASSERTED. Three decisions and one open item said it. The donation ledger's Postgres suite
had never run on this machine, and the sponsorship reader had never run anywhere.

`npm install embedded-postgres` in the session scratchpad downloads a self-contained PostgreSQL
(18.4, ~40 MB) with no engine, no service and no admin rights. Started with the credentials
`docker-compose.yml` uses, `npm run db:push:local` and `npm run test:db` ran exactly as written.
Both suites went green; a six-writer concurrency spike ran against a real server in under two
seconds. The whole detour cost about four minutes. Stopping the process deletes the data.

The rung was never missing. It was priced as missing because the one documented way to reach it
was broken, and nobody had asked whether the rung had a second ladder.

**Rule:** when `triage-rules.md` says a falsification rung is unavailable, spend five minutes on a
second route before writing ASSERTED. For Postgres specifically: `embedded-postgres` in the
scratchpad, port 5432, user `postgres`, password `postgrespassword`, database `pet_shelter`, then
the two `:local` scripts. Stop it before running the offline suites, or the "no database" branches
find one.
