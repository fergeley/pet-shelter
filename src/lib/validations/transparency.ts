import * as z from "zod";
import { EXPENSE_CATEGORY_KEYS, isIsoDate } from "@/lib/domain/transparency";

/**
 * The schema is the guard that makes `ExpenseItem.date` a safe `String` column:
 * every write path is forced through `YYYY-MM-DD`, so lexicographic ordering in
 * PostgreSQL is chronological ordering. Relax this and the "recent purchases"
 * feed silently mis-sorts.
 */
const isoDate = z
  .string()
  .trim()
  .refine(isIsoDate, "Date must be a real calendar date in YYYY-MM-DD format");

/**
 * Rejects `javascript:` and other script-bearing URLs on an admin-supplied link.
 *
 * Two traps this guards, both found in review:
 *  - `//evil.example/x.pdf` starts with "/" but is a PROTOCOL-RELATIVE absolute
 *    URL. It would pass a bare `startsWith("/")` check and then be classified as
 *    a same-site path, so the link would render without `rel="noopener
 *    noreferrer"` while actually navigating off-site.
 *  - Plain `http://` on a page served over HTTPS is mixed content, and these
 *    links are presented to donors as audited financial statements.
 */
const fileUrl = z
  .string()
  .trim()
  .min(1, "A file URL or path is required")
  .max(2048, "File URL is too long")
  .refine(
    (value) =>
      (value.startsWith("/") && !value.startsWith("//")) ||
      /^https:\/\/[^/]/i.test(value),
    "Link must be an absolute https:// URL or a site-relative path starting with a single /"
  );

export const expenseItemSchema = z.object({
  category: z.enum(EXPENSE_CATEGORY_KEYS),
  title: z
    .string()
    .trim()
    .min(4, "Describe the expense in at least 4 characters")
    .max(180, "Keep the description under 180 characters"),
  amountSen: z
    .number()
    .int("Amount must be a whole number of sen")
    .positive("Amount must be greater than zero")
    // RM 1,000,000 — a single line item above this is a data-entry error.
    .max(100_000_000, "Amount exceeds the RM 1,000,000 single-entry limit"),
  date: isoDate,
  vendorOrClinic: z.string().trim().max(120).optional().nullable(),
  petName: z.string().trim().max(80).optional().nullable(),
  receiptRef: z.string().trim().max(60).optional().nullable(),
  isPublished: z.boolean().default(true),
});

export const financialReportSchema = z.object({
  year: z
    .number()
    .int()
    .min(2000, "Year must be 2000 or later")
    .max(2100, "Year must be 2100 or earlier"),
  month: z
    .number()
    .int()
    .min(1, "Month must be between 1 and 12")
    .max(12, "Month must be between 1 and 12")
    .nullable()
    .optional()
    .transform((v) => v ?? null),
  title: z
    .string()
    .trim()
    .min(4, "Give the report a title")
    .max(180, "Keep the title under 180 characters"),
  fileUrl,
  summary: z.string().trim().max(600).optional().nullable(),
  publishedAt: z
    .string()
    .trim()
    .refine((v) => !Number.isNaN(Date.parse(v)), "Publication date is not a valid date"),
  isPublished: z.boolean().default(true),
});

export const impactStatSchema = z.object({
  key: z
    .string()
    .trim()
    .min(3, "Key must be at least 3 characters")
    .max(60, "Key must be under 60 characters")
    .regex(
      /^[a-z0-9_]+$/,
      "Key may contain only lowercase letters, digits and underscores"
    ),
  metricValue: z
    .string()
    .trim()
    .min(1, "Enter the figure to display")
    .max(20, "Keep the figure short enough to read as a headline"),
  label: z.string().trim().min(3, "Describe what the figure counts").max(120),
  labelMs: z.string().trim().max(120).optional().nullable(),
  period: z.string().trim().min(2, "State the period the figure covers").max(80),
  periodMs: z.string().trim().max(80).optional().nullable(),
  displayOrder: z.number().int().min(0).max(999).default(0),
  isPublished: z.boolean().default(true),
});

export type ExpenseItemInput = z.input<typeof expenseItemSchema>;
export type ExpenseItemOutput = z.output<typeof expenseItemSchema>;
export type FinancialReportInput = z.input<typeof financialReportSchema>;
export type FinancialReportOutput = z.output<typeof financialReportSchema>;
export type ImpactStatInput = z.input<typeof impactStatSchema>;
export type ImpactStatOutput = z.output<typeof impactStatSchema>;
