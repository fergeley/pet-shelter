"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/security/session";
import {
  assertAuthorized,
  ForbiddenError,
  TRANSPARENCY_EDITOR_ROLES,
  UnauthorizedError,
} from "@/lib/security/rbac";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { recordAuditLog } from "@/lib/domain/auditLog";
import {
  expenseItemSchema,
  financialReportSchema,
  impactStatSchema,
  type ExpenseItemInput,
  type FinancialReportInput,
  type ImpactStatInput,
} from "@/lib/validations/transparency";
import type { TransparencySnapshot } from "@/lib/domain/transparency";
import {
  DuplicateReportError,
  createExpenseItem,
  createFinancialReport,
  deleteExpenseItem,
  deleteFinancialReport,
  deleteImpactStat,
  isDatabaseUnavailable,
  readTransparencySnapshot,
  updateExpenseItem,
  upsertImpactStat,
} from "@/lib/server/transparencyRepository";

/**
 * Server actions for the transparency admin editor.
 *
 * The public page reads `readTransparencySnapshot()` directly from its Server
 * Component — no action needed, so the allocation is server-rendered rather
 * than fetched by the browser. Every write here is gated on
 * `TRANSPARENCY_EDITOR_ROLES`, rate limited, recorded in the audit log, and
 * followed by revalidation of both public surfaces that render ledger figures.
 */

export interface ActionResult<T = undefined> {
  success: boolean;
  data?: T;
  error?: string;
  /** "memory" means the database was unreachable and the edit is not durable. */
  persistedTo?: "database" | "memory";
}

/**
 * Paths that render ledger-derived figures. `/donate` is on this list because
 * its allocation summary is server-rendered from the same snapshot.
 */
const LEDGER_PATHS = ["/transparency", "/donate"];

/** Generous enough never to block real editing; stops a runaway client loop. */
const WRITE_RATE_LIMIT = 60;
const WRITE_RATE_WINDOW_MS = 60_000;

/**
 * Typed so `toMessage` passes it through verbatim. As a plain Error it was
 * replaced by the generic failure text, which told a throttled editor nothing
 * about why their change did not save or when to retry.
 */
class RateLimitedError extends Error {
  constructor(retryAfterSeconds: number) {
    super(`Too many changes in a short period. Try again in ${retryAfterSeconds}s.`);
    this.name = "RateLimitedError";
  }
}

function revalidateLedger(): void {
  try {
    for (const path of LEDGER_PATHS) {
      revalidatePath(path);
    }
  } catch {
    // Outside a Next.js request scope (unit tests); nothing to invalidate.
  }
}

/**
 * Converts a thrown error into a message safe to show an editor.
 *
 * Authorisation and validation messages are already written for humans. A raw
 * database error is not, and can disclose schema details, so it is logged and
 * replaced.
 */
function toMessage(err: unknown, fallback: string): string {
  if (
    err instanceof UnauthorizedError ||
    err instanceof ForbiddenError ||
    err instanceof DuplicateReportError ||
    err instanceof RateLimitedError
  ) {
    return err.message;
  }

  if (isDatabaseUnavailable(err)) {
    return "The database is unavailable, so this change was not saved. Try again once it is reachable.";
  }

  // The duplicate check in `createFinancialReport` is a read-then-write, so two
  // concurrent submits can both pass it and the unique index catches the second.
  // Without this the editor saw a generic failure for a duplicate the database
  // had just correctly prevented, and would retry.
  if (err && typeof err === "object" && (err as { code?: unknown }).code === "P2002") {
    return "A report with that title already exists for that period.";
  }

  // Zod errors carry field-level detail that is useful and safe to surface.
  if (err && typeof err === "object" && (err as { name?: unknown }).name === "ZodError") {
    const issues = (err as { issues?: { message?: string }[] }).issues ?? [];
    const first = issues.find((i) => typeof i.message === "string")?.message;
    if (first) return first;
  }

  console.error("[transparency]", fallback, err);
  return fallback;
}

/**
 * Shared preamble: authorise, then rate limit per editor.
 * Returns the session so callers can attribute the audit entry.
 */
async function authorizeWrite() {
  const session = await getCurrentSession();
  assertAuthorized(session, TRANSPARENCY_EDITOR_ROLES);

  const limit = checkRateLimit(
    `transparency:write:${session.id}`,
    WRITE_RATE_LIMIT,
    WRITE_RATE_WINDOW_MS
  );
  if (!limit.success) {
    throw new RateLimitedError(limit.retryAfterSeconds);
  }

  return session;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

/** Admin snapshot: includes unpublished drafts. Requires an editor role. */
export async function getAdminTransparencySnapshotAction(): Promise<
  ActionResult<TransparencySnapshot>
> {
  try {
    const session = await getCurrentSession();
    assertAuthorized(session, TRANSPARENCY_EDITOR_ROLES);

    const snapshot = await readTransparencySnapshot({ includeUnpublished: true });
    return { success: true, data: snapshot };
  } catch (err) {
    return { success: false, error: toMessage(err, "Failed to load transparency data") };
  }
}

/* -------------------------------------------------------------------------- */
/* Expense ledger                                                              */
/* -------------------------------------------------------------------------- */

export async function createExpenseItemAction(
  input: ExpenseItemInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await authorizeWrite();

    const validated = expenseItemSchema.parse(input);
    const { record, persistedTo } = await createExpenseItem(validated);

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TRANSPARENCY_EXPENSE_CREATED",
      entity: "ExpenseItem",
      entityId: record.id,
      details: {
        category: record.category,
        title: record.title,
        amountSen: record.amountSen,
        date: record.date,
        receiptRef: record.receiptRef,
        persistedTo,
      },
    });

    revalidateLedger();
    return { success: true, data: { id: record.id }, persistedTo };
  } catch (err) {
    return { success: false, error: toMessage(err, "Failed to record expense") };
  }
}

