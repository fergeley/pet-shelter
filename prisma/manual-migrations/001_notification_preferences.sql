-- Donor notification preferences.
--
-- RUN THIS INSTEAD OF `prisma db push`.
--
-- Live Postgres has drifted ahead of schema.prisma, and `db push` reconciles by
-- DROPPING whatever the schema file does not declare — it would destroy
-- production data. This script is purely additive, guarded, and safe to re-run.
--
--   npx prisma db execute --file prisma/manual-migrations/001_notification_preferences.sql
--
-- (Run from a checkout whose `.env.local` names the database you mean: Prisma 7's
-- `db execute` has no `--url` flag and reads the datasource from prisma.config.ts.)
--
-- Until this runs the application still works — `DATABASE_URL` unset means the
-- in-memory store is authoritative by design — but nothing survives a restart,
-- and an unsubscribe would be forgotten and that donor mailed again.

BEGIN;

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

-- A missing row means "has never expressed a choice", which reads as opted in.
-- The unique index is what makes an address the identity.
CREATE UNIQUE INDEX IF NOT EXISTS "notification_preferences_email_key"
  ON "notification_preferences" ("email");

COMMIT;
