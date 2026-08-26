import { ApplicationStatus } from "@/types/application";

export type ApplicationStatusTone = "submitted" | "underReview" | "approved" | "rejected";

export interface ApplicationStatusPresentation {
  status: ApplicationStatus;
  tone: ApplicationStatusTone;
  /** State label for badges and filters — "Under Review", not "UNDER REVIEW". */
  label: string;
  /** Verb form for the decision buttons: you *approve* an application that becomes *Approved*. */
  actionLabel: string;
  /** Table badge: solid fill in light mode, tinted bordered chip in dark. */
  chipClass: string;
  /** Selected state of the review dialog's decision pills. */
  pillClass: string;
}

/**
 * Kept parallel to `@/lib/petStatusPresentation` but deliberately separate: application
 * status is a different union with its own transition graph, and forcing the two through
 * one module would couple them for the sake of four shared class names.
 *
 * Admin copy is English-only (no dictionary keys exist for these states), so labels are
 * literals here rather than `labelKey`/`labelFallback` pairs.
 */
const PRESENTATIONS: Record<ApplicationStatus, ApplicationStatusPresentation> = {
  SUBMITTED: {
    status: "SUBMITTED",
    tone: "submitted",
    label: "Submitted",
    actionLabel: "Submitted",
    chipClass: "bg-blue-800 text-white dark:bg-blue-950 dark:text-blue-200 dark:border dark:border-blue-800",
    pillClass:
      "bg-sky-100 dark:bg-sky-950/60 border-sky-500 text-sky-800 dark:text-sky-300 ring-2 ring-sky-500/20",
  },
  UNDER_REVIEW: {
    status: "UNDER_REVIEW",
    tone: "underReview",
    label: "Under Review",
    actionLabel: "Under Review",
    chipClass: "bg-amber-800 text-white dark:bg-amber-950 dark:text-amber-200 dark:border dark:border-amber-800",
    pillClass:
      "bg-amber-100 dark:bg-amber-950/60 border-amber-500 text-amber-800 dark:text-amber-300 ring-2 ring-amber-500/20",
  },
  APPROVED: {
    status: "APPROVED",
    tone: "approved",
    label: "Approved",
    actionLabel: "Approve",
    chipClass:
      "bg-emerald-800 text-white dark:bg-emerald-950 dark:text-emerald-200 dark:border dark:border-emerald-800",
    pillClass:
      "bg-emerald-100 dark:bg-emerald-950/60 border-emerald-500 text-emerald-800 dark:text-emerald-300 ring-2 ring-emerald-500/20",
  },
  REJECTED: {
    status: "REJECTED",
    tone: "rejected",
    label: "Rejected",
    actionLabel: "Reject",
    chipClass: "bg-red-800 text-white dark:bg-red-950 dark:text-red-200 dark:border dark:border-red-800",
    pillClass:
      "bg-red-100 dark:bg-red-950/60 border-red-500 text-red-800 dark:text-red-300 ring-2 ring-red-500/20",
  },
};

/** Review order: the sequence a coordinator works through, not alphabetical. */
export const APPLICATION_STATUS_SEQUENCE: ApplicationStatus[] = [
  "SUBMITTED",
  "UNDER_REVIEW",
  "APPROVED",
  "REJECTED",
];

export interface ApplicationStatusFilterOption {
  value: ApplicationStatus;
  tone: ApplicationStatusTone;
  label: string;
  count: number;
}

export function getApplicationStatusPresentation(
  status: ApplicationStatus
): ApplicationStatusPresentation {
  return PRESENTATIONS[status] ?? PRESENTATIONS.SUBMITTED;
}

/**
 * Options and counts for the applications status filter. As with the pet table, counts
 * are one-per-application, so they sum to the population passed in.
 */
export function buildApplicationStatusFilterOptions(
  applications: readonly { status: ApplicationStatus }[]
): ApplicationStatusFilterOption[] {
  const counts = new Map<ApplicationStatus, number>();
  for (const application of applications) {
    const { status } = getApplicationStatusPresentation(application.status);
    counts.set(status, (counts.get(status) ?? 0) + 1);
  }

  return APPLICATION_STATUS_SEQUENCE.map((value) => {
    const { tone, label } = getApplicationStatusPresentation(value);
    return { value, tone, label, count: counts.get(value) ?? 0 };
  });
}
