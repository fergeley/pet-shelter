# CLAIM — activate the sponsor portal's production schema

**Status:** open · opened 2026-09-16 · lane GRAVE

- **session:** `298a4a58-ad5f-4ef7-823a-edaeb8281244`
- **branch:** `worktree-sponsor-portal-production-activation`, cut from `origin/master` at `5b2672a`
- **phase:** 1 — kill conditions registered, production inventory not yet taken
- **paths:** `docs/tasks/TARGET_SPONSOR_PORTAL_PRODUCTION_ACTIVATION.md`, `tasks/open/*`,
  `tasks/decisions/*`, `tasks/lessons/*`. `prisma/sql/` only for a missing object with no
  additive file. Production database: **read-only** until a human yes in the current prompt.

## Phase 0 — frame

```
Problem: The pledge → reconcile → receipt → portal chain, and since #39 and 5b2672a also public pet
         checkout and adoption applications, read and write production objects whose presence was
         last measured on 2026-09-09, by a brief that predates three changes to that inventory.
Claim:   Measure production read-only; map each missing object to an existing additive file;
         rehearse on a target whose fidelity is itself tested (K3); halt before any production write.
frame-confidence: high — docs/tasks/TARGET_SPONSOR_PORTAL_PRODUCTION_ACTIVATION.md, steps 1–4
```

## Phase 1 — assumption stack

```
A1 [UNKNOWN]  Which of sponsors, pet_sponsorships.displayOnWall + userId FK, donations,
              receipt_sequences, audit_logs, and #39's nine adoption_applications columns exist on
              production — invalidates if: a column live code writes on every request is missing,
              which makes this an incident rather than a rollout (K1).
A2 [ASSERTED] The database `.env.local` names is the one Vercel production serves — invalidates if:
              the inventory, rehearsal and apply all describe a database no visitor touches.
              Cheap check: none from here (no production URL in the repo, no Vercel CLI, and
              "the site loads" is not evidence — the app falls back to fixtures). Goes to the human.
A3 [UNKNOWN]  A local PostgreSQL built from production's introspected DDL is a faithful rehearsal
              target — invalidates if: the rehearsal proves something about a different schema (K3).
A4 [ASSERTED] Every statement in the apply list is additive, idempotent, and all-or-nothing —
              cheap check: sqlSafety classifier over each file, double apply on the rehearsal (K2, K4, K5).
A5 [ASSERTED] Existing production rows satisfy each statement's data preconditions — chiefly the
              pet_sponsorships.userId FK, now that 5b2672a lets real pledges reach that table.
              A schema-only rehearsal cannot see rows. Degrades rather than invalidates: every file
              is one transaction, so a failed precondition aborts the apply whole.
```

Not on the stack, because Prisma's diff cannot see it and it changes no request path:
`prisma/sql/donation_append_only.sql`'s trigger. Recorded as an inventory gap, not measured here.

## Kill conditions — registered 2026-09-16, before step 1 ran. Immutable.

