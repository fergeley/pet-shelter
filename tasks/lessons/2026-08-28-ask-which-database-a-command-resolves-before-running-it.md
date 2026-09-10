# Ask which database a command resolves, before running it

**Learned:** 2026-08-28

`npm run db:push && npm run db:seed` looked like one operation against one database. It was two
operations against two, because the two halves loaded different env files:

- `prisma.config.ts` → `dotenv` on `.env.local` → a Neon branch marked `NEON_BRANCH=production`
- `prisma/seed.ts` → `import "dotenv/config"` → `.env` only, which this repo does not have → the
  hardcoded `localhost:5432` fallback

Both exit 0. The pair reads as an end-to-end verification while the halves have never met, and the
push half was mutating shared infrastructure.

**Rule:** before running any command that writes to a database, trace the env resolution for *that
specific command* and print the host it will hit. Never infer it from a sibling command in the same
npm chain. `dotenv` never overrides an already-set variable, so a shell-set `DATABASE_URL` is the
safe lever — it beats every env file without editing one.

**Corollary:** a destructive script (`deleteMany`, `TRUNCATE`, `db push`) that takes its target from
ambient configuration should refuse a non-local host and make the override explicit
(`ALLOW_REMOTE_SEED=true`). Configuration is not consent.
