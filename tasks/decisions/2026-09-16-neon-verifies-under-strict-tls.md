# Neon's certificate chain verifies under `rejectUnauthorized: true`

**Decided:** 2026-09-16

Closes `tasks/open/neon-certificate-chain-not-observed.md` (opened 2026-09-08, ASSERTED). Its settle
condition was "a connection to the hosted database is observed succeeding with
`rejectUnauthorized: true`". That happened, by accident, on 2026-09-14.

## The observation

Local Playwright runs from the main checkout started `next dev` on `.env.local`, which points at
the Neon production branch, and wrote to it. A masked summary of the production export taken
2026-09-16 (`audit_logs`, `donations`, `adoption_applications`; counts, action names and
identifiers only):

- **27 rows on 2026-09-14, 13:34–16:01 UTC:** 24 audit rows and 3 donations. The audit rows are
  4 `APPLICATION_SUBMITTED`, 3 `DONATION_RECEIVED`, 3 `PET_ARCHIVED` + 3 `PET_RESTORED` by
  `usr-admin-01`, and 11 `EMAIL_FAILED`. The donations are three RM30 pledges, receipts
  `HFS-DON-202609-0001` to `0003`.
- **The export's timestamps are UTC.** The application ids are `app-${Date.now()}`
  (`src/actions/applications.ts:140`), and `app-1789392875319` decodes to
  `2026-09-14T13:34:35.319Z`, 52 ms before its raw `createdAt` of `2026-09-14 13:34:35.371`.

## Which code made those connections

`.env.local` exists only in the main checkout, and its HEAD reflog (`.git/logs/HEAD`, times in
UTC) places the runs:

| Run (UTC) | HEAD | Checked out |
|---|---|---|
| 13:34 | `690a09c` (`fix/playwright-adoption-multi-step`) | 13:29; `fix(e2e): Drive adoption wizard in Playwright` committed 13:36 |
| 15:41 | `a2f7cf1` (`feat/pet-form-birth-date`) | 15:34 |
| 16:00 | `c7bbc17` | committed 15:45 |

`src/lib/server/prisma.ts` at all three commits is identical to `1715e30`, the PR #35 merge, whose
`resolveDatabaseSsl` returns `ssl: { rejectUnauthorized: true }` for a public host and strips
`sslmode` so `pg`'s connection-string merge cannot discard it. `.env.local` defines no
`NODE_TLS_REJECT_UNAUTHORIZED` (key names checked, no values read), and the variable is unset in
this user's environment.

## Correction to how this was first reported

The 2026-09-16 hand-off read the export's times as `+08` and said the main checkout sat on
`1715e30` "until after 16:00 on 09-14". Both were wrong: the times are UTC, and HEAD left `1715e30`
at 12:51 UTC. The conclusion survives only because the three later HEADs carry the same
`prisma.ts`, which is why this entry names them rather than repeating the shortcut.

## What this does not establish

- That the working tree matched HEAD for `prisma.ts` during each run. Nothing recorded it.
- Anything about **Vercel**. These were local connections. Whether production's deployment has a
  `DATABASE_URL` at all is still unobserved from the repo.

## Also from the same runs

The same export shows the consequence recorded in
`tasks/open/production-schema-has-drifted-ahead-of-master.md`: four applications that the app
reported as submitted and that never reached `adoption_applications`. The runs themselves are why
`playwright.config.ts` no longer hands the web server a non-local database —
`tasks/decisions/2026-09-16-local-e2e-cannot-reach-a-remote-database.md`.
