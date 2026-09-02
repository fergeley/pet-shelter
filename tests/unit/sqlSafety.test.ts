import { describe, it, expect } from "vitest";
import {
  classifyDiff,
  isDestructiveStatement,
  parseStatements,
  stripBanner,
} from "../../scripts/lib/sqlSafety";

/**
 * Guards `npm run db:check-drift`. Its only unacceptable output is a false
 * negative — telling an operator that a `db push` which destroys production
 * data is safe to apply — so both failures that have actually occurred are
 * pinned here.
 */
describe("parseStatements", () => {
  it("keeps statements that Prisma prefixes with a comment label", () => {
    // Regression: splitting on ";" leaves each chunk starting with its
    // "-- DropTable" label, so filtering chunks that start with "--" discarded
    // every statement and reported a clean database.
    const sql = `-- DropTable\nDROP TABLE "pet_updates";\n\n-- CreateTable\nCREATE TABLE "faqs" ("id" TEXT);`;
    const statements = parseStatements(sql);
    expect(statements).toHaveLength(2);
    expect(statements[0]).toContain('DROP TABLE "pet_updates"');
    expect(statements[1]).toContain('CREATE TABLE "faqs"');
  });

  it("returns nothing for an empty or comment-only diff", () => {
    expect(parseStatements("")).toEqual([]);
    expect(parseStatements("-- nothing to do\n")).toEqual([]);
  });

  it("strips Prisma's banner lines", () => {
    const stdout = `◇ injected env (8) from .env.local\nLoaded Prisma config from prisma.config.ts.\n-- DropTable\nDROP TABLE "x";`;
    expect(stripBanner(stdout)).not.toContain("injected env");
    expect(stripBanner(stdout)).toContain("DROP TABLE");
  });
});

describe("isDestructiveStatement", () => {
  const destructive = [
    'DROP TABLE "pet_updates"',
    'DROP TYPE "FaqCategory"',
    'DROP INDEX "faqs_category_displayOrder_idx"',
    'ALTER TABLE "pets" DROP COLUMN "rehabStage"',
    'ALTER TABLE "medical_timeline_events" DROP CONSTRAINT "medical_timeline_events_petId_fkey"',
    'ALTER TABLE "pets" DROP COLUMN "customQrUrl",\nDROP COLUMN "rehabProgressPercent"',
    'TRUNCATE TABLE "faqs"',
    'ALTER TABLE "faqs" RENAME COLUMN "answer" TO "body"',
  ];

  it.each(destructive)("flags %s", (statement) => {
    expect(isDestructiveStatement(statement)).toBe(true);
  });

  const alterColumn = [
    // Regression: none of these contain the word DROP, so a DROP-only rule
    // reported them as "safe to apply" while they rewrite or reject real rows.
    'ALTER TABLE "pets" ALTER COLUMN "rehabNotes" SET DATA TYPE INTEGER',
    'ALTER TABLE "faqs" ALTER COLUMN "questionMs" SET NOT NULL',
    'ALTER TABLE "faqs" ALTER COLUMN "displayOrder" DROP DEFAULT',
  ];

  it.each(alterColumn)("flags the data-losing in-place change %s", (statement) => {
    expect(isDestructiveStatement(statement)).toBe(true);
  });

  const additive = [
    'CREATE TABLE "faqs" ("id" TEXT NOT NULL)',
    'CREATE TYPE "FaqCategory" AS ENUM (\'ADOPTION\')',
    'CREATE INDEX "faqs_category_displayOrder_idx" ON "faqs"("category")',
    'ALTER TABLE "pets" ADD COLUMN "customQrUrl" TEXT',
    'ALTER TABLE "faqs" ADD CONSTRAINT "faqs_pkey" PRIMARY KEY ("id")',
  ];

  it.each(additive)("does not flag %s", (statement) => {
    expect(isDestructiveStatement(statement)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isDestructiveStatement('drop table "faqs"')).toBe(true);
  });
});

describe("classifyDiff", () => {
  it("separates the two groups from a realistic Prisma dump", () => {
    const stdout = [
      "◇ injected env (8) from .env.local",
      "-- DropForeignKey",
      'ALTER TABLE "pet_updates" DROP CONSTRAINT "pet_updates_petId_fkey";',
      "",
      "-- AlterTable",
      'ALTER TABLE "pets" ADD COLUMN "newThing" TEXT;',
      "",
      "-- DropTable",
      'DROP TABLE "pet_updates";',
    ].join("\n");

    const { statements, destructive, additive } = classifyDiff(stdout);
    expect(statements).toHaveLength(3);
    expect(destructive).toHaveLength(2);
    expect(additive).toHaveLength(1);
    expect(additive[0]).toContain("ADD COLUMN");
  });

  it("reports a clean database as genuinely empty", () => {
    const { statements, destructive } = classifyDiff("◇ injected env (8)\n");
    expect(statements).toEqual([]);
    expect(destructive).toEqual([]);
  });
});
