# Local e2e cannot reach a remote database, and never sends mail

**Decided:** 2026-09-16

On 2026-09-14 three ordinary local `npx playwright test` runs wrote 27 rows to the Neon production
branch: four adoption applications (lost, see the drift entry), three RM30 donations holding the
real receipt numbers `HFS-DON-202609-0001` to `0003`, three archive/restore pairs on a real pet, and
eleven attempted emails. Evidence: `tasks/decisions/2026-09-16-neon-verifies-under-strict-tls.md`.

Nothing was misused. `playwright.config.ts` loads `.env.local` so its cookie fixture signs with the
server's `SESSION_SECRET`, `.env.local` points at production, and the web server inherited all of
it. The known-safe command — `DATABASE_URL="" RESEND_API_KEY="" npx playwright test` — existed only
in memory, which is where it failed.

## What was chosen

- The web server gets `env: { DATABASE_URL, RESEND_API_KEY: "" }`, set explicitly.
  `DATABASE_URL` comes from `resolveE2eDatabaseUrl` (`prisma/env.ts`): the configured URL when
  `isLocalDatabaseUrl` accepts it or `E2E_ALLOW_REMOTE_DATABASE=true`, otherwise `""`.
- `reuseExistingServer: false`, in every environment.

## Why these, and not the alternatives

- **Run offline rather than refuse to run.** Throwing on a remote URL would make the default local
  command fail every time on the one machine that has `.env.local`, and train the operator to
  reach for the opt-in. Every spec already passes offline (23/23), so the safe mode loses nothing.
  The config warns once per process that it did so. **Except in CI**, where it throws: that job
  provisions Postgres because the database is what it tests, and an offline run there would be a
  green job that checked less. Raised by code review on the pull request.
- **`""`, not deleting the variable.** `next dev` loads `.env.local` itself and fills any variable
  that is absent; a present empty value survives
  (`tasks/decisions/2026-09-08-a-receipt-asserts-relief-only-when-it-can-back-it.md`).
- **The same allow-list as the seed.** `isLocalDatabaseUrl` already guards `db:seed`; a second
  notion of "local" would drift. It is narrower than `resolveDatabaseSsl`'s internal-host test on
  purpose: a private-network Postgres may still be shared.
- **No reuse, not reuse-if-safe.** A server already listening has whatever environment it was
  started with, and nothing here can read it. A port in use now fails the run with Playwright's
  "already used" error. That also stops `E2E_BASE_URL` silently aiming the specs at a server that
  is already up.
- **Mail is blank even with the opt-in.** The specs write to `e2e-*@example.test`, to seeded
  applicants, and to `SHELTER_NOTIFICATION_EMAIL`. No run needs a real send.

## Observed

- **Control, `85ee351`'s config:** `DATABASE_URL=postgresql://…@e2e-remote.invalid/…`, one spec,
  `DEBUG=pw:webserver`. The web server logged "Can't reach database server at e2e-remote.invalid"
  23 times, and the 4 tests passed. **A green run does not reveal the hazard.**
- **This config**, same URL plus `RESEND_API_KEY=re_fake_not_a_real_key`, full suite: 23 passed,
  0 mentions of `e2e-remote.invalid`, 5 `[Email Simulation]` lines, 0 mentions of `api.resend.com`.
- **A stand-in server on the port:** the run failed with "http://localhost:3110 is already used".
- **Unit tests** (`tests/unit/e2eDatabaseIsolation.test.ts`) load the real config from a temp
  directory whose `.env.local` names a fake remote host. With `85ee351`'s config, three fail: no
  `env`, and `reuseExistingServer: true`.

## Not covered

- CI's e2e job is not runnable here (no Docker). Its `DATABASE_URL` is `localhost`, which passes
  through unchanged; the pull request's CI run is the check.
- A developer who runs `next dev` by hand on `.env.local` and clicks through a mutation still
  writes to production. That is `triage-rules.md` §1, and no config here reaches it.
- `isLocalDatabaseUrl` reads the URL's hostname only. A `localhost` port forwarded to a hosted
  database, or a `?host=` query parameter that `pg` would honour over the hostname, passes as
  local. Both take deliberate setup; the seed guard shares the same limit.
