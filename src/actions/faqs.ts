"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, SessionUser } from "@/lib/security/session";
import { assertAuthorized } from "@/lib/security/rbac";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { faqFormSchema, FaqFormInput, FaqCategoryValue } from "@/lib/validations/faq";
import { FaqEntry, getFallbackFaqs, planFaqRenumber, sortFaqs } from "@/lib/domain/faq";
import { FAQ_EDITOR_ROLES } from "@/lib/domain/faqAccess";

// Shared with src/app/admin/faqs/page.tsx — see the note in faqAccess.ts for
// why the list cannot live in this file.

interface FaqRow {
  id: string;
  category: string;
  question: string;
  answer: string;
  questionMs: string | null;
  answerMs: string | null;
  displayOrder: number;
  isPublished: boolean;
  createdAt: Date | string;
  updatedAt: Date | string;
}

function toIso(value: Date | string): string {
  return typeof value === "string" ? value : new Date(value).toISOString();
}

/** Serialises a Prisma row into the plain object the client components expect. */
function toEntry(row: FaqRow): FaqEntry {
  return {
    id: row.id,
    category: row.category as FaqCategoryValue,
    question: row.question,
    answer: row.answer,
    questionMs: row.questionMs,
    answerMs: row.answerMs,
    displayOrder: row.displayOrder,
    isPublished: row.isPublished,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

async function requireFaqEditor(): Promise<SessionUser> {
  const session = await getCurrentSession();
  assertAuthorized(session, [...FAQ_EDITOR_ROLES]);
  return session;
}

/** Refreshes every surface that renders FAQ content. */
function revalidateFaqSurfaces(): void {
  try {
    revalidatePath("/faq");
    revalidatePath("/admin/faqs");
    revalidatePath("/pets");
  } catch {
    // Ignored outside a Next.js request context (e.g. unit tests).
  }
}

/**
 * Published FAQs for the public `/faq` page.
 *
 * Deliberately unauthenticated: it returns only `isPublished` rows, which are
 * exactly what /faq shows to anonymous visitors, so its reachability as a POST
 * endpoint discloses nothing the page does not already render. Contrast
 * `getAdminFaqs`, which can see drafts and therefore checks the role.
 *
 * Falls back to the bundled launch content when PostgreSQL is unreachable, so
 * the page never renders empty during a database outage. This mirrors the
 * fallback behaviour already used by `auditLog.ts` and `serverStore.ts`.
 */
export async function getPublicFaqs(options?: {
  /** Narrows the read to one category, so callers that only render one
   *  (the /pets adoption strip) do not pull every answer body. */
  category?: FaqCategoryValue;
}): Promise<FaqEntry[]> {
  const category = options?.category;

  try {
    const rows = await prisma.faq.findMany({
      where: { isPublished: true, ...(category ? { category } : {}) },
      orderBy: [{ displayOrder: "asc" }, { question: "asc" }],
    });

    // An empty result is an ANSWER, not a failure: it means staff have
    // unpublished everything. Treating it as an outage and substituting the
    // bundled content would resurrect retracted copy on the public page and
    // leave no way for an admin to empty /faq.
    return (rows as unknown as FaqRow[]).map(toEntry);
  } catch {
    // Only a genuine database error falls back to the bundled content.
    const fallback = getFallbackFaqs();
    return sortFaqs(category ? fallback.filter((f) => f.category === category) : fallback);
  }
}

/**
 * Every FAQ, published or not, for the admin management table.
 *
 * Authorised OUTSIDE the try/catch on purpose. Every export of a "use server"
 * module is reachable by direct POST on any route that imports the module, and
 * this one is imported by the public /faq and /pets pages — so without a check
 * an anonymous request could read unpublished drafts. Letting the rejection
 * propagate also stops the catch below from answering an unauthorised caller
 * with fallback content instead of an error.
 */
export async function getAdminFaqs(): Promise<FaqEntry[]> {
  await requireFaqEditor();

  // No fallback here, deliberately. The public page can substitute bundled
  // content because it only has to render prose. An editor must not: the
  // bundled rows carry ids that may not exist in the database, so every Edit,
  // Delete and Move on them would fail with "FAQ entry not found" while the
  // table insists the data is there. An outage has to surface as an outage.
  const rows = await prisma.faq.findMany({
    orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { question: "asc" }],
  });
  return (rows as unknown as FaqRow[]).map(toEntry);
}

export async function createFaq(
  data: FaqFormInput
): Promise<{ success: boolean; data?: FaqEntry; error?: string }> {
  try {
    const actor = await requireFaqEditor();
    const validated = faqFormSchema.parse(data);

    const created = await prisma.faq.create({
      data: {
        category: validated.category,
        question: validated.question,
        answer: validated.answer,
        questionMs: validated.questionMs ?? null,
        answerMs: validated.answerMs ?? null,
        displayOrder: validated.displayOrder,
        isPublished: validated.isPublished,
      },
    });

    const entry = toEntry(created as unknown as FaqRow);

    recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "FAQ_CREATED",
      entity: "Faq",
      entityId: entry.id,
      details: {
        category: entry.category,
        question: entry.question,
        isPublished: entry.isPublished,
        displayOrder: entry.displayOrder,
      },
    });

    revalidateFaqSurfaces();
    return { success: true, data: entry };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create FAQ entry";
    return { success: false, error: msg };
  }
}

