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
