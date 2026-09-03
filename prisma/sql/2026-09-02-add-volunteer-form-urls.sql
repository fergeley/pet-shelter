-- Adds the two volunteer Google Form columns to shelter_settings.
--
-- Already applied to production; this file is the record of what was run, cited
-- by the `volunteerFormUrl` comment in prisma/schema.prisma. Verified present on
-- 2026-09-04: both columns exist on `shelter_settings` as TEXT NOT NULL.
--
-- Do NOT use `prisma db push` for this. Production Neon has drifted ahead of
-- prisma/schema.prisma, and `db push` reconciles the database *to* the schema
-- file, so it would drop whatever the file does not declare — including columns
-- and tables belonging to branches that have not landed. DATABASE_URL points at
-- NEON_BRANCH=production, so there is no staging buffer. Run
-- `npm run db:check-drift` to see the current gap first.
--
-- Run instead, FROM THE MAIN CHECKOUT (C:\Users\User\pet-shelter):
--   npx prisma db execute --file prisma/sql/2026-09-02-add-volunteer-form-urls.sql
--
-- Two things that will bite otherwise:
--   * prisma.config.ts loads .env.local relative to the CURRENT DIRECTORY, and
--     .env.local is gitignored so it exists only in the main checkout. Run this
--     from anywhere else and DATABASE_URL is unset, Prisma falls back to
--     localhost:5432, and you get "P1001 Can't reach database server" — which
--     names the wrong problem entirely. The `injected env (0)` line above the
--     error is the actual diagnosis.
--   * Prisma 7 removed --schema from `db execute`; the datasource comes from
--     prisma.config.ts. Passing it errors. There is no --url flag either.
--
-- Safe to re-run: both statements are IF NOT EXISTS. On PostgreSQL 11+ adding a
-- NOT NULL column with a constant DEFAULT is a catalog-only change — no table
-- rewrite and no long row lock.
--
-- Column names are quoted because no field in schema.prisma carries @map, so
-- Prisma expects the camelCase identifiers verbatim.

ALTER TABLE "shelter_settings"
  ADD COLUMN IF NOT EXISTS "volunteerFormUrl" TEXT NOT NULL
  DEFAULT 'https://docs.google.com/forms/d/e/REPLACE_WITH_YOUR_FORM_ID/viewform';

ALTER TABLE "shelter_settings"
  ADD COLUMN IF NOT EXISTS "volunteerFormResponsesUrl" TEXT NOT NULL
  DEFAULT 'https://docs.google.com/spreadsheets/d/REPLACE_WITH_YOUR_SHEET_ID/edit';
