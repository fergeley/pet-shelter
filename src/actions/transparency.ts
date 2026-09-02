"use server";

import { revalidatePath } from "next/cache";
import { getCurrentSession } from "@/lib/security/session";
import { assertAuthorized, TRANSPARENCY_EDITOR_ROLES } from "@/lib/security/rbac";
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
  createExpenseItem,
  createFinancialReport,
  deleteExpenseItem,
  deleteFinancialReport,
  deleteImpactStat,
  readTransparencySnapshot,
  updateExpenseItem,
  upsertImpactStat,
} from "@/lib/domain/transparencyStore";

/**
 * Server actions for the public transparency page and its admin editor.
 *
 * Read actions are unauthenticated by design — the whole point of the page is
 * that anyone can audit the figures. Every write is gated on
 * `TRANSPARENCY_EDITOR_ROLES`, recorded in the audit log, and followed by
 * revalidation of BOTH public surfaces that render the ledger.
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
 * its allocation summary reads the same snapshot — miss it and the donate page
 * serves a stale breakdown after an admin edit.
 */
const LEDGER_PATHS = ["/transparency", "/donate", "/admin/transparency"];

function revalidateLedger(): void {
  try {
    for (const path of LEDGER_PATHS) {
      revalidatePath(path);
    }
  } catch {
    // Outside a Next.js request scope (unit tests); nothing to invalidate.
  }
}

function toMessage(err: unknown, fallback: string): string {
  return err instanceof Error ? err.message : fallback;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

/** Public snapshot: published rows only. */
export async function getTransparencySnapshotAction(): Promise<TransparencySnapshot> {
  return readTransparencySnapshot();
}

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
    const session = await getCurrentSession();
    assertAuthorized(session, TRANSPARENCY_EDITOR_ROLES);

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
    const session = await getCurrentSession();
    assertAuthorized(session, TRANSPARENCY_EDITOR_ROLES);

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
      details: { after: validated, persistedTo: result.persistedTo },
    });

    revalidateLedger();
    return { success: true, data: { id }, persistedTo: result.persistedTo };
  } catch (err) {
    return { success: false, error: toMessage(err, "Failed to update expense") };
  }
}

export async function deleteExpenseItemAction(id: string): Promise<ActionResult> {
  try {
    const session = await getCurrentSession();
    assertAuthorized(session, TRANSPARENCY_EDITOR_ROLES);

    const persistedTo = await deleteExpenseItem(id);
    if (!persistedTo) {
      return { success: false, error: "That expense entry no longer exists." };
    }

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TRANSPARENCY_EXPENSE_DELETED",
      entity: "ExpenseItem",
      entityId: id,
      details: { persistedTo },
    });

    revalidateLedger();
    return { success: true, persistedTo };
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
    const session = await getCurrentSession();
    assertAuthorized(session, TRANSPARENCY_EDITOR_ROLES);

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
    const session = await getCurrentSession();
    assertAuthorized(session, TRANSPARENCY_EDITOR_ROLES);

    const persistedTo = await deleteImpactStat(key);
    if (!persistedTo) {
      return { success: false, error: "That impact statistic no longer exists." };
    }

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TRANSPARENCY_IMPACT_STAT_DELETED",
      entity: "ImpactStat",
      entityId: key,
      details: { persistedTo },
    });

    revalidateLedger();
    return { success: true, persistedTo };
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
    const session = await getCurrentSession();
    assertAuthorized(session, TRANSPARENCY_EDITOR_ROLES);

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
    const session = await getCurrentSession();
    assertAuthorized(session, TRANSPARENCY_EDITOR_ROLES);

    const persistedTo = await deleteFinancialReport(id);
    if (!persistedTo) {
      return { success: false, error: "That report no longer exists." };
    }

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "TRANSPARENCY_REPORT_DELETED",
      entity: "FinancialReport",
      entityId: id,
      details: { persistedTo },
    });

    revalidateLedger();
    return { success: true, persistedTo };
  } catch (err) {
    return { success: false, error: toMessage(err, "Failed to delete report") };
  }
}
