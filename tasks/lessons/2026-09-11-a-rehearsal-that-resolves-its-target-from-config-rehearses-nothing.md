# A rehearsal that resolves its target from config rehearses nothing

**Learned:** 2026-09-11

Writing the brief for activating the sponsor portal on production, I wrote a "rehearse on a Neon
branch cut from production" step whose apply command was a bare
`npx prisma db execute --file prisma/sql/<file>.sql`. Checking the brief's own claims before
committing it, `prisma/env.ts` showed that `resolveDatabaseUrl()` loads `.env.local` — which is
production. So the rehearsal step would have **applied the migration to production**, and the
explicit human-approval halt two steps later would have been approving something already done.

Nothing in the command's text said "production". The danger lived in a config file the command
never names, which is exactly why reading the runbook would not have caught it and running it
would have.

**Rule:** in any runbook step meant to hit a non-default target — a rehearsal branch, a scratch
database, a staging host — put the target **inline on the command**, and tell the reader which
line of output proves where it went (here `db:check-drift` prints a masked `Target:` line). A step
that relies on "the environment" to point somewhere safe inherits whatever the environment points at
today.
