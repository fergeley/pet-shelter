# Production Postgres carries objects master does not declare, and `db push` would drop them

**Status:** open, reduced 2026-09-03 · measured against the production branch, not inferred

> **Five of the twelve destructive lines are gone.** The QR branch declares the
> columns it had already applied to production, so `migrate diff` no longer
> proposes dropping `pets.customQrUrl` or `shelter_settings.duitNowQrUrl`,
> `tngQrUrl`, `bankQrUrl` and `paymentPayload`. They were the drift this note
> measured, not a separate problem.
>
> Still outstanding: the `ApplicationStatus` / `PetStatus` enum conversions, the
> `pets.age` / `ageCategory` drops, and `notification_preferences`. `db push`
> remains unguarded and still destructive — re-measure with `migrate diff`
> rather than trusting this list.

`npm run db:push` resolves through `prisma.config.ts` → `resolveDatabaseUrl()` → `.env.local`,
which holds `NEON_BRANCH=production`. Unlike the seed, **push has no local-only guard**:
`prisma/env.ts` protects `db:seed` with `assertSeedTargetIsLocal`, and nothing protects push.

A read-only `prisma migrate diff` against production on 2026-09-03 returned **265 lines**,
of which **12 are destructive**:

    ALTER TABLE "adoption_applications" DROP COLUMN "status", ADD COLUMN "status" "ApplicationStatus" ...
    ALTER TABLE "pets" DROP COLUMN "age", DROP COLUMN "ageCategory", DROP COLUMN "customQrUrl",
                       DROP COLUMN "status", ADD COLUMN "status" "PetStatus" ...
    ALTER TABLE "shelter_settings" DROP COLUMN "bankQrUrl", DROP COLUMN "duitNowQrUrl",
                       DROP COLUMN "paymentPayload", DROP COLUMN "tngQrUrl"
    DROP TABLE "faqs";
    DROP TABLE "notification_preferences";
    DROP TYPE "FaqCategory";

Running `npm run db:push` today would therefore **destroy the FAQ feature, notification
preferences, the donation QR configuration, and the status of every pet and every adoption
application** — a `DROP COLUMN "status"` followed by `ADD COLUMN ... DEFAULT 'Available'`
does not migrate the values, it resets them. Adopted animals become Available.

## Why the database is ahead of the branch

Both directions have contributed:

- **Objects master has not caught up to.** `faqs`, `FaqCategory`, `notification_preferences`,
  `pets.customQrUrl` and the four `shelter_settings` QR columns exist in production because
  branches that declare them pushed them and have not merged. Several worktrees run against
  this repo at once, and each has its own schema.
- **Objects master declares that production predates.** The `PetStatus` / `ApplicationStatus`
  enums and the `birthDate` columns are the branch being ahead of the database.

So this is not one team member's mistake to undo. It is the expected end state of a shared
database with no migration history, several concurrent branches, and a push command that
takes its target from whatever `.env.local` happens to contain.

## What was done on 2026-09-03, and what was deliberately not

The sponsorship feature needed three additive objects. Rather than push:

1. `prisma migrate diff --from-config-datasource --to-schema ... --script` — read-only,
   which is how the drift was found at all.
2. The three sponsorship statements were extracted by hand into
   `prisma/sql/2026-09-03_pet_sponsorships_additive.sql`, made idempotent
   (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, drop-then-add on the FK).
3. Rehearsed on a Neon branch cut from production — the diff there was byte-identical at 265
   lines, so it was a faithful copy — then applied, verified, and applied twice more to prove
   idempotence.
4. Applied to production. The diff went 265 → 220 lines and sponsorship references 7 → 0.

**The 12 destructive statements were left pending on purpose.** They are the drift, and
resolving each needs someone who knows whether the object is wanted:
`faqs` and `notification_preferences` belong to branches in flight; the `status` enum
conversion needs a data-preserving `USING` cast, not a drop-and-recreate; `pets.age` and
`ageCategory` were superseded by `birthDate` and may need backfilling first.

## Settles when

Either every outstanding branch has merged and a single reviewed migration reconciles the
remainder with data preserved, or the repo adopts `prisma migrate` with a migrations
directory so the reconciliation is recorded rather than re-derived each time.

**Until then, treat `npm run db:push` as destructive against production.** The safe loop is
`migrate diff` → read the SQL → apply only what you intended with `prisma db execute`.
`npm run db:push:local` remains safe: it pins localhost.