export async function updateFaq(
  id: string,
  data: FaqFormInput
): Promise<{ success: boolean; data?: FaqEntry; error?: string }> {
  try {
    const actor = await requireFaqEditor();
    const validated = faqFormSchema.parse(data);

    const existing = await prisma.faq.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "FAQ entry not found" };
    }

    const previous = toEntry(existing as unknown as FaqRow);

    const updated = await prisma.faq.update({
      where: { id },
      data: {
        category: validated.category,
        question: validated.question,
        answer: validated.answer,
        questionMs: validated.questionMs ?? null,
        answerMs: validated.answerMs ?? null,
        displayOrder: validated.displayOrder,
        isPublished: validated.isPublished,
      },
    });

    const entry = toEntry(updated as unknown as FaqRow);

    recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "FAQ_UPDATED",
      entity: "Faq",
      entityId: id,
      details: {
        before: {
          category: previous.category,
          question: previous.question,
          answer: previous.answer,
          isPublished: previous.isPublished,
          displayOrder: previous.displayOrder,
        },
        after: {
          category: entry.category,
          question: entry.question,
          answer: entry.answer,
          isPublished: entry.isPublished,
          displayOrder: entry.displayOrder,
        },
      },
    });

    revalidateFaqSurfaces();
    return { success: true, data: entry };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update FAQ entry";
    return { success: false, error: msg };
  }
}

export async function toggleFaqPublished(
  id: string,
  isPublished: boolean
): Promise<{ success: boolean; data?: FaqEntry; error?: string }> {
  try {
    const actor = await requireFaqEditor();

    const existing = await prisma.faq.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "FAQ entry not found" };
    }

    const updated = await prisma.faq.update({
      where: { id },
      data: { isPublished },
    });

    const entry = toEntry(updated as unknown as FaqRow);

    recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: isPublished ? "FAQ_PUBLISHED" : "FAQ_UNPUBLISHED",
      entity: "Faq",
      entityId: id,
      details: { question: entry.question, isPublished },
    });

    revalidateFaqSurfaces();
    return { success: true, data: entry };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to change FAQ visibility";
    return { success: false, error: msg };
  }
}

/**
 * Moves an FAQ one position up or down within its own category by swapping
 * `displayOrder` with its neighbour. A no-op at the list boundary.
 */
export async function reorderFaq(
  id: string,
  direction: "up" | "down"
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireFaqEditor();

    // Read and write inside one transaction, with the category's rows locked.
    // Reading first and writing afterwards let two coordinators reordering
    // adjacent rows both plan against the same pre-swap snapshot and clobber
    // each other. Only this entry's own category is read, and only the three
    // columns ordering needs — the previous unfiltered findMany pulled every
    // row's full 5,000-character answer and answerMs on every arrow click.
    const outcome = await prisma.$transaction(async (tx) => {
      const target = await tx.faq.findUnique({
        where: { id },
        select: { id: true, category: true, question: true },
      });
      if (!target) return { notFound: true as const };

      await tx.$queryRaw`SELECT id FROM "faqs" WHERE category = ${target.category}::"FaqCategory" FOR UPDATE`;

      const siblings = await tx.faq.findMany({
        where: { category: target.category },
        select: { id: true, displayOrder: true, question: true },
      });

      const updates = planFaqRenumber(siblings, id, direction);
      // Already at the top or bottom of its category: nothing to do.
      if (!updates || updates.length === 0) return { noop: true as const };

      for (const row of updates) {
        await tx.faq.update({
          where: { id: row.id },
          data: { displayOrder: row.displayOrder },
        });
      }

      return { question: target.question, updates };
    });

    if ("notFound" in outcome) {
      return { success: false, error: "FAQ entry not found" };
    }
    if ("noop" in outcome) {
      return { success: true };
    }

    recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "FAQ_REORDERED",
      entity: "Faq",
      entityId: id,
      details: {
        direction,
        question: outcome.question,
        renumbered: outcome.updates,
      },
    });

    revalidateFaqSurfaces();
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to reorder FAQ entry";
    return { success: false, error: msg };
  }
}

export async function deleteFaq(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await requireFaqEditor();

    const existing = await prisma.faq.findUnique({ where: { id } });
    if (!existing) {
      return { success: false, error: "FAQ entry not found" };
    }

    const previous = toEntry(existing as unknown as FaqRow);
    await prisma.faq.delete({ where: { id } });

    recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "FAQ_DELETED",
      entity: "Faq",
      entityId: id,
      details: {
        category: previous.category,
        question: previous.question,
        answer: previous.answer,
      },
    });

    revalidateFaqSurfaces();
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete FAQ entry";
    return { success: false, error: msg };
  }
}
