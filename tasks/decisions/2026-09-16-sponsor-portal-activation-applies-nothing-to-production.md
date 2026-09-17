# Sponsor portal activation applies nothing to production, because production already has it

**Decided:** 2026-09-16 · branch `worktree-sponsor-portal-production-activation`, cut from
`origin/master` at `5b2672a` · session `298a4a58-ad5f-4ef7-823a-edaeb8281244`

## Context

`docs/tasks/TARGET_SPONSOR_PORTAL_PRODUCTION_ACTIVATION.md` (written 2026-09-11) planned to apply
`2026-09-03_sponsor_accounts_additive.sql` and `2026-09-04_donations_ledger_additive.sql` to the
Neon production branch, rehearsed first, behind a human yes. Its "Recorded state" column quoted
ledger entries from 2026-09-03 and 2026-09-04, which said `sponsors` was not applied and
`donations` had never been observed.

The human's prompt for this run added three facts the brief predated: #39's
`2026-09-08_adoption_application_milestones_additive.sql`, 5b2672a routing public pet checkout into
`pet_sponsorships`, and the 2026-09-14 lesson that a database tier can be stood up locally without
Docker.

## Decision

**Apply nothing.** No production write was proposed, so no human yes was asked for or given.

## Why

The read-only inventory (`npm run db:check-drift`, run from the main checkout at
`ep-broad-band-b36iq50r`) proposes **no** statement for any object on the brief's list, nor for
#39's nine columns and unique index. It proposes 3 destructive and 6 additive statements, all
unrelated to this task. They are the same counts and statements as the 2026-09-09 record, which is
reformatted rather than raw and does not name the branch it ran on, so it cannot be compared byte
for byte. The main checkout's working copies of `prisma/schema.prisma`, `scripts/check-drift.ts`
and `scripts/lib/sqlSafety.ts` hash identically to this worktree's, cut from `origin/master`, so
the diff was taken against master's schema. Raw, exit 1, explanatory prose lines omitted:

    Target: postgresql://neondb_owner:***@ep-broad-band-b36iq50r-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require (remote)
    !! 3 DESTRUCTIVE statement(s). `prisma db push` WOULD DESTROY DATA:
       ALTER TABLE "adoption_applications" DROP COLUMN "status", ADD COLUMN "status" "ApplicationStatus" NOT NULL DEFAULT 'SUBMITTED'
       ALTER TABLE "notification_preferences" ALTER COLUMN "updatedAt" DROP DEFAULT
       ALTER TABLE "pets" DROP COLUMN "age", DROP COLUMN "ageCategory", ADD COLUMN "birthDate" TEXT NOT NULL DEFAULT '2024-01-01', ADD COLUMN "birthDateIsEstimate" BOO
    6 additive statement(s) — things this branch's schema has that the database lacks:
       CREATE TYPE "PetStatus" AS ENUM ('Available', 'Pending', 'Adopted', 'In Rehabilitation')
       CREATE TYPE "ApplicationStatus" AS ENUM ('SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED')
       ALTER TABLE "shelter_settings" ADD COLUMN "cloudinaryCloudName" TEXT, ADD COLUMN "emailFrom" TEXT DEFAULT 'Hope for Strays <onboarding@resend.dev>', ADD COLUMN 
       CREATE INDEX "adoption_applications_petId_status_idx" ON "adoption_applications"("petId", "status")
       CREATE INDEX "pets_species_status_isArchived_idx" ON "pets"("species", "status", "isArchived")
       CREATE INDEX "pets_isArchived_status_idx" ON "pets"("isArchived", "status")

**Absence is presence here.** Every object below is declared in `schema.prisma`, the datasource has
no `relationMode = "prisma"` (so foreign keys are in the diff), and `classifyDiff` routes every
non-destructive statement to the additive list. So a missing object would print as its own
statement, or as a clause of its table's `ALTER TABLE`. Prisma groups column changes into one
`ALTER TABLE` per table, as the multi-clause `pets` and `shelter_settings` statements above show;
that is observed in this output, not tested in the repo. The one `adoption_applications` ALTER
prints whole (126 characters, under the 160-character truncation). The two truncated statements
belong to `pets` and `shelter_settings`. Summary:

| Object | On production |
|---|---|
| `sponsors`, its two indexes | present |
| `pet_sponsorships.displayOnWall`, `userId` index, `pet_sponsorships_userId_fkey` | present |
| `donations`, its four indexes, `receipt_sequences` | present |
| `audit_logs` | present |
| #39's nine `adoption_applications` columns, `adoption_applications_referenceCode_key` | present |

Applying the files anyway would have been a no-op at best, since every statement is guarded by
`IF NOT EXISTS` or, for the foreign key, a `pg_constraint` lookup.
It would still have spent a one-way-door approval to learn nothing.

