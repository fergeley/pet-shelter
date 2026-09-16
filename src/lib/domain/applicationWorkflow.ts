import { ApplicationStatus } from "@/types/application";

/**
 * Adoption application workflow: the public reference code, and the milestone
 * progression the tracking portal renders.
 *
 * This module deliberately does NOT extend `ApplicationStatus`. Status is the
 * *decision* axis (submitted -> under review -> approved/rejected); an interview
 * and a home visit are *milestones* that happen while a decision is still
 * pending. Modelling them as statuses would make "under review" and "home
 * visit" mutually exclusive, which they are not — and it was that conflation
 * which forced the tracking portal to recover interview details by regex from
 * the free-text `adminReviewNotes` field.
 */

export const REFERENCE_CODE_PREFIX = "HFS-APP";

/**
 * Crockford-style alphabet with the ambiguous glyphs removed (no 0/O, 1/I/L, U).
 * A reference code is read off a confirmation screen or an email and typed by
 * hand into the tracking portal, so the alphabet is chosen for transcription,
 * not for density.
 */
const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTVWXYZ";
const CODE_LENGTH = 4;

export const REFERENCE_CODE_PATTERN = /^HFS-APP-\d{6}-[2-9A-HJKMNP-TV-Z]{4}$/;

/** Injectable for tests; defaults to the platform CSPRNG. */
export type RandomIndex = (upperBoundExclusive: number) => number;

const cryptoRandomIndex: RandomIndex = (upperBoundExclusive) => {
  const buf = new Uint32Array(1);
  globalThis.crypto.getRandomValues(buf);
  return buf[0] % upperBoundExclusive;
};

/**
 * Builds a public reference code of the form `HFS-APP-YYYYMM-XXXX`.
 *
 * ceiling: 30^4 = 810,000 codes per calendar month, and the suffix is random
 * rather than sequential, so collisions are possible long before exhaustion
 * (~1% odds at 130 applications in one month). The column is `@unique` and the
 * caller retries, which is what actually guarantees uniqueness. If the shelter
 * ever clears ~1,000 applications a month, widen CODE_LENGTH to 5 rather than
 * adding a retry budget.
 */
export function generateReferenceCode(
  now: Date = new Date(),
  randomIndex: RandomIndex = cryptoRandomIndex
): string {
  const yearMonth = `${now.getUTCFullYear()}${String(now.getUTCMonth() + 1).padStart(2, "0")}`;

  let suffix = "";
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    suffix += CODE_ALPHABET[randomIndex(CODE_ALPHABET.length)];
  }

  return `${REFERENCE_CODE_PREFIX}-${yearMonth}-${suffix}`;
}

/**
 * Accepts what an applicant actually types: lowercase, padded, or with the
 * dashes left out. Anything that is not recognisably a reference code is
 * returned trimmed and uppercased so it can still be tried as a legacy
 * application id.
 */
export function normalizeReferenceCode(raw: string): string {
  const collapsed = raw.trim().toUpperCase().replace(/\s+/g, "");

  const bare = collapsed.replace(/-/g, "");
  const match = bare.match(/^(?:HFSAPP)?(\d{6})([2-9A-HJKMNP-TV-Z]{4})$/);
  if (match) {
    return `${REFERENCE_CODE_PREFIX}-${match[1]}-${match[2]}`;
  }

  return collapsed;
}

export function isReferenceCode(value: string): boolean {
  return REFERENCE_CODE_PATTERN.test(value);
}

/**
 * Combines the coordinator's `YYYY-MM-DD` date and `HH:MM` time into a UTC ISO
 * timestamp, or null if either is unparseable.
 *
 * Deliberately anchored to UTC in both directions. The pair is entered as wall
 * time and displayed back as wall time, so as long as write and read agree on
 * the zone the value round-trips exactly; letting the server's local zone in
 * here is what turns a 14:30 appointment into 22:30 for half the readers.
 */
export function combineInterviewDateTime(date: string, time: string): string | null {
  const trimmedDate = date.trim();
  const timeMatch = time.trim().match(/^(\d{1,2}):(\d{2})/);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmedDate) || !timeMatch) return null;

  const parsed = new Date(
    `${trimmedDate}T${timeMatch[1].padStart(2, "0")}:${timeMatch[2]}:00.000Z`
  );
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/** Inverse of `combineInterviewDateTime`; reads back in the same UTC frame. */
export function splitInterviewDateTime(iso: string): { date: string; time: string } | null {
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;

  const asIso = parsed.toISOString();
  return { date: asIso.slice(0, 10), time: asIso.slice(11, 16) };
}

export const APPLICATION_MILESTONES = [
  "RECEIVED",
  "REVIEW",
  "INTERVIEW",
  "HOME_VISIT",
  "DECISION",
] as const;

export type ApplicationMilestone = (typeof APPLICATION_MILESTONES)[number];

export interface ApplicationProgressInput {
  status: ApplicationStatus;
  /** ISO timestamp, or null when the milestone has not happened. */
  interviewAt?: string | null;
  homeVisitAt?: string | null;
}

export interface ApplicationProgress {
  /** Index into APPLICATION_MILESTONES of the furthest milestone reached. */
  currentIndex: number;
  currentMilestone: ApplicationMilestone;
  reached: readonly ApplicationMilestone[];
  isDecided: boolean;
  isRejected: boolean;
}

/**
 * Derives progress from evidence rather than from a single status field.
 *
 * Each milestone has an independent witness — a status value, or a timestamp
 * the coordinator recorded. The furthest witnessed milestone wins and every
 * earlier one is backfilled, so a home visit logged against an application
 * still marked SUBMITTED reports REVIEW as reached too. Milestones are
 * monotonic by construction: you cannot show step 4 lit and step 2 dark.
 */
export function deriveApplicationProgress(input: ApplicationProgressInput): ApplicationProgress {
  const isRejected = input.status === "REJECTED";
  const isDecided = input.status === "APPROVED" || isRejected;

  const witnessed: Record<ApplicationMilestone, boolean> = {
    RECEIVED: true,
    REVIEW: input.status !== "SUBMITTED",
    INTERVIEW: Boolean(input.interviewAt),
    HOME_VISIT: Boolean(input.homeVisitAt),
    DECISION: isDecided,
  };

  let currentIndex = 0;
  APPLICATION_MILESTONES.forEach((milestone, index) => {
    if (witnessed[milestone]) {
      currentIndex = index;
    }
  });

  return {
    currentIndex,
    currentMilestone: APPLICATION_MILESTONES[currentIndex],
    reached: APPLICATION_MILESTONES.slice(0, currentIndex + 1),
    isDecided,
    isRejected,
  };
}
