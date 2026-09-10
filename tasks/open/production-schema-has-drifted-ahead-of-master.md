# Production Postgres carries objects master does not declare, and `db push` would drop them

**Status:** open, re-measured 2026-09-09 · measured against the production branch, not inferred

> **12 destructive statements → 3.** The 2026-09-03 list is superseded. `faqs`,
> `FaqCategory` and `notification_preferences` are no longer proposed for
> dropping, because `origin/master` now declares all three — the branches that
> held them merged. `pets.customQrUrl` and the four `shelter_settings` QR
> columns had already come off the list on 2026-09-03.
>
> What remains is the half this note always said needed a human: the
> `ApplicationStatus` conversion and the `pets.age` → `birthDate` migration.
> Both still destroy data. **`db push` remains unguarded and still destructive.**

`npm run db:push` resolves through `prisma.config.ts` → `resolveDatabaseUrl()` → `.env.local`,
which holds `NEON_BRANCH=production`. Unlike the seed, **push has no local-only guard**:
`prisma/env.ts` protects `db:seed` with `assertSeedTargetIsLocal`, and nothing protects push.

## Measured 2026-09-09

`npm run db:check-drift`, run from the main checkout against the production Neon branch
(`ep-broad-band-b36iq50r-pooler...neon.tech`, reported `(remote)`). Read-only.

**3 destructive statements.** Two of them lose data; the third does not, and the difference
matters when someone reads the headline count:

    ALTER TABLE "adoption_applications"
      DROP COLUMN "status", ADD COLUMN "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED'

    ALTER TABLE "pets"
      DROP COLUMN "age", DROP COLUMN "ageCategory",
      ADD COLUMN "birthDate" TEXT NOT NULL DEFAULT '2024-01-01',
      ADD COLUMN "birthDateIsEstimate" BOO…          ← truncated, see below

    ALTER TABLE "notification_preferences" ALTER COLUMN "updatedAt" DROP DEFAULT

- **The application one resets every decision.** A `DROP COLUMN` followed by `ADD COLUMN ...
  DEFAULT 'SUBMITTED'` does not migrate values. Every `APPROVED` and `REJECTED` application
  becomes `SUBMITTED`. It needs a data-preserving `USING` cast, not a drop-and-recreate.
- **The pets one loses ages and invents birthdays.** `age` and `ageCategory` are dropped, and
  every existing row gets `birthDate = '2024-01-01'` — not null, not unknown, but a specific
  wrong date that the UI will render as a real age. Backfill has to come first. Related:
  `tasks/open/pet-form-has-no-birth-date-field.md`.
- **The `DROP DEFAULT` destroys nothing.** `scripts/lib/sqlSafety` classifies it as destructive
  because it is an `ALTER ... DROP`, which is the right default for a classifier to take. It
  removes a column default, not rows. Counting it alongside the other two overstates the danger
  by a third.

**6 additive statements**, safe to apply: `CREATE TYPE "PetStatus"`, `CREATE TYPE
"ApplicationStatus"`, new `shelter_settings` columns (`cloudinaryCloudName`, `emailFrom`, …),
and three indexes — `adoption_applications_petId_status_idx`,
`pets_species_status_isArchived_idx`, `pets_isArchived_status_idx`.

Both enum *types* being additive means production does not have them yet; it is the *column*
conversions above that are destructive.

### What this measurement does not establish

`scripts/check-drift.ts:73,88` prints `s.replace(/\s+/g, " ").slice(0, 160)`, so the `pets` and
`shelter_settings` statements above are **truncated at 160 characters**. In particular, whether
the `pets.status` → `PetStatus` conversion is still inside that first statement is *not* answered
by this run — the 2026-09-03 list had it, and its absence here may be truncation rather than
resolution. Do not read it as resolved.

For the full SQL, run the underlying command rather than the summary:

    npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script

## A worktree cannot take this measurement

Observed 2026-09-09. `.env.local` is gitignored, so it does not exist in a `git worktree`.
`resolveDatabaseUrl()` then falls back to `LOCAL_DATABASE_URL` and the check silently targets
localhost:

    ◇ injected env (0) from .env.local
    Target: postgresql://postgres:***@localhost:5432/pet_shelter?schema=public (local)
    Error: P1001 Can't reach database server at `localhost:5432`      → exit 2

The script is honest — it prints `(local)` — but exit 2 reads as "could not run" rather than
"measured the wrong database", and several sessions work this repo from worktrees.
**Run drift checks from the main checkout.**

## Why the database is ahead of the branch

Both directions have contributed, and the 2026-09-09 re-measure shows the first direction
largely resolving itself as branches land:

- **Objects master had not caught up to.** `faqs`, `FaqCategory`, `notification_preferences`,
  `pets.customQrUrl` and the four `shelter_settings` QR columns existed in production because
  branches that declared them had pushed and not merged. Those branches have now merged, and
  every one of those statements has left the destructive list.
- **Objects master declares that production predates.** The `PetStatus` / `ApplicationStatus`
  enums and `birthDate`. This is the branch being ahead of the database, and it is what remains.

So this is not one team member's mistake to undo. It is the expected end state of a shared
database with no migration history, several concurrent branches, and a push command that takes
its target from whatever `.env.local` happens to contain.

## What was done on 2026-09-03, and what was deliberately not

The sponsorship feature needed three additive objects. Rather than push:

1. `prisma migrate diff --from-config-datasource --to-schema ... --script` — read-only,
   which is how the drift was found at all.
2. The three sponsorship statements were extracted by hand into
   `prisma/sql/2026-09-03_pet_sponsorships_additive.sql`, made idempotent
   (`ADD COLUMN IF NOT EXISTS`, `CREATE TABLE IF NOT EXISTS`, drop-then-add on the FK).
3. Rehearsed on a Neon branch cut from production — the diff there was byte-identical, so it was
   a faithful copy — then applied, verified, and applied twice more to prove idempotence.
4. Applied to production. The diff went 265 → 220 lines and sponsorship references 7 → 0.

The destructive statements were left pending on purpose, and the two that remain are still
pending for the same reason: each needs someone who knows whether the object is wanted, and the
status conversion needs a `USING` cast rather than a drop-and-recreate.

## Settles when

Either a single reviewed migration reconciles the two remaining conversions with data preserved
(`USING` cast for `ApplicationStatus`, backfill before `pets.birthDate`), or the repo adopts
`prisma migrate` with a migrations directory so the reconciliation is recorded rather than
re-derived each time.

**Until then, treat `npm run db:push` as destructive against production.** The safe loop is
`migrate diff` → read the SQL → apply only what you intended with `prisma db execute`.
`npm run db:push:local` remains safe: it pins localhost.
