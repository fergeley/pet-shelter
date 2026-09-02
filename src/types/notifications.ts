/**
 * Donor notification consent and the sponsor photo-update dispatch.
 *
 * There is deliberately no sponsorship type here: commitments are owned by
 * `src/lib/server/sponsorshipLedger.ts` and its `SponsorshipRecord`. This feature
 * reads that ledger rather than keeping a second copy of who sponsors what.
 */

export interface NotificationPreferenceRecord {
  email: string;
  photoUpdates: boolean;
  newsletter: boolean;
  unsubscribedAllAt?: string | null;
}

/**
 * The tiers whose supporters receive photo updates: the two highest one-time
 * commitments. Recurring monthly supporters qualify at *any* tier — an ongoing
 * commitment is a stronger signal of engagement than a single large gift.
 *
 * Tier ids come from `src/lib/domain/sponsorshipTiers.ts`.
 */
export const PHOTO_UPDATE_ELIGIBLE_TIERS: readonly string[] = [
  "spay_neuter",
  "emergency_medical",
] as const;

/**
 * Hard ceiling on recipients for a single photo-update dispatch. A pet with a
 * runaway supporter list should degrade into a truncated send plus a loud audit
 * entry, never an unbounded email storm.
 */
export const MAX_RECIPIENTS_PER_DISPATCH = 250;

/**
 * Maximum number of newly added images referenced in one notification. Adding
 * five photos in one save produces a single email showing the first few, not
 * five separate emails.
 */
export const MAX_PHOTOS_PER_NOTIFICATION = 3;

export interface PhotoUpdateDispatchResult {
  dispatched: number;
  skippedOptedOut: number;
  skippedIneligible: number;
  /**
   * Addresses whose consent could not be established — distinct from those known
   * to have opted out. Never mailed; counted so an operator can tell "they said
   * no" apart from "we could not check".
   */
  skippedUnresolved: number;
  failed: number;
  truncated: boolean;
  /** Set when the dispatch was not attempted at all, with the reason why. */
  skippedReason?: string;
  recipients: string[];
}
