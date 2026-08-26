import { ApplicationStatus } from "@/types/application";

export type ApplicationStatusTone = "submitted" | "underReview" | "approved" | "rejected";

export interface ApplicationStatusPresentation {
  status: ApplicationStatus;
  tone: ApplicationStatusTone;
  /** State label for badges and filters — "Under Review", not "UNDER REVIEW". */
  label: string;
  /** Verb form for the decision buttons: you *approve* an application that becomes *Approved*. */
  actionLabel: string;
  /**
   * The design-system tone class from `globals.css`. Composes with any tone-aware shell
   * (`tone-panel`, `tone-ink`, `eyebrow-tone`) so surfaces beyond the two below can pick
   * up the status colour without restating it.
   */
  toneClass: string;
  /** Table badge. Self-contained: do not add padding or a text colour. */
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
/** Review tone → design tone, mirroring `TONE_CLASS` in `@/lib/petStatusPresentation`. */
const TONE_CLASS: Record<ApplicationStatusTone, string> = {
  submitted: "tone-info",
  underReview: "tone-warning",
  approved: "tone-success",
  rejected: "tone-danger",
};

const PRESENTATIONS: Record<ApplicationStatus, ApplicationStatusPresentation> = {
  SUBMITTED: {
    status: "SUBMITTED",
    tone: "submitted",
    label: "Submitted",
    actionLabel: "Submitted",
    toneClass: TONE_CLASS.submitted,
    chipClass: `tone-chip ${TONE_CLASS.submitted}`,
    pillClass: `tone-pill ${TONE_CLASS.submitted}`,
  },
  UNDER_REVIEW: {
    status: "UNDER_REVIEW",
    tone: "underReview",
    label: "Under Review",
    actionLabel: "Under Review",
    toneClass: TONE_CLASS.underReview,
    chipClass: `tone-chip ${TONE_CLASS.underReview}`,
    pillClass: `tone-pill ${TONE_CLASS.underReview}`,
  },
  APPROVED: {
    status: "APPROVED",
    tone: "approved",
    label: "Approved",
    actionLabel: "Approve",
    toneClass: TONE_CLASS.approved,
    chipClass: `tone-chip ${TONE_CLASS.approved}`,
    pillClass: `tone-pill ${TONE_CLASS.approved}`,
  },
  REJECTED: {
    status: "REJECTED",
    tone: "rejected",
    label: "Rejected",
    actionLabel: "Reject",
    toneClass: TONE_CLASS.rejected,
    chipClass: `tone-chip ${TONE_CLASS.rejected}`,
    pillClass: `tone-pill ${TONE_CLASS.rejected}`,
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
