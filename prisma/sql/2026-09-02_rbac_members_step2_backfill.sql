-- RBAC + staff member management — STEP 2 of 2: role backfill
--
-- Run only after STEP 1 has committed:
--   npx prisma db execute --file prisma/sql/2026-09-02_rbac_members_step2_backfill.sql
--
-- ## DO NOT RUN THIS BEFORE THE NEW CODE IS DEPLOYED
--
-- This rewrites live `users.role` values to names the *previous* release does
-- not know. Before this branch, ROLES is `ADMIN | COORDINATOR | STAFF |
-- VOLUNTEER` and the admin gate is a literal
-- `session.role === ROLES.ADMIN || session.role === ROLES.COORDINATOR`.
-- Rewrite an administrator to SUPER_ADMIN while that code is serving and they
-- can still sign in — loginAction does not gate on role — but every admin route
-- and action then denies the session. That is a lockout, and it is the exact
-- failure the additive enum exists to avoid.
--
-- Order: STEP 1 (safe against the old code: purely additive columns it never
-- reads) → deploy this branch → then STEP 2.
--
-- Optional even then. The new code resolves the deprecated names forever via
-- permissionsForRole(); this only retires them from live data so the aliases
-- can eventually be dropped from the enum. Idempotent — re-running matches
-- nothing.
--
-- Look before you run:
--   SELECT role, status, count(*) FROM users GROUP BY role, status ORDER BY role;
-- (`npm run db:studio` is the easiest way to read that back.)

UPDATE "users" SET "role" = 'SUPER_ADMIN'           WHERE "role" = 'ADMIN';
UPDATE "users" SET "role" = 'VOLUNTEER_COORDINATOR' WHERE "role" = 'COORDINATOR';

-- VOLUNTEER is deliberately NOT rewritten.
--
-- It is not merely a rename: a VOLUNTEER holds *no* permissions under the new
-- matrix, while STAFF can read adoption applications — which carry applicant
-- PII. Folding them together would grant every volunteer that access, which is
-- the exact regression this branch's tests now guard against. If some of those
-- rows really are staff, promote them individually:
--
--   UPDATE "users" SET "role" = 'STAFF' WHERE "email" = '...';

-- ---------------------------------------------------------------------------
-- Verify before you sign out
-- ---------------------------------------------------------------------------
--   SELECT role, status, count(*) FROM users GROUP BY role, status ORDER BY role;
--
-- Confirm at least one row is (SUPER_ADMIN, ACTIVE). The application refuses to
-- demote or suspend the last active Super Admin, but it cannot stop a direct
-- SQL statement from leaving you with none — and nobody could then reach
-- /admin/members to fix it.
