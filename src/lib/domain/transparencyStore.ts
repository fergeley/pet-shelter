import { prisma } from "@/lib/prisma";
import baseline from "@/data/transparency.json";
import {
  buildSnapshot,
  ExpenseItemRecord,
  FinancialReportRecord,
  ImpactStatRecord,
  TransparencySnapshot,
  isExpenseCategory,
} from "./transparency";

/**
 * Persistence layer for the transparency ledger.
 *
 * Follows the same resilience contract as `auditLog.ts`: PostgreSQL is the
 * source of truth, and an in-memory mirror keeps the feature usable when the
 * database is unreachable (offline dev, unit tests, a cold deploy before
 * `db:push`). The two are never blended within a single request — a read either
 * comes wholly from the database or wholly from the fallback — so the public
 * page can never show half a ledger.
 *
 * The fallback is seeded from `src/data/transparency.json`, the very same file
 * `prisma/seed.ts` loads, so a seeded database and an offline render agree.
 */

type MutationTarget = "database" | "memory";

interface MemoryState {
  expenses: ExpenseItemRecord[];
  reports: FinancialReportRecord[];
  impactStats: ImpactStatRecord[];
}

interface BaselineExpense {
  id: string;
  category: string;
  title: string;
  amountSen: number;
  date: string;
  vendorOrClinic: string | null;
  petName: string | null;
  receiptRef: string | null;
}

interface BaselineReport {
  id: string;
  year: number;
  month: number | null;
  title: string;
  fileUrl: string;
  summary: string | null;
  publishedAt: string;
}

interface BaselineStat {
  id: string;
  key: string;
  metricValue: string;
  label: string;
  labelMs: string | null;
  period: string;
  periodMs: string | null;
  displayOrder: number;
}

/** Baseline rows, normalised into domain records. Exported for `prisma/seed.ts`. */
export function getBaselineRecords(): MemoryState {
  const raw = baseline as unknown as {
    expenses: BaselineExpense[];
    reports: BaselineReport[];
    impactStats: BaselineStat[];
  };

  return {
    expenses: raw.expenses
      .filter((e) => isExpenseCategory(e.category))
      .map((e) => ({
        id: e.id,
        category: e.category as ExpenseItemRecord["category"],
        title: e.title,
        amountSen: e.amountSen,
        date: e.date,
        vendorOrClinic: e.vendorOrClinic,
        petName: e.petName,
        receiptRef: e.receiptRef,
        isPublished: true,
      })),
    reports: raw.reports.map((r) => ({
      id: r.id,
      year: r.year,
      month: r.month,
      title: r.title,
      fileUrl: r.fileUrl,
      summary: r.summary,
      publishedAt: r.publishedAt,
      isPublished: true,
    })),
    impactStats: raw.impactStats.map((s) => ({
      id: s.id,
      key: s.key,
      metricValue: s.metricValue,
      label: s.label,
      labelMs: s.labelMs,
      period: s.period,
      periodMs: s.periodMs,
      displayOrder: s.displayOrder,
      isPublished: true,
    })),
  };
}

const globalForTransparency = globalThis as unknown as {
  transparencyMemory: MemoryState | undefined;
};

/** Survives Turbopack hot reloads so an admin edit is not lost on file save. */
function memory(): MemoryState {
  globalForTransparency.transparencyMemory ??= getBaselineRecords();
  return globalForTransparency.transparencyMemory;
}

/** Test-only: restores the in-memory mirror to the baseline dataset. */
export function resetTransparencyMemory(): void {
  globalForTransparency.transparencyMemory = getBaselineRecords();
}

function newId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/* -------------------------------------------------------------------------- */
/* Reads                                                                       */
/* -------------------------------------------------------------------------- */

interface DbExpenseRow {
  id: string;
  category: string;
  title: string;
  amountSen: number;
  date: string;
  vendorOrClinic: string | null;
  petName: string | null;
  receiptRef: string | null;
  isPublished: boolean;
}

interface DbReportRow {
  id: string;
  year: number;
  month: number | null;
  title: string;
  fileUrl: string;
  summary: string | null;
  publishedAt: Date | string;
  isPublished: boolean;
}

interface DbStatRow {
  id: string;
  key: string;
  metricValue: string;
  label: string;
  labelMs: string | null;
  period: string;
  periodMs: string | null;
  displayOrder: number;
  isPublished: boolean;
}