The live site, asked without credentials, rules out one thing and no more. `GET /sponsors` and
`GET /sponsor/login` on `https://pet-shelter-phi.vercel.app` return 200. `/sponsors` renders at
request time (`X-Vercel-Cache: MISS`, `no-store`) with the empty state "No sponsors have opted in
to the wall yet". The route has no `loading.tsx` or `error.tsx` to turn a thrown query into a
streamed 200, so **production is not reading a database that lacks `sponsors`**, which was the
brief's predicted 500.

**It does not show that production reads a database at all.** A first draft of this entry and of
the claim's Build Gate said it did, because the offline wall carries three demo names
(`tests/unit/sponsorAccess.test.ts`) and production showed none. Independent review found
`src/lib/server/sponsorRepository.ts:41`,
`SEEDING_ENABLED = process.env.NODE_ENV !== "production" && !isLedgerPersistent()`. A production
build with no `DATABASE_URL` seeds no demo sponsors and renders the same empty wall. The unit test
runs under `NODE_ENV=test`, so it vouches for nothing about production. `/admin/donations` does
not discriminate either: `listDonationsOrThrow` falls back to memory when no database is set.

## What the brief got wrong, for the next one written like it

- **Its premise was stale by 36 minutes, and its author could not see that.** The 2026-09-09
  re-measure (`66cf5a4`), which lists no statement for these objects, lived on a side branch until
  #37 merged it to master at 2026-09-10T23:54+08:00. The brief (`0135e83`, 00:30 the next day)
  was written on the #36 branch, which did not contain it (`git merge-base --is-ancestor 66cf5a4
  0135e83` exits 1). It still says "the 12 destructive drift lines", the pre-re-measure count.
- **Its rehearsal and apply commands cannot be run by an agent here.** `.claude/settings.json`
  denies `npx prisma db execute*` and `npx prisma migrate*`, a deny in place since 2026-09-05
  (`2026-09-05-first-party-permissions-replace-the-hand-rolled-fence.md`). An agent prepares,
  measures and verifies; a human types every `prisma db execute`, rehearsal included.
- **Its K2 misfires, and the obvious replacements do too.** Measured over all ten files in
  `prisma/sql/` with `parseStatements` (comments stripped):
  - "Contains a `DROP`" as plain text fires on line 16 of the purely additive milestones file, a comment.
  - `isDestructiveStatement` scores **0 on every file**. It has no pattern for `UPDATE`, `DELETE`
    or `DROP TRIGGER`, so it passes the `UPDATE` backfill and `donation_append_only.sql`.
  - The keyword list this run registered (`DROP`, `DELETE`, `UPDATE`, `TRUNCATE`, `ALTER … TYPE`)
    fires on `2026-09-03_sponsor_accounts_additive.sql` and 9 statements of the clinical file.
    On those two purely additive files, every hit is a foreign key's `ON DELETE` / `ON UPDATE`
    action. It also fires, correctly, on the three files below.
  - What discriminates is the keyword test with referential actions excluded,
    `\b(DROP|TRUNCATE)\b|(?<!\bON\s+)\b(DELETE|UPDATE)\b|\bALTER\b[\s\S]*?\bTYPE\b`. It scores 0 on
    the seven purely additive files and fires on the backfill's `UPDATE`s, the trigger file, and
    `2026-09-02_rbac_members_step1_schema.sql`'s `ALTER TYPE … ADD VALUE`, which needs a human's
    judgement.
- **Its inventory had a blind spot.** Prisma's diff cannot see `donation_append_only.sql`'s
  trigger. Whenever `DATABASE_URL` is set, `/donate` writes a real receipt row, and has done so
  since before 5b2672a (`src/actions/donations.ts` calls `issueDonationReceipt` at `a2f7cf1`).
  5b2672a added coordinator-issued ones. No production receipt row has been observed. Filed as
  `tasks/open/production-receipts-are-not-append-only.md`.

## Not established when written

- **That Vercel production has a `DATABASE_URL`, and that it names `ep-broad-band-b36iq50r`.**
  Every object above is measured on the `.env.local` branch only. No public page found here tells a
  database-backed production from one with none. *Settled later the same day; see below.*
- **The chain end to end.** No receipt was issued through `/admin/donations` on production by
  anything observed here. That is still step 6 of the brief, a separate human decision.
- **That `pet-shelter-phi.vercel.app` serves the newest Production deployment** (`5b2672a`,
  2026-09-14T16:51:07Z per GitHub's deployment record) rather than an older alias.

## Settled after writing, 2026-09-16

**Vercel production reads this database.** The human opened the Vercel project (team
`isaiahs-projects-8abdd4ed`) → Settings → Environment Variables and reported, in chat: `DATABASE_URL`
present, ticked for Production, naming the `ep-broad-band-…` endpoint. So the inventory above is
an inventory of the database live visitors use, and "production" in this entry means that.

Still unreported: the variable's "Updated" date against the running deployment (2026-09-15
00:51 +08), since a change after a deploy is not in it, and whether the URL carries
`sslmode=disable`. Neither changes the decision to apply nothing.

## What would reverse this

Nothing to reverse; nothing was written. If a later drift run proposes any object above, production
has lost it, and the additive files remain the path. A human applies them, per the deny above.
