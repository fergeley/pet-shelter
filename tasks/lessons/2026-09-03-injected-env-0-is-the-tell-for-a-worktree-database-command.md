# `injected env (0)` is the tell for a worktree database command

**Learned:** 2026-09-03

`prisma.config.ts` resolves `.env.local` against the current directory, and
`.env.local` is gitignored so it exists only in the main checkout. Run a Prisma
command from a worktree and `resolveDatabaseUrl()` silently falls back to
`localhost:5432`, producing `P1001 Can't reach database server` — which names
the wrong problem entirely. The database is fine; Prisma never learned its
address. The `injected env (0)` line above the error is the actual diagnosis.

Fix without moving anything: run from the main checkout and point `--file` at
the worktree path.