function toIso(value: Date | string): string {
  return typeof value === "string" ? value : value.toISOString();
}

/**
 * Reads the ledger. `includeUnpublished` is for the admin editor, which must be
 * able to see and re-publish a hidden row.
 */
export async function readTransparencySnapshot(
  options: { includeUnpublished?: boolean } = {}
): Promise<TransparencySnapshot> {
  const { includeUnpublished = false } = options;

  try {
    const [expenses, reports, impactStats] = await Promise.all([
      prisma.expenseItem.findMany({ orderBy: { date: "desc" } }),
      prisma.financialReport.findMany({ orderBy: [{ year: "desc" }, { month: "desc" }] }),
      prisma.impactStat.findMany({ orderBy: { displayOrder: "asc" } }),
    ]);

    // A reachable but completely unseeded database would render an empty page.
    // Fall through to the baseline so a fresh deploy still reads correctly.
    if (expenses.length > 0 || reports.length > 0 || impactStats.length > 0) {
      return projectSnapshot(
        {
          expenses: (expenses as unknown as DbExpenseRow[])
            .filter((e) => isExpenseCategory(e.category))
            .map((e) => ({
              id: e.id,
              category: e.category as ExpenseItemRecord["category"],
              title: e.title,
              amountSen: e.amountSen,
              date: e.date,
              vendorOrClinic: e.vendorOrClinic,
              petName: e.petName,
              receiptRef: e.receiptRef,
              isPublished: e.isPublished,
            })),
          reports: (reports as unknown as DbReportRow[]).map((r) => ({
            id: r.id,
            year: r.year,
            month: r.month,
            title: r.title,
            fileUrl: r.fileUrl,
            summary: r.summary,
            publishedAt: toIso(r.publishedAt),
            isPublished: r.isPublished,
          })),
          impactStats: (impactStats as unknown as DbStatRow[]).map((s) => ({
            id: s.id,
            key: s.key,
            metricValue: s.metricValue,
            label: s.label,
            labelMs: s.labelMs,
            period: s.period,
            periodMs: s.periodMs,
            displayOrder: s.displayOrder,
            isPublished: s.isPublished,
          })),
        },
        "database",
        includeUnpublished
      );
    }
  } catch {
    // Database unreachable — fall through to the in-memory mirror.
  }

  return projectSnapshot(memory(), "fallback", includeUnpublished);
}

function projectSnapshot(
  state: MemoryState,
  source: "database" | "fallback",
  includeUnpublished: boolean
): TransparencySnapshot {
  if (!includeUnpublished) {
    return buildSnapshot({ ...state, source });
  }

  // Admin view: build the derived figures from published rows only (they are
  // what the public sees), then widen the raw lists to include drafts.
  const snapshot = buildSnapshot({ ...state, source });
  return {
    ...snapshot,
    expenses: [...state.expenses].sort((a, b) => (a.date < b.date ? 1 : -1)),
    reports: [...state.reports].sort(
      (a, b) => b.year - a.year || (b.month ?? 0) - (a.month ?? 0)
    ),
    impactStats: [...state.impactStats].sort(
      (a, b) => a.displayOrder - b.displayOrder || a.key.localeCompare(b.key)
    ),
  };
}

/* -------------------------------------------------------------------------- */
/* Writes                                                                      */
/* -------------------------------------------------------------------------- */

export interface WriteOutcome<T> {
  record: T;
  persistedTo: MutationTarget;
}

export type ExpenseWriteInput = Omit<ExpenseItemRecord, "id">;
export type ReportWriteInput = Omit<FinancialReportRecord, "id">;
export type ImpactStatWriteInput = Omit<ImpactStatRecord, "id">;

export async function createExpenseItem(
  input: ExpenseWriteInput
): Promise<WriteOutcome<ExpenseItemRecord>> {
  try {
    const created = (await prisma.expenseItem.create({
      data: {
        category: input.category,
        title: input.title,
        amountSen: input.amountSen,
        date: input.date,
        vendorOrClinic: input.vendorOrClinic ?? null,
        petName: input.petName ?? null,
        receiptRef: input.receiptRef ?? null,
        isPublished: input.isPublished,
      },
    })) as unknown as DbExpenseRow;

    return {
      record: { ...input, id: created.id },
      persistedTo: "database",
    };
  } catch {
    const record: ExpenseItemRecord = { ...input, id: newId("exp") };
    memory().expenses.unshift(record);
    return { record, persistedTo: "memory" };
  }
}