**K1 — an incident, not a rollout.** Step 1 shows missing any object that live `origin/master` code
touches on a public or staff request: `donations` or `receipt_sequences` (`/donate`),
`pet_sponsorships.displayOnWall` (every public pet checkout since 5b2672a), or any of the nine
`adoption_applications` columns from `2026-09-08_adoption_application_milestones_additive.sql`
(application form, tracking and review since #39). → Say "entering incident mode" and tell the
human in the same turn as the measurement. Nothing touches production. The local rehearsal may
continue only as the evidence the forward-fix option needs.

**K2 — not additive.** Any statement of a file on the apply list, comments stripped, matches
`isDestructiveStatement` in `scripts/lib/sqlSafety.ts`, or contains `DROP`, `DELETE`, `UPDATE`,
`TRUNCATE`, or `ALTER … TYPE`. → Stop. The list is not this task.

**K3 — the rehearsal is not faithful.** `db:check-drift` against the rehearsal target, before any
apply, differs from step 1's raw output anywhere other than the `Target:` line. → Nothing the
rehearsal shows is evidence about production.

**K4 — a file is not what it claims.** After applying the list on the rehearsal target: the
destructive list changed by any byte; or a statement that an applied file creates is still in the
additive list; or a second apply changes the drift output at all. → Stop. No production question.

**K5 — not all-or-nothing.** Any file on the list is not enclosed in a single `BEGIN; … COMMIT;`,
so a failed statement on production could leave a partial apply. → Stop.

**K6 — wrong target.** Any rehearsal-phase command prints a `Target:` that is not `localhost`, or
reports `(remote)`. → Stop at once and report it as a possible production write.

---

## Phase 2 — evidence (appended 2026-09-16; nothing above this line was edited)

### Step 1 — `npm run db:check-drift` from the main checkout, read-only. Raw, exit 1

The main checkout was on `feat/pet-form-birth-date`, so its schema was checked rather than assumed:
`sha256sum` of `prisma/schema.prisma`, `scripts/check-drift.ts` and `scripts/lib/sqlSafety.ts` is
identical there and at `origin/master` 5b2672a (`a424c75f…`, `a3d57686…`, `7cf98bd1…`).

    ◇ injected env (8) from .env.local
    ◇ injected env (0) from .env
    Target: postgresql://neondb_owner:***@ep-broad-band-b36iq50r-pooler.c-4.ap-southeast-1.aws.neon.tech/neondb?channel_binding=require&sslmode=require (remote)
    ========================================================================
    Drift: live database  vs  prisma/schema.prisma
    ========================================================================

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

(The script's explanatory prose lines are omitted here; every SQL line is verbatim.)

**Inventory, by absence.** Prisma emits one `ALTER TABLE` per table for column changes and separate
statements for tables, indexes and foreign keys. So a missing object would appear as its own
`CREATE TABLE` / `CREATE [UNIQUE] INDEX` / `ADD CONSTRAINT`, or as a clause of its table's single
`ALTER TABLE`. The only `adoption_applications` ALTER is printed whole (124 characters, under the
160 truncation) and holds nothing but the `status` conversion. Both truncated statements belong to
`pets` and `shelter_settings`, outside this inventory.

| Object | Production (`ep-broad-band-b36iq50r`) |
|---|---|
| `sponsors` + `sponsors_email_key`, `sponsors_displayOnWall_idx` | present |
| `pet_sponsorships` + `displayOnWall`, `userId` index, `pet_sponsorships_userId_fkey` | present |
| `donations` + its four indexes, `receipt_sequences` | present |
| `audit_logs` | present |
| #39's nine `adoption_applications` columns + `adoption_applications_referenceCode_key` | present |
| `donations_no_mutation` trigger (`donation_append_only.sql`) | **not measurable by this diff** |

**Apply list: empty.** Byte-identical to the 2026-09-09 measurement in
`production-schema-has-drifted-ahead-of-master.md`, which already showed these objects present two
days before the brief was written.

### Step 5 — GET-only against the live site

GitHub records the production deployment of `5b2672a` at 2026-09-14T16:51:07Z. Its deployment URL
is behind Vercel SSO (302 to `vercel.com/sso-api`); the repository's homepage URL
`https://pet-shelter-phi.vercel.app` is public.

    GET /sponsors      -> 200 text/html; charset=utf-8 bytes=53294
    GET /sponsor/login -> 200 text/html; charset=utf-8 bytes=52999
    /sponsors headers:  Cache-Control: private, no-cache, no-store, max-age=0, must-revalidate
                        X-Vercel-Cache: MISS
    "Nurul Aisyah" / "Jason Lim" / "Datin Sofia Rahman" in /sponsors: 0 / 0 / 0
    "No sponsors have opted in to the wall yet" in /sponsors: 2
    digest / __next_error__ / NEXT_HTTP_ERROR in /sponsors: 0 / 0 / 0

    npx vitest run --project unit tests/unit/sponsorAccess.test.ts -t "groups opted-in sponsors"
    Tests  1 passed | 21 skipped (22)

## Kill condition verdicts

- **K1 — did not fire.** Every object it names is present (table above).
- **K2–K6 — n/a.** Their antecedent is a non-empty apply list or a rehearsal. The list is empty,
  so nothing was classified for apply, rehearsed, or double-applied.

---

## Build Gate — sponsor portal production activation  ·  lane: GRAVE  ·  branch: worktree-sponsor-portal-production-activation

The "build" is the ledger close and the brief revision. No product code, no SQL, and no production write.

### Phase 0 — frame
- [x] `Problem:` see Phase 0 above.
- [x] `Claim:` see Phase 0 above. Outcome: measurement made the apply list empty.
- [x] `frame-confidence:` high — the brief's steps 1–4.

### Phase 1 — stack + fences
- [x] Stack above, 5 entries.
- [x] Memory searched first: `production-schema-has-drifted-ahead-of-master.md` (its 2026-09-09
      re-measure), `sponsor-portal-is-inert-until-reconciliation-is-reachable.md`, the 2026-09-14
      decisions, and the 2026-09-11 and 2026-09-14 lessons.
- [x] Fence sweep: `n/a — nothing removed`. The `.claude/settings.json` deny on
      `npx prisma db execute*` / `npx prisma migrate*` was found and **respected, not routed
      around**. See `tasks/decisions/2026-09-05-first-party-permissions-replace-the-hand-rolled-fence.md`.

### Phase 2 — falsification
- [x] A1 is now MEASURED — step 1 raw output above.
- [x] **Raw evidence for the highest non-MEASURED entry, A2** (that production uses the database
      `.env.local` names). Step 5 output above.
      **Would have shown instead, if false:** a Vercel production with no `DATABASE_URL` renders
      the three demo names (the unit test above proves the offline wall carries them). A database
      without `sponsors` throws out of `prisma.sponsor.findMany`: no catch, no `loading.tsx`, no
      `error.tsx` on the route, so a 500 rather than a streamed 200.
      **What it does not show:** that Vercel's database *is* `ep-broad-band-b36iq50r`. It shows
      that Vercel's database has a readable `sponsors` table. `donations`, `receipt_sequences`
      and the #39 columns on *that* database remain inferred.
- [x] A3, A4, A5 — n/a: no apply list, no rehearsal, no statement against rows.
- [x] Kill conditions registered in commit `3c14176` (2026-09-16T19:43:28+08:00), before step 1
      ran. Not edited. K1 did not fire; K2–K6 n/a.
- [x] **Failure Truth** — this task writes nothing to production. If the inventory were wrong for
      Vercel's database, the first coordinator confirmation would fail and roll back whole (one
      `$transaction`), with no partial receipt.
- [x] **Reversibility** — branch commits of ledger and docs only. `git revert`.

### Hygiene
- [ ] **No ride-alongs** — declined as stated. The same `/sponsors` observation meets the settle
      condition of `neon-certificate-chain-not-observed.md`, and that entry is moved to
      `decisions/` in its own commit so it can be reverted alone.
- [x] **Ledger** — decision entry, two open-entry updates, one new open entry, one lesson; this
      gate appended here.

**Not verified:** A2 — that Vercel production's `DATABASE_URL` names `ep-broad-band-b36iq50r`
(only that its database has `sponsors`). Whether `donations_no_mutation` exists on production.
That `pet-shelter-phi.vercel.app` serves the latest Production deployment rather than an older
alias. The end-to-end chain (step 6) — nothing this session observed issued a receipt through
reconciliation on production.
