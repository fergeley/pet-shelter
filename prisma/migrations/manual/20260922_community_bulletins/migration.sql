-- Community bulletins: three enums, the `bulletins` table, two indexes.
--
-- Applied with `npm run db:migrate:bulletins`, which runs this file and then
-- upserts src/data/bulletins.json. Written by hand rather than applied with
-- `prisma db push` for the reason 20260903_faq_knowledge_base/migration.sql
-- gives, and for one more that is specific to today:
--
--   `npm run db:push` against this database is CURRENTLY DESTRUCTIVE and
--   unrelated to this change. tasks/open/production-schema-has-drifted-ahead-of-master.md
--   records three destructive statements standing between master's schema and the
--   production branch — the `ApplicationStatus` conversion and the
--   `pets.age` -> `birthDate` migration, both of which lose data. A whole-schema
--   reconciliation run to add bulletins would execute those too. Run
--   `npm run db:check-drift` to see the current gap before touching any of this.
--
-- This file is PURELY ADDITIVE. It creates objects that do not exist on the
-- production branch and alters nothing that does, so it cannot participate in
-- that drift either way.
--
-- Safe to re-run, and safe to run while another worktree applies its own
-- migration:
--
--   * The advisory lock serialises concurrent appliers, and takes the SAME key
--     as the other hand-written migrations in this directory so they queue
--     instead of racing. (Prisma Migrate uses its own key, 72707369.)
--   * Each enum is created optimistically and the duplicate is swallowed. An
--     `IF NOT EXISTS (SELECT FROM pg_type)` pre-check is NOT race-safe: two
--     sessions can both pass the check and the loser then errors.
--   * BEGIN/COMMIT live in this file so it behaves the same whether it is run
--     by the script above or by `prisma db execute --file`.
--
-- There are no DROPs. Unlike the FAQ migration, no earlier revision of this
-- branch ever created a `bulletins` table: before this change bulletins lived
-- only in each visitor's localStorage, so there is nothing in any database to
-- reconcile or lose.
--
-- To undo (there is no Prisma down path; this is the counterpart to run by hand):
--
--   BEGIN;
--   SELECT pg_advisory_xact_lock(4210771001);
--   DROP TABLE IF EXISTS "bulletins";
--   DROP TYPE IF EXISTS "BulletinCategory";
--   DROP TYPE IF EXISTS "BulletinTargetPage";
--   DROP TYPE IF EXISTS "BulletinMediaType";
--   COMMIT;
--
-- That discards every staff-authored notice. It is the right move only while the
-- table still holds nothing but the seeded fixture.

BEGIN;

-- Serialise against other hand-written migrations. Held until COMMIT.
SELECT pg_advisory_xact_lock(4210771001);

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "BulletinCategory" AS ENUM (
    'announcement', 'urgent_need', 'event', 'happy_tail', 'clinic'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "BulletinTargetPage" AS ENUM (
    'all', 'home', 'pets', 'bulletins'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

DO $$
BEGIN
  CREATE TYPE "BulletinMediaType" AS ENUM (
    'none', 'image', 'video'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "bulletins" (
    "id" TEXT NOT NULL,
    "category" "BulletinCategory" NOT NULL,
    "targetPage" "BulletinTargetPage" NOT NULL DEFAULT 'all',
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "titleMs" TEXT,
    "contentMs" TEXT,
    "mediaType" "BulletinMediaType" NOT NULL DEFAULT 'none',
    "mediaUrl" TEXT,
    "videoEmbedUrl" TEXT,
    "isPinned" BOOLEAN NOT NULL DEFAULT false,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "authorName" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bulletins_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "bulletins_isPublished_targetPage_isPinned_publishedAt_idx"
  ON "bulletins"("isPublished", "targetPage", "isPinned", "publishedAt");

CREATE INDEX IF NOT EXISTS "bulletins_publishedAt_idx"
  ON "bulletins"("publishedAt");

COMMIT;
