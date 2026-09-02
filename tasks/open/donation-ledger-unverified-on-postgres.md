# Donation ledger has never run against a real Postgres

**Status:** ASSERTED · opened 2026-08-28 · re-verify before relying on it

The probe harness landed; the run against a real database did not happen. If still true, every
claim about the ledger's persistence behaviour rests on the in-memory double, not on Postgres —
which is exactly the class of assumption the agent exists to refuse.

Complication: `.env.local` points at the Neon **production** branch, so this cannot be settled by
running the app locally (`.claude/templates/triage-rules.md` §1). The safe paths are
`npm run test:db` or `npm run db:push:local` + `npm run db:seed:local`, all of which pin
`localhost:5432` — and Docker cannot start on this machine (WSL broken), so the local Postgres has
to be reachable some other way first.

**Settles when:** `npm run test:db` runs green against a real Postgres and the excerpt is pasted
into a spike verdict, or the gap is confirmed closed by someone else's run.
