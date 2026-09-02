-- RBAC + staff member management — STEP 1 of 2: schema
--
-- Run with, from the repository root (NOT a worktree — see below):
--   npx prisma db execute --file prisma/sql/2026-09-02_rbac_members_step1_schema.sql
--
-- Then, as a SEPARATE command:
--   npx prisma db execute --file prisma/sql/2026-09-02_rbac_members_step2_backfill.sql
--
-- ## Do not use `prisma db push` for this
--
-- `db push` reconciles the database *to* schema.prisma, and production has
-- drifted ahead of it: there are columns and whole populated tables live that
-- this schema does not declare. A push would DROP them. Additive SQL applied by
-- hand is the only safe route until that drift is reconciled.
--
-- ## Why two steps
--
-- PostgreSQL refuses to use a value added by `ALTER TYPE ... ADD VALUE` in the
-- same transaction that added it ("unsafe use of new value"). STEP 1 adds the
-- enum values; STEP 2 is the first thing allowed to write them.
--
-- ## Idempotent
--
-- Every statement is guarded, so re-running this is a no-op rather than an
-- error. That matters because the failure mode being guarded against is a
-- half-applied migration that nobody is sure how to resume.
--
-- ## Scope
--
-- This covers the RBAC delta only — the Role enum and the staff-member columns
-- on `users`. Any other difference between schema.prisma and the live database
-- is separate and is not addressed here.

-- ---------------------------------------------------------------------------
-- 1. The account-status enum
-- ---------------------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'UserStatus') THEN
    CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INVITED', 'SUSPENDED');
  END IF;
END
$$;

-- ---------------------------------------------------------------------------
-- 2. The four new roles
--
-- Purely additive. ADMIN, COORDINATOR and VOLUNTEER stay in the enum: Postgres
-- cannot drop a value that rows still reference, and live session cookies carry
-- them. permissionsForRole() in src/lib/security/permissions.ts resolves the
-- deprecated names, so nothing is locked out mid-deploy.
-- ---------------------------------------------------------------------------
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'ANIMAL_MANAGER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'CONTENT_EDITOR';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'VOLUNTEER_COORDINATOR';

-- ---------------------------------------------------------------------------
-- 3. The staff-member columns
--
-- All nullable except `status`, which carries a constant default — so this is a
-- catalog-only change in Postgres 11+: no table rewrite and no row lock.
-- ---------------------------------------------------------------------------
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "invitedBy" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteTokenHash" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "inviteTokenExpiresAt" TIMESTAMP(3);

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "users_status_idx" ON "users"("status");
CREATE INDEX IF NOT EXISTS "users_role_idx" ON "users"("role");
