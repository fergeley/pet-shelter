"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentSession, SessionUser } from "@/lib/security/session";
import { assertAuthorized, ROLES } from "@/lib/security/rbac";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { faqFormSchema, FaqFormInput, FaqCategoryValue } from "@/lib/validations/faq";
import { FaqEntry, getFallbackFaqs, planFaqReorder, sortFaqs } from "@/lib/domain/faq";

/**
 * Roles permitted to manage the FAQ knowledge base.
 *
 * The task brief names `SUPER_ADMIN` and `CONTENT_EDITOR`, which do not exist
 * in this codebase's `Role` enum. They map onto the two roles that already
 * carry those responsibilities: ADMIN owns the platform, COORDINATOR edits
 * public-facing content.
 */
const FAQ_EDITOR_ROLES = [ROLES.ADMIN, ROLES.COORDINATOR] as const;

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
 * Falls back to the bundled launch content when PostgreSQL is unreachable, so
 * the page never renders empty during a database outage. This mirrors the
 * fallback behaviour already used by `auditLog.ts` and `serverStore.ts`.
 */
export async function getPublicFaqs(): Promise<FaqEntry[]> {
  try {
    const rows = await prisma.faq.findMany({
      where: { isPublished: true },
      orderBy: [{ displayOrder: "asc" }, { question: "asc" }],
    });

    if (rows.length > 0) {
      return (rows as unknown as FaqRow[]).map(toEntry);
    }
  } catch {
    // Fall through to bundled content.
  }

  return sortFaqs(getFallbackFaqs());
}

/** Every FAQ, published or not, for the admin management table. */
export async function getAdminFaqs(): Promise<FaqEntry[]> {
  try {
    const rows = await prisma.faq.findMany({
      orderBy: [{ category: "asc" }, { displayOrder: "asc" }, { question: "asc" }],
    });
    return (rows as unknown as FaqRow[]).map(toEntry);
  } catch {
    return sortFaqs(getFallbackFaqs());
  }
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

    const rows = await prisma.faq.findMany();
    const entries = (rows as unknown as FaqRow[]).map(toEntry);

    const plan = planFaqReorder(entries, id, direction);
    if (!plan) {
      // Already at the top or bottom of its category: nothing to do.
      return { success: true };
    }

    const { moved, swappedWith } = plan;

    // Two entries can legitimately share a displayOrder (ties break on the
    // question text), in which case a straight swap would not move anything.
    // Nudge the neighbour past the moved entry instead.
    const movedOrder =
      moved.displayOrder === swappedWith.displayOrder
        ? direction === "up"
          ? swappedWith.displayOrder - 1
          : swappedWith.displayOrder + 1
        : swappedWith.displayOrder;
    const neighbourOrder =
      moved.displayOrder === swappedWith.displayOrder
        ? swappedWith.displayOrder
        : moved.displayOrder;

    await prisma.$transaction([
      prisma.faq.update({ where: { id: moved.id }, data: { displayOrder: movedOrder } }),
      prisma.faq.update({
        where: { id: swappedWith.id },
        data: { displayOrder: neighbourOrder },
      }),
    ]);

    recordAuditLog({
      actorId: actor.id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "FAQ_REORDERED",
      entity: "Faq",
      entityId: id,
      details: {
        direction,
        question: moved.question,
        swappedWith: swappedWith.question,
        from: moved.displayOrder,
        to: movedOrder,
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
