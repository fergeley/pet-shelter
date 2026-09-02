-- RBAC + staff member management migration
--
-- Generated with:
--   npx prisma migrate diff --from-schema <previous> --to-schema prisma/schema.prisma --script
-- then extended with the role backfill in STEP 2.
--
-- This project provisions with `prisma db push` and keeps no prisma/migrations
-- directory, so this file lives under prisma/sql/ deliberately: adding a
-- migrations directory would switch the project onto `prisma migrate` and
-- invite a destructive baseline reset on the next `migrate dev`.
--
-- The change is purely additive. Nothing is dropped and no enum value is
-- removed, so existing `users` rows and already-issued session cookies keep
-- working throughout. Legacy roles are folded to their canonical replacement at
-- read time by normalizeRole() in src/lib/security/permissions.ts, which is what
-- makes STEP 2 safe to run whenever convenient rather than atomically with the
-- deploy.
--
-- Run STEP 1 and STEP 2 as SEPARATE transactions. PostgreSQL refuses to use a
-- value added by ALTER TYPE ... ADD VALUE inside the same transaction that
-- added it, so combining them fails with "unsafe use of new value".

-- =============================================================================
-- STEP 1 — schema
-- =============================================================================

-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');

-- AlterEnum
-- On PostgreSQL 11 and earlier these must be split one per migration.
-- Neon runs 15+, so a single batch is fine.
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE 'ANIMAL_MANAGER';
ALTER TYPE "Role" ADD VALUE 'CONTENT_EDITOR';
ALTER TYPE "Role" ADD VALUE 'VOLUNTEER_COORDINATOR';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "inviteTokenExpiresAt" TIMESTAMP(3),
ADD COLUMN     "inviteTokenHash" TEXT,
ADD COLUMN     "invitedBy" TEXT,
ADD COLUMN     "lastLoginAt" TIMESTAMP(3),
ADD COLUMN     "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- =============================================================================
-- STEP 2 — backfill (run only after STEP 1 has committed)
-- =============================================================================
--
-- Optional but recommended: it retires the deprecated values from live data so
-- the aliases can eventually be dropped from the enum. Verify the counts first:
--
--   SELECT role, count(*) FROM users GROUP BY role;

UPDATE "users" SET "role" = 'SUPER_ADMIN'           WHERE "role" = 'ADMIN';
UPDATE "users" SET "role" = 'VOLUNTEER_COORDINATOR' WHERE "role" = 'COORDINATOR';

-- VOLUNTEER -> STAFF is intentionally NOT run automatically. VOLUNTEER folds to
-- STAFF for permission purposes, but the two carried different meaning to the
-- shelter, and rewriting them in place destroys that distinction irreversibly.
-- Review the rows first, then run:
--
--   UPDATE "users" SET "role" = 'STAFF' WHERE "role" = 'VOLUNTEER';

-- =============================================================================
-- STEP 3 — verification
-- =============================================================================
--
--   SELECT role, status, count(*) FROM users GROUP BY role, status;
--
-- Confirm at least one row is (SUPER_ADMIN, ACTIVE) before signing out: the
-- application refuses to demote or suspend the last active Super Admin, but it
-- cannot stop a direct SQL statement from creating that state.
