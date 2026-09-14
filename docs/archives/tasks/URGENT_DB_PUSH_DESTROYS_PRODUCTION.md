# 🔴 URGENT — `npm run db:push` would destroy production data

**Date**: 2026-09-03
**Branch**: `followups` (fix landed here)
**Found at**: `fd4357a`, while applying the pet-sponsorship migration and running
`prisma migrate diff` against production first rather than pushing
**Files**: `package.json` (`db:push`), `prisma/env.ts`, `scripts/check-drift.ts`

> The detector already existed. `scripts/check-drift.ts` was written for exactly this and wired as
> `npm run db:check-drift` — but nothing ran it, and `db:push` sat one keystroke away with no guard.
> This is about closing that gap, not about discovering the drift.

---

## 1. What is wrong

`npm run db:push` resolves its target through `prisma.config.ts` → `resolveDatabaseUrl()` →
`.env.local`, which on a developer machine holds `NEON_BRANCH=production`. It then reconciles the
**whole** schema, dropping anything the database has that `prisma/schema.prisma` does not.

`prisma/env.ts` guards the seed against this exact mistake:

```ts
export function assertSeedTargetIsLocal(url: string): void { ... }
```

with the comment *"Aimed at a shared or hosted database that is destructive, and the operator gets
no confirmation prompt because the seed is designed to run unattended from an npm script."* Every
word applies to `db push`, and **nothing guarded it**.

## 2. The numbers, measured 2026-09-03

`npm run db:check-drift` against the production branch:

| | count |
|---|---|
| Destructive statements `db push` would run | **13** |
| Additive statements pending (other branches' work) | 39 |

The destructive ones:

```
DROP TABLE "faqs";                     DROP TYPE "FaqCategory";
DROP TABLE "notification_preferences";
ALTER TABLE "pets"  DROP COLUMN "status", "age", "ageCategory", "customQrUrl"
ALTER TABLE "adoption_applications"  DROP COLUMN "status"
ALTER TABLE "shelter_settings"  DROP COLUMN "bankQrUrl", "duitNowQrUrl", "paymentPayload", "tngQrUrl"
```

**The `status` drops are the worst of these.** Each is followed by
`ADD COLUMN "status" ... NOT NULL DEFAULT`, which does not migrate values — it resets them. Every
adopted animal returns to `Available`; every adoption application returns to `SUBMITTED`. That is
not recoverable from the application: the previous values exist nowhere else.

## 3. Why the database is ahead of the branch

Both directions contribute, and neither is a mistake anyone made:

- **The database has what master lacks.** `faqs`, `FaqCategory`, `notification_preferences`,
  `pets.customQrUrl` and the four `shelter_settings` QR columns belong to branches that pushed them
  and have not merged. Around ten worktrees run against this repo at once, each with its own schema.
- **Master has what the database lacks.** The `PetStatus` / `ApplicationStatus` enums and the
  `birthDate` columns are the branch ahead of the database.

With no `_prisma_migrations` ledger there is no shared answer to "what is actually in the database",
so every branch's `db push` is a whole-schema reconciliation against a database shaped by everyone
else. The steady state of that arrangement is data loss.

## 4. The fix that landed

```json
"db:push":        "tsx scripts/check-drift.ts && prisma db push",
"db:push:unsafe": "prisma db push",
```

`check-drift.ts` already exits `1` on destructive drift and `2` if it cannot run, so the `&&` makes
`db:push` **fail closed** — it refuses both when the database would lose data and when the check
itself is broken. Verified against production on 2026-09-03: the checker reported 13 destructive
statements and exited 1, so `npm run db:push` now stops there.

`db:push:local` is deliberately left unguarded: it pins `localhost`, where a whole-schema
reconciliation is the normal loop. `db:push:unsafe` exists so the escape hatch is a thing someone
has to type on purpose, the same shape as `ALLOW_REMOTE_SEED=true`.

## 5. What this does **not** fix

The drift itself. Each item needs someone who knows the intent:

- `faqs`, `notification_preferences`, the QR columns — owned by branches in flight; they resolve by
  merging, not by dropping.
- The `status` enum conversion needs a data-preserving `ALTER COLUMN ... USING`, not
  drop-and-recreate.
- `pets.age` / `ageCategory` were superseded by `birthDate` and may need backfilling first.

Tracked in [`tasks/open/production-schema-has-drifted-ahead-of-master.md`](../../tasks/open/production-schema-has-drifted-ahead-of-master.md).

## 6. How to apply schema changes until then

1. `npm run db:check-drift` — read it.
2. Write the additive SQL by hand into `prisma/migrations/manual/<date>_<name>/migration.sql`,
   taking `pg_advisory_xact_lock(4210771001)` so concurrent worktrees queue rather than race, and
   making every statement idempotent.
3. Rehearse on a Neon branch cut from production (`neon branches create`), apply, re-apply to prove
   idempotence, then apply to production with `prisma db execute --file`.
4. Re-run `db:check-drift` and confirm only the pre-existing drift remains.

`prisma/migrations/manual/20260903_pet_sponsorships/migration.sql` is a worked example.
