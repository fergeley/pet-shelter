-- Donor notification preferences: the `notification_preferences` table and its
-- unique index on email.
--
-- Written by hand rather than applied with `prisma db push` on purpose: `db push`
-- reconciles the WHOLE schema and drops anything the database has that
-- prisma/schema.prisma does not. Other branches are adding tables and columns to
-- the same database concurrently, so a whole-schema reconciliation would destroy
-- their work. Run `npm run db:check-drift` to see the current gap first.
--
-- Apply with:
--
--   npx prisma db execute --file prisma/migrations/manual/20260903_notification_preferences/migration.sql
--
-- Run it from a checkout whose `.env.local` names the database you mean: Prisma
-- 7's `db execute` has no `--url` flag and reads the datasource from
-- prisma.config.ts.
--
-- Safe to re-run, and safe to run while another worktree applies its own
-- migration:
--
--   * The advisory lock uses the SAME key as the other hand-written migrations
--     in this directory, so concurrent appliers queue instead of racing.
--   * Everything is additive and guarded. There are no DROPs: this table holds
--     donors' own statements about what they consent to receive, and losing a
--     row silently re-subscribes somebody who asked us to stop.
--   * BEGIN/COMMIT live in this file so it behaves the same whether it is run by
--     a script or by `prisma db execute --file`.
--
-- Until this runs the application still works — `DATABASE_URL` unset means the
-- in-memory store is authoritative by design — but nothing survives a restart,
-- and an unsubscribe would be forgotten and that donor mailed again.

BEGIN;

-- Serialise against other hand-written migrations. Held until COMMIT.
SELECT pg_advisory_xact_lock(4210771001);

-- CreateTable
CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id"                TEXT NOT NULL,
  "email"             TEXT NOT NULL,
  "photoUpdates"      BOOLEAN NOT NULL DEFAULT true,
  "newsletter"        BOOLEAN NOT NULL DEFAULT true,
  "unsubscribedAllAt" TIMESTAMP(3),
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
--
-- A missing row means "has never expressed a choice", which reads as opted in.
-- This index is what makes the address the identity.
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_email_key"
  ON "notification_preferences" ("email");

COMMIT;
