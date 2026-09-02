import { SponsorshipTierId } from "./sponsorship";

/**
 * Loyalty standing earned by a sponsor.
 *
 * This is deliberately a different axis from `SponsorshipTierId` in `./sponsorship`.
 * A `SponsorshipTierId` is a *purpose fund* the donor buys (kibble, vaccine, spay/neuter,
 * emergency medical). A `SupporterTier` is a *standing* the donor earns from their giving
 * history. They are orthogonal: a single RM 250 emergency-medical pledge and five RM 50
 * vaccine pledges both land the donor at the same standing.
 */
export type SupporterTier = "BRONZE" | "SILVER" | "GOLD";

/** Whether a pledge has been reconciled against an actual payment. */
export type ContributionStatus = "PENDING" | "CONFIRMED";

/** Ordinal rank used for `>=` comparisons. A sponsor below Bronze has rank 0. */
export const TIER_RANK: Record<SupporterTier, number> = {
  BRONZE: 1,
  SILVER: 2,
  GOLD: 3,
};

export type PerkId =
  | "sponsor_wall"
  | "quarterly_newsletter"
  | "photo_gallery_updates"
  | "e_certificate"
  | "video_diary"
  | "open_day_invite"
  | "caretaker_qa";

export interface Perk {
  id: PerkId;
  /** Lowest standing that unlocks this perk. Perks are cumulative up the ranks. */
  minTier: SupporterTier;
  label: string;
  labelMs: string;
}

/** One contribution in a sponsor's ledger. */
export interface SponsorContributionRecord {
  id: string;
  sponsorId: string | null;
  receiptNumber: string;
  donorEmail: string;
  donorName: string;
  tierId: SponsorshipTierId;
  tierName: string;
  amountMYR: number;
  frequency: "one_time" | "monthly";
  /** Monthly pledges stop counting toward standing once cancelled. */
  isActive: boolean;
  /**
   * Payment state.
   *
   * `/donate` is a public form with no payment gateway behind it, so a submitted pledge
   * is an assertion, not money received. Only `CONFIRMED` rows confer anything.
   */
  status: ContributionStatus;
  /** Sponsor Wall consent given at the moment of this pledge. */
  displayOnWall: boolean;
  targetPetId: string | null;
  targetPetName: string | null;
  createdAt: string;
}

/**
 * The subset of a contribution that tier derivation reads.
 *
 * Declared separately so callers can hand over a narrow database projection instead of a
 * whole row — the public wall in particular must not select password hashes just to
 * satisfy a parameter type.
 */
export type TierRelevantContribution = Pick<
  SponsorContributionRecord,
  "amountMYR" | "frequency" | "isActive" | "status" | "createdAt"
>;

/** A sponsor as the public wall needs them. Deliberately carries no password hash. */
export interface WallSponsor {
  id: string;
  name: string;
  displayOnWall: boolean;
  createdAt: string;
}

/** A sponsor account. `passwordHash` never leaves the data-access layer. */
export interface SponsorRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  displayOnWall: boolean;
  createdAt: string;
  updatedAt: string;
}

/**
 * What the dashboard is allowed to know about the signed-in sponsor.
 * Excludes password hashes, tax IDs and other donors' data by construction.
 */
export interface SponsorDashboardDTO {
  sponsorId: string;
  name: string;
  email: string;
  tier: SupporterTier | null;
  /** 12-month rolling recognised contribution, in MYR. */
  recognisedMYR: number;
  /** MYR still needed to reach the next standing; null once Gold. */
  amountToNextTierMYR: number | null;
  nextTier: SupporterTier | null;
  billingFrequency: "one_time" | "monthly" | "mixed" | "none";
  hasActiveRecurring: boolean;
  displayOnWall: boolean;
  memberSince: string;
  perks: Array<{ id: PerkId; label: string; labelMs: string; unlocked: boolean }>;
  rescues: SponsoredRescueDTO[];
}

/** A pet the sponsor actively supports, with its live status badges. */
export interface SponsoredRescueDTO {
  petId: string;
  name: string;
  breed: string;
  species: string;
  image: string;
  /** Adoption pipeline status: Available / Pending / Adopted. */
  status: string;
  /** Derived rehabilitation stage, from the pet's medical timeline. */
  rehabStage: string;
  rehabStageMs: string;
  medicalBadges: string[];
  totalContributedMYR: number;
  lastContributionAt: string;
}

export interface ExclusiveGalleryItem {
  id: string;
  url: string;
  caption: string;
  captionMs: string;
  capturedAt: string;
}

export interface ExclusiveVideoItem {
  id: string;
  youtubeId: string;
  title: string;
  titleMs: string;
  recordedAt: string;
  durationLabel: string;
  thumbnailUrl: string;
  watchUrl: string;
}

/**
 * A tier-gated payload.
 *
 * The locked branch has no `items` key at all. That absence is the security property:
 * an under-tier caller has nothing to read, and TypeScript refuses code that tries.
 * Lives here rather than in the `server-only` access layer so client components can name
 * the type without importing server code.
 */
export type GatedPayload<T> =
  | {
      locked: true;
      requiredTier: SupporterTier;
      currentTier: SupporterTier | null;
      /** How many items are withheld, so a nudge can be specific without leaking them. */
      lockedCount: number;
    }
  | {
      locked: false;
      requiredTier: SupporterTier;
      currentTier: SupporterTier | null;
      items: T[];
    };

/** Response body of `GET /api/sponsor/pet-media/[petId]`. */
export interface PetExclusiveMediaResponse {
  gallery: GatedPayload<ExclusiveGalleryItem>;
  videoDiary: GatedPayload<ExclusiveVideoItem>;
}

/**
 * Everything printed on a sponsorship e-Certificate.
 *
 * Built server-side from a verified standing. Nothing on the certificate is computed in
 * the browser, so a sponsor cannot print themselves a tier they have not earned.
 */
export interface CertificateData {
  sponsorName: string;
  tier: SupporterTier;
  certificateNumber: string;
  issuedOn: string;
  coveringPeriod: string;
  recognisedMYR: number;
  rescueNames: string[];
  shelterRegistrationNo: string;
}

/** A single row on the public sponsor wall. Carries no amounts and no contact details. */
export interface SponsorWallEntryDTO {
  name: string;
  tier: SupporterTier;
  memberSince: string;
}
