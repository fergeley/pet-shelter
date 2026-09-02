import baseline from "@/data/transparency.json";
import {
  ExpenseCategoryKey,
  ExpenseItemRecord,
  FinancialReportRecord,
  ImpactStatRecord,
  isExpenseCategory,
} from "./transparency";

/**
 * The bundled DEVELOPMENT sample ledger, normalised into domain records.
 *
 * Deliberately free of Prisma and React imports so both the runtime fallback
 * (`transparencyStore`) and `prisma/seed.ts` can share one normalisation. They
 * previously each mapped the JSON themselves, and the copies had already
 * diverged: this one filters unknown categories, the seed's cast them with
 * `as never` and would fail mid-run on a Postgres enum error.
 *
 * These figures are invented. Nothing here may be presented as verified
 * spending — see `readTransparencySnapshot`, which refuses to serve them in
 * production, and the `SEED_SAMPLE_TRANSPARENCY` opt-in in the seed script.
 */

export interface SampleLedger {
  expenses: ExpenseItemRecord[];
  reports: FinancialReportRecord[];
  impactStats: ImpactStatRecord[];
}

interface RawExpense {
  id: string;
  category: string;
  title: string;
  amountSen: number;
  date: string;
  vendorOrClinic: string | null;
  petName: string | null;
  receiptRef: string | null;
}

interface RawReport {
  id: string;
  year: number;
  month: number | null;
  title: string;
  fileUrl: string;
  summary: string | null;
  publishedAt: string;
}

interface RawStat {
  id: string;
  key: string;
  metricValue: string;
  label: string;
  labelMs: string | null;
  period: string;
  periodMs: string | null;
  displayOrder: number;
}

export function getSampleLedger(): SampleLedger {
  const raw = baseline as unknown as {
    expenses: RawExpense[];
    reports: RawReport[];
    impactStats: RawStat[];
  };

  return {
    expenses: raw.expenses
      .filter((e) => isExpenseCategory(e.category))
      .map((e) => ({
        id: e.id,
        category: e.category as ExpenseCategoryKey,
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
