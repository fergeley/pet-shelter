/**
 * Seeds ONLY the faqs table.
 *
 * `npm run db:seed` also re-upserts staff users (rehashing their passwords),
 * shelter settings, every pet and every adoption application from the JSON
 * fixtures. Against a live database that would overwrite real records, so this
 * script performs just the FAQ portion of prisma/seed.ts — via the same shared
 * helper, so the two cannot drift apart.
 */
import "dotenv/config";
import dotenv from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { seedFaqEntries } from "../src/lib/domain/faqSeeding";
import { createPool, isProductionTarget, resolveConnectionString } from "./lib/db.mjs";

dotenv.config({ path: ".env.local" });

async function main() {
  console.log(
    "Target:",
    resolveConnectionString().replace(/:\/\/([^:]+):[^@]+@/, "://$1:***@"),
    isProductionTarget() ? "(PRODUCTION)" : ""
  );

  const pool = createPool();
  const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

  const { created, updated } = await seedFaqEntries(prisma);
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
