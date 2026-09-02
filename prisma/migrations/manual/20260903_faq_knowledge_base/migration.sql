-- FAQ knowledge base: the `FaqCategory` enum, the `faqs` table, two indexes.
--
-- Applied with `npm run db:migrate:faqs`, which runs this file and then upserts
-- src/data/faqs.json. Written by hand rather than applied with `prisma db push`
-- on purpose: `db push` reconciles the WHOLE schema and drops anything the
-- database has that prisma/schema.prisma does not. Other branches are adding
-- tables and columns to the same database concurrently, so a whole-schema
-- reconciliation would destroy their work. Run `npm run db:check-drift` to see
-- the current gap before touching any of this.
--
-- Safe to re-run, and safe to run while another worktree applies its own
-- migration:
--
--   * The advisory lock serialises concurrent appliers. Any session applying
--     hand-written DDL to this database should take the SAME key so they queue
--     instead of racing. (Prisma Migrate uses its own key, 72707369.)
--   * The enum is created optimistically and the duplicate is swallowed. An
--     `IF NOT EXISTS (SELECT FROM pg_type)` pre-check is NOT race-safe: two
--     sessions can both pass the check and the loser then errors.
--   * BEGIN/COMMIT live in this file so it behaves the same whether it is run
--     by the script above or by `prisma db execute --file`.
--
-- The DROPs below are deliberate and narrow. An earlier revision of this branch
-- created `faqs` with a four-value SCREAMING_CASE enum before the vocabulary was
-- unified with src/types/faq.ts. Postgres cannot rewrite an enum's members in
-- place, and the only rows that table has ever held are seed content from this
-- same unmerged branch, so the type is recreated rather than migrated. If the
-- table already carries staff-authored FAQs, STOP: export them first, because
-- this will delete them.

BEGIN;

-- Serialise against other hand-written migrations. Held until COMMIT.
SELECT pg_advisory_xact_lock(4210771001);

DROP TABLE IF EXISTS "faqs";
DROP TYPE IF EXISTS "FaqCategory";

-- CreateEnum
DO $$
BEGIN
  CREATE TYPE "FaqCategory" AS ENUM (
    'tnrm', 'sponsorship', 'adoption', 'visiting', 'get_involved', 'general', 'medical'
  );
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
