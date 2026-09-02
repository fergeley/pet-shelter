import { FAQ_SEED_CONTENT } from "./faq";
import type { FaqCategoryValue } from "@/lib/validations/faq";

/** Columns refreshed on an existing seeded row. */
interface FaqSeedUpdate {
  category: FaqCategoryValue;
  question: string;
  answer: string;
  questionMs: string;
  answerMs: string;
  displayOrder: number;
}

/** Columns written when the seeded row does not exist yet. */
interface FaqSeedCreate extends FaqSeedUpdate {
  id: string;
  isPublished: boolean;
}

/**
 * The slice of a Prisma client this helper needs.
 *
 * Declared structurally and injected rather than importing PrismaClient, so
 * this module stays free of the Prisma runtime — `./faq` is imported by client
 * components, and keeping the seeding logic in a sibling that pulls in
 * @prisma/client would risk dragging it toward the browser bundle.
 */
export interface FaqSeedClient {
  faq: {
    findUnique(args: { where: { id: string } }): Promise<{ id: string } | null>;
    upsert(args: {
      where: { id: string };
      update: FaqSeedUpdate;
      create: FaqSeedCreate;
    }): Promise<unknown>;
  };
}

export interface FaqSeedResult {
  created: number;
  updated: number;
  total: number;
}

/**
 * Writes the canonical FAQ content, upserting by stable id.
 *
 * Shared by `prisma/seed.ts` and `scripts/seed-faqs.ts`, which previously held
 * two copies of this block and had already drifted apart. `isPublished` is
 * deliberately absent from the update path: re-seeding refreshes the launch
 * copy without silently republishing an entry staff have taken down.
 */
export async function seedFaqEntries(client: FaqSeedClient): Promise<FaqSeedResult> {
  let created = 0;
  let updated = 0;

  for (const faq of FAQ_SEED_CONTENT) {
    const existing = await client.faq.findUnique({ where: { id: faq.id } });

    await client.faq.upsert({
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

  return { created, updated, total: FAQ_SEED_CONTENT.length };
}