export async function updateExpenseItemAction(
  id: string,
  input: ExpenseItemInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await authorizeWrite();

    const validated = expenseItemSchema.parse(input);
    const result = await updateExpenseItem(id, validated);
    if (!result) {
      return { success: false, error: "That expense entry no longer exists." };
    }

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TRANSPARENCY_EXPENSE_UPDATED",
      entity: "ExpenseItem",
      entityId: id,
      // `before` matters as much as `after`: an amount edit changes published
      // percentages, and "after" alone cannot show what it changed from.
      details: { before: result.before, after: validated, persistedTo: result.persistedTo },
    });

    revalidateLedger();
    return { success: true, data: { id }, persistedTo: result.persistedTo };
  } catch (err) {
    return { success: false, error: toMessage(err, "Failed to update expense") };
  }
}

export async function deleteExpenseItemAction(id: string): Promise<ActionResult> {
  try {
    const session = await authorizeWrite();

    const removed = await deleteExpenseItem(id);
    if (!removed) {
      return { success: false, error: "That expense entry no longer exists." };
    }

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TRANSPARENCY_EXPENSE_DELETED",
      entity: "ExpenseItem",
      entityId: id,
      // The whole removed row: deleting it moves the published allocation, and
      // once gone the id resolves to nothing, so this is the only record of what
      // changed and by how much.
      details: { removed: removed.record, persistedTo: removed.persistedTo },
    });

    revalidateLedger();
    return { success: true, persistedTo: removed.persistedTo };
  } catch (err) {
    return { success: false, error: toMessage(err, "Failed to delete expense") };
  }
}

/* -------------------------------------------------------------------------- */
/* Impact counters                                                             */
/* -------------------------------------------------------------------------- */

export async function saveImpactStatAction(
  input: ImpactStatInput
): Promise<ActionResult<{ id: string; key: string }>> {
  try {
    const session = await authorizeWrite();

    const validated = impactStatSchema.parse(input);
    const { record, persistedTo } = await upsertImpactStat(validated);

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TRANSPARENCY_IMPACT_STAT_SAVED",
      entity: "ImpactStat",
      entityId: record.key,
      details: {
        metricValue: record.metricValue,
        label: record.label,
        period: record.period,
        isPublished: record.isPublished,
        persistedTo,
      },
    });

    revalidateLedger();
    return { success: true, data: { id: record.id, key: record.key }, persistedTo };
  } catch (err) {
    return { success: false, error: toMessage(err, "Failed to save impact statistic") };
  }
}

export async function deleteImpactStatAction(key: string): Promise<ActionResult> {
  try {
    const session = await authorizeWrite();

    const removed = await deleteImpactStat(key);
    if (!removed) {
      return { success: false, error: "That impact statistic no longer exists." };
    }

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TRANSPARENCY_IMPACT_STAT_DELETED",
      entity: "ImpactStat",
      entityId: key,
      details: { removed: removed.record, persistedTo: removed.persistedTo },
    });

    revalidateLedger();
    return { success: true, persistedTo: removed.persistedTo };
  } catch (err) {
    return { success: false, error: toMessage(err, "Failed to delete impact statistic") };
  }
}

/* -------------------------------------------------------------------------- */
/* Financial reports                                                           */
/* -------------------------------------------------------------------------- */

export async function createFinancialReportAction(
  input: FinancialReportInput
): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await authorizeWrite();

    const validated = financialReportSchema.parse(input);
    const { record, persistedTo } = await createFinancialReport(validated);

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TRANSPARENCY_REPORT_PUBLISHED",
      entity: "FinancialReport",
      entityId: record.id,
      details: {
        year: record.year,
        month: record.month,
        title: record.title,
        fileUrl: record.fileUrl,
        persistedTo,
      },
    });

    revalidateLedger();
    return { success: true, data: { id: record.id }, persistedTo };
  } catch (err) {
    return { success: false, error: toMessage(err, "Failed to publish report") };
  }
}

export async function deleteFinancialReportAction(id: string): Promise<ActionResult> {
  try {
    const session = await authorizeWrite();

    const removed = await deleteFinancialReport(id);
    if (!removed) {
      return { success: false, error: "That report no longer exists." };
    }

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TRANSPARENCY_REPORT_DELETED",
      entity: "FinancialReport",
      entityId: id,
      details: { removed: removed.record, persistedTo: removed.persistedTo },
    });

    revalidateLedger();
    return { success: true, persistedTo: removed.persistedTo };
  } catch (err) {
    return { success: false, error: toMessage(err, "Failed to delete report") };
  }
}
