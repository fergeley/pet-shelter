# A backfill is a deploy-ordered step, not a migration detail

**Learned:** 2026-09-03

The RBAC migration split cleanly into additive DDL (safe against the running
release, which never reads the new columns) and a role backfill (not safe at
all). Rewriting an administrator's row to SUPER_ADMIN while the previous release
is serving still lets them sign in — the login action does not gate on role —
and then denies every admin route, because that code compares
`session.role === ROLES.ADMIN` literally.

**Rule:** for any enum widening, ask which half can run before the deploy and
which cannot, and put the answer in the SQL file rather than in the head of
whoever is running it. Additive schema first, deploy, backfill last.