export async function updateExpenseItem(
  id: string,
  input: Partial<ExpenseWriteInput>
): Promise<WriteOutcome<ExpenseItemRecord> | null> {
  try {
    const updated = (await prisma.expenseItem.update({
      where: { id },
      data: input,
    })) as unknown as DbExpenseRow;

    return {
      record: {
        id: updated.id,
        category: updated.category as ExpenseItemRecord["category"],
        title: updated.title,
        amountSen: updated.amountSen,
        date: updated.date,
        vendorOrClinic: updated.vendorOrClinic,
        petName: updated.petName,
        receiptRef: updated.receiptRef,
        isPublished: updated.isPublished,
      },
      persistedTo: "database",
    };
  } catch {
    const state = memory();
    const idx = state.expenses.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    state.expenses[idx] = { ...state.expenses[idx], ...input };
    return { record: state.expenses[idx], persistedTo: "memory" };
  }
}

export async function deleteExpenseItem(id: string): Promise<MutationTarget | null> {
  try {
    await prisma.expenseItem.delete({ where: { id } });
    return "database";
  } catch {
    const state = memory();
    const idx = state.expenses.findIndex((e) => e.id === id);
    if (idx === -1) return null;
    state.expenses.splice(idx, 1);
    return "memory";
  }
}

export async function createFinancialReport(
  input: ReportWriteInput
): Promise<WriteOutcome<FinancialReportRecord>> {
  try {
    const created = (await prisma.financialReport.create({
      data: {
        year: input.year,
        month: input.month,
        title: input.title,
        fileUrl: input.fileUrl,
        summary: input.summary ?? null,
        publishedAt: new Date(input.publishedAt),
        isPublished: input.isPublished,
      },
    })) as unknown as DbReportRow;

    return { record: { ...input, id: created.id }, persistedTo: "database" };
  } catch {
    const record: FinancialReportRecord = { ...input, id: newId("rpt") };
    memory().reports.unshift(record);
    return { record, persistedTo: "memory" };
  }
}

export async function deleteFinancialReport(id: string): Promise<MutationTarget | null> {
  try {
    await prisma.financialReport.delete({ where: { id } });
    return "database";
  } catch {
    const state = memory();
    const idx = state.reports.findIndex((r) => r.id === id);
    if (idx === -1) return null;
    state.reports.splice(idx, 1);
    return "memory";
  }
}

/**
 * Impact counters are keyed, not free-listed: updating "animals_fed_last_month"
 * must overwrite the existing card rather than append a second one.
 */
export async function upsertImpactStat(
  input: ImpactStatWriteInput
): Promise<WriteOutcome<ImpactStatRecord>> {
  const data = {
    metricValue: input.metricValue,
    label: input.label,
    labelMs: input.labelMs ?? null,
    period: input.period,
    periodMs: input.periodMs ?? null,
    displayOrder: input.displayOrder,
    isPublished: input.isPublished,
  };

  try {
    const saved = (await prisma.impactStat.upsert({
      where: { key: input.key },
      create: { key: input.key, ...data },
      update: data,
    })) as unknown as DbStatRow;

    return { record: { ...input, id: saved.id }, persistedTo: "database" };
  } catch {
    const state = memory();
    const idx = state.impactStats.findIndex((s) => s.key === input.key);
    if (idx >= 0) {
      state.impactStats[idx] = { ...state.impactStats[idx], ...input };
      return { record: state.impactStats[idx], persistedTo: "memory" };
    }
    const record: ImpactStatRecord = { ...input, id: newId("stat") };
    state.impactStats.push(record);
    return { record, persistedTo: "memory" };
  }
}

export async function deleteImpactStat(key: string): Promise<MutationTarget | null> {
  try {
    await prisma.impactStat.delete({ where: { key } });
    return "database";
  } catch {
    const state = memory();
    const idx = state.impactStats.findIndex((s) => s.key === key);
    if (idx === -1) return null;
    state.impactStats.splice(idx, 1);
    return "memory";
  }
}
