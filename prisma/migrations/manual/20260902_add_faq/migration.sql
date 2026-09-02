-- Adds the FAQ knowledge base: one enum, one table, two indexes.
--
-- Written by hand rather than applied with `prisma db push` on purpose.
-- `db push` reconciles the WHOLE schema against the database and will alter or
-- drop anything the live database has that prisma/schema.prisma does not. The
-- live schema has drifted ahead of this repo (rehab columns, QR columns,
-- medical_timeline_events, pet_updates), and the only configured DATABASE_URL
-- points at the Neon production branch, so a whole-schema reconciliation is the
-- wrong tool here. This script only creates new objects and touches nothing
-- that already exists. Run `npm run db:check-drift` to see the current gap.
--
-- Safe to re-run, and safe to run while another worktree is applying its own
-- migration:
--
--   * The advisory lock serialises concurrent appliers. Any session applying
--     hand-written DDL to this database should take the SAME key, so they queue
--     instead of racing. (Prisma Migrate uses its own key, 72707369.)
--   * The enum is created optimistically and the duplicate is swallowed. A
--     `IF NOT EXISTS (SELECT FROM pg_type)` pre-check is NOT race-safe: two
--     sessions can both pass the check and the loser then errors.
--   * BEGIN/COMMIT live in this file so it behaves the same whether it is run
--     by scripts/apply-faq-migration.mjs or by `prisma db execute --file`.

BEGIN;

-- Serialise against other hand-written migrations. Held until COMMIT.
SELECT pg_advisory_xact_lock(4210771001);

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "FaqCategory" AS ENUM ('ADOPTION', 'VOLUNTEERING', 'ANIMAL_CARE', 'SHELTER_INFO');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "faqs" (
    "id" TEXT NOT NULL,
    "category" "FaqCategory" NOT NULL,
    "question" TEXT NOT NULL,
    "answer" TEXT NOT NULL,
    "questionMs" TEXT,
    "answerMs" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "faqs_isPublished_category_displayOrder_idx"
  ON "faqs"("isPublished", "category", "displayOrder");

CREATE INDEX IF NOT EXISTS "faqs_category_displayOrder_idx"
  ON "faqs"("category", "displayOrder");

COMMIT;
