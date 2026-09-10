# Schema changes ship as additive SQL here, never as `db push`

**Learned:** 2026-09-03

**What happened:** the sponsor portal was ready to merge with two schema changes (a
`sponsors` table, a `displayOnWall` column) and no migration. The repo has no migration
history, and `npm run db:push` resolves its target from `.env.local`, which holds
`NEON_BRANCH=production`, with no local-only guard — unlike `db:seed`, which has one.

A read-only `prisma migrate diff` against production returned 265 lines, **12 of them
destructive**: `DROP TABLE faqs`, `DROP COLUMN "status"` on both `pets` and
`adoption_applications`, and the four `shelter_settings` QR columns. Those belong to other
branches' drift, not to this feature. `db push` would have taken them all — and a
`DROP COLUMN status` followed by `ADD COLUMN ... DEFAULT 'Available'` does not migrate
values, it resets them. Every adopted animal becomes Available.

Had the branch merged without a migration, the outcome is quieter but still bad: production
has no `sponsors` table, the repository declares the database authoritative rather than
falling back, and `/sponsors` and `/sponsor/login` return 500s.

**How to apply:** any branch here that touches `prisma/schema.prisma` ships a hand-written
additive file in `prisma/sql/`, idempotent (`IF NOT EXISTS`, a `pg_constraint` guard for
foreign keys), applied with `psql -f`. Follow
`prisma/sql/2026-09-03_pet_sponsorships_additive.sql`. Never run `db push` against anything
resolved from `.env.local`. Background:
`tasks/open/production-schema-has-drifted-ahead-of-master.md`.

---
