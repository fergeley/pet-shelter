-- Additive migration: Public Transparency Page & Admin Financial Editor (PR #21)
--
-- Created: 2026-09-04
-- Models: ExpenseItem, FinancialReport, ImpactStat, ExpenseCategory enum
--
-- Every statement below is additive and idempotent: re-running it is a no-op.
--
--     npx prisma db execute --file prisma/sql/2026-09-04_transparency_additive.sql

BEGIN;

-- 1. Create ExpenseCategory enum safely if it does not already exist
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ExpenseCategory') THEN
        CREATE TYPE "ExpenseCategory" AS ENUM (
            'MEDICAL',
            'FOOD_NUTRITION',
            'SHELTER_MAINTENANCE',
            'RESCUE_TNRM',
            'STAFF_CARE'
        );
    END IF;
END $$;

-- 2. Create expense_items table
CREATE TABLE IF NOT EXISTS "expense_items" (
    "id"             TEXT NOT NULL,
    "category"       "ExpenseCategory" NOT NULL,
    "title"          TEXT NOT NULL,
    "amountSen"      INTEGER NOT NULL,
    "date"           TEXT NOT NULL,
    "vendorOrClinic" TEXT,
    "petName"        TEXT,
    "receiptRef"     TEXT,
    "isPublished"    BOOLEAN NOT NULL DEFAULT true,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"      TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "expense_items_isPublished_date_idx"
    ON "expense_items"("isPublished", "date");

CREATE INDEX IF NOT EXISTS "expense_items_category_idx"
    ON "expense_items"("category");

-- 3. Create financial_reports table
CREATE TABLE IF NOT EXISTS "financial_reports" (
    "id"          TEXT NOT NULL,
    "year"        INTEGER NOT NULL,
    "month"       INTEGER,
    "title"       TEXT NOT NULL,
    "fileUrl"     TEXT NOT NULL,
    "summary"     TEXT,
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isPublished" BOOLEAN NOT NULL DEFAULT true,
    "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"   TIMESTAMP(3) NOT NULL,

    CONSTRAINT "financial_reports_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "financial_reports_year_month_title_key"
    ON "financial_reports"("year", "month", "title");

CREATE INDEX IF NOT EXISTS "financial_reports_isPublished_year_month_idx"
    ON "financial_reports"("isPublished", "year", "month");

-- 4. Create impact_stats table
CREATE TABLE IF NOT EXISTS "impact_stats" (
    "id"           TEXT NOT NULL,
    "key"          TEXT NOT NULL,
    "metricValue"  TEXT NOT NULL,
    "label"        TEXT NOT NULL,
    "labelMs"      TEXT,
    "period"       TEXT NOT NULL,
    "periodMs"     TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isPublished"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "impact_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "impact_stats_key_key"
    ON "impact_stats"("key");

CREATE INDEX IF NOT EXISTS "impact_stats_isPublished_displayOrder_idx"
    ON "impact_stats"("isPublished", "displayOrder");

COMMIT;
