/**
 * Seeds ONLY the faqs table.
 *
 * `npm run db:seed` also re-upserts staff users (rehashing their passwords),
 * shelter settings, every pet and every adoption application from the JSON
 * fixtures. Against a live database that would overwrite real records, so this
 * script performs just the FAQ portion of prisma/seed.ts.
 */
import "dotenv/config";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { FAQ_SEED_CONTENT } from "../src/lib/domain/faq";

dotenv.config({ path: ".env.local" });

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const pool = new Pool({ connectionString, ssl: { rejectUnauthorized: false } });
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  let created = 0;
  let updated = 0;

  for (const faq of FAQ_SEED_CONTENT) {
    const existing = await prisma.faq.findUnique({ where: { id: faq.id } });
    await prisma.faq.upsert({
      where: { id: faq.id },
      update: {
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        questionMs: faq.questionMs,
        answerMs: faq.answerMs,
        displayOrder: faq.displayOrder,
      },
      create: {
        id: faq.id,
        category: faq.category,
        question: faq.question,
        answer: faq.answer,
        questionMs: faq.questionMs,
        answerMs: faq.answerMs,
        displayOrder: faq.displayOrder,
        isPublished: true,
      },
    });
    if (existing) updated++;
    else created++;
  }

  const total = await prisma.faq.count();
  console.log(`FAQ seed: ${created} created, ${updated} updated, ${total} rows total.`);

  const byCategory = await prisma.faq.groupBy({
    by: ["category"],
    _count: { _all: true },
  });
  for (const row of byCategory) {
    console.log(`  ${row.category.padEnd(14)} ${row._count._all}`);
  }

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => {
  console.error("FAQ seeding failed:", e);
  process.exit(1);
});
