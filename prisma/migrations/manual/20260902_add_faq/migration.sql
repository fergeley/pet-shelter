-- Adds the FAQ knowledge base: one enum, one table, two indexes.
--
-- Written by hand rather than applied with `prisma db push` on purpose.
-- `db push` reconciles the WHOLE schema against the database and will alter or
-- drop anything the live database has that prisma/schema.prisma does not. The
-- live schema has not been inspected, and the only configured DATABASE_URL
-- points at the Neon production branch, so a whole-schema reconciliation is the
-- wrong tool here. This script only creates new objects and touches nothing
-- that already exists.
--
-- Every statement is idempotent, so re-running it is safe.

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FaqCategory') THEN
    CREATE TYPE "FaqCategory" AS ENUM ('ADOPTION', 'VOLUNTEERING', 'ANIMAL_CARE', 'SHELTER_INFO');
  END IF;
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
