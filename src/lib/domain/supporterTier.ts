import {
  SupporterTier,
  TIER_RANK,
  Perk,
  PerkId,
  TierRelevantContribution,
} from "@/types/supporter";

/**
 * Rolling window over which giving is recognised toward a standing.
 * A standing is a *current* relationship, not a lifetime trophy, so contributions age out.
 */
export const RECOGNITION_WINDOW_DAYS = 365;

/**
 * Minimum 12-month recognised contribution for each standing, in **exact integer sen**.
 *
 * Sen rather than ringgit for the same reason the ledger uses it: a threshold compared
 * against a float total decides a privilege on a rounding error. See
 * `src/lib/domain/money.ts`.
 *
 * Calibrated against the purpose funds in `SPONSORSHIP_TIERS` (kibble RM 30, vaccine
 * RM 50, spay/neuter RM 120, emergency medical RM 250) so the ladder reads naturally
 * in recurring terms:
 *   RM 25/month  -> RM 300/yr   -> Silver
 *   RM 100/month -> RM 1,200/yr -> Gold
 */
export const TIER_THRESHOLDS_SEN: Record<SupporterTier, number> = {
  BRONZE: 5_000,
  SILVER: 30_000,
  GOLD: 120_000,
};

const TIERS_HIGH_TO_LOW: SupporterTier[] = ["GOLD", "SILVER", "BRONZE"];

export const PERKS: Perk[] = [
  {
    id: "sponsor_wall",
    minTier: "BRONZE",
    label: "Name featured on the public Sponsor Wall",
    labelMs: "Nama dipaparkan di Dinding Penaja awam",
  },
  {
    id: "quarterly_newsletter",
    minTier: "BRONZE",
    label: "Quarterly rescue email newsletter",
    labelMs: "Surat berita e-mel penyelamatan suku tahunan",
  },
  {
    id: "photo_gallery_updates",
    minTier: "SILVER",
    label: "Monthly high-resolution photo gallery updates",
    labelMs: "Kemas kini galeri foto resolusi tinggi bulanan",
  },
  {
    id: "e_certificate",
    minTier: "SILVER",
    label: "Annual downloadable digital e-Certificate",
    labelMs: "e-Sijil digital tahunan boleh dimuat turun",
  },
  {
    id: "video_diary",
    minTier: "GOLD",
    label: "Exclusive behind-the-scenes video diary updates",
    labelMs: "Kemas kini diari video eksklusif di sebalik tabir",
  },
  {
    id: "open_day_invite",
    minTier: "GOLD",
    label: "Invitations to sanctuary open days",
    labelMs: "Jemputan ke hari terbuka pusat perlindungan",
  },
  {
    id: "caretaker_qa",
    minTier: "GOLD",
    label: "Direct Q&A message box with sanctuary caretakers",
    labelMs: "Kotak mesej soal jawab terus dengan penjaga",
  },
];

/** Rank of a standing, with `null` (no standing yet) treated as 0. */
export function rankOf(tier: SupporterTier | null): number {
  return tier ? TIER_RANK[tier] : 0;
}

/**
 * True when `actual` satisfies a `required` standing.
 * This is the single comparison every gate in the app must route through.
 */
export function meetsTier(
  actual: SupporterTier | null,
  required: SupporterTier
): boolean {
  return rankOf(actual) >= rankOf(required);
}

/** The perks unlocked at a given standing, cumulative up the ranks. */
export function perksForTier(tier: SupporterTier | null): Perk[] {
  return PERKS.filter((perk) => meetsTier(tier, perk.minTier));
}

export function hasPerk(tier: SupporterTier | null, perkId: PerkId): boolean {
  const perk = PERKS.find((p) => p.id === perkId);
  if (!perk) return false;
  return meetsTier(tier, perk.minTier);
}

/** The lowest standing that unlocks a perk — used to word upgrade nudges. */
export function tierRequiredForPerk(perkId: PerkId): SupporterTier | null {
  return PERKS.find((p) => p.id === perkId)?.minTier ?? null;
}

/**
 * Sums a sponsor's recognised contribution over the rolling window.
 *
 * One-time pledges count at face value if they fall inside the window.
 * An *active* monthly pledge counts at its annualised value (amount x 12) from the
 * moment it starts, which is what makes recurring giving worth committing to — the
 * standing arrives immediately rather than a year later. A cancelled monthly pledge
 * stops counting entirely, so standings decay when the relationship ends.
 *
 * Monthly pledges are stored as one row (not one row per charge), so nothing is
 * double-counted between the two branches.
 */
export function recognisedContributionSen(
  contributions: TierRelevantContribution[],
  now: Date = new Date()
): number {
  const cutoff = now.getTime() - RECOGNITION_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  return contributions.reduce((total, contribution) => {
    // An unconfirmed pledge confers no standing. Without this, `/donate` — a public,
    // unauthenticated form — would be a self-service Gold button: anyone could assert a
    // RM 1,200 pledge, or an RM 100 monthly one, and unlock every gate on the next
    // request without paying anything.
    if (contribution.status !== "CONFIRMED") return total;

    if (contribution.frequency === "monthly") {
      if (!contribution.isActive) return total;
      return total + contribution.amountSen * 12;
    }

    const issuedAt = new Date(contribution.issuedAt).getTime();
    if (Number.isNaN(issuedAt) || issuedAt < cutoff) return total;
    return total + contribution.amountSen;
  }, 0);
}

/** The standing earned by a recognised total, or `null` if it is below Bronze. */
export function tierForAmount(recognisedSen: number): SupporterTier | null {
  for (const tier of TIERS_HIGH_TO_LOW) {
    if (recognisedSen >= TIER_THRESHOLDS_SEN[tier]) return tier;
  }
  return null;
}

/**
 * Derives a sponsor's standing from their ledger.
 *
 * Standing is always *derived*, never stored or accepted from a client, so it cannot
 * be forged by tampering with a form, a cookie or a request body.
 */
export function deriveTier(
  contributions: TierRelevantContribution[],
  now: Date = new Date()
): SupporterTier | null {
  return tierForAmount(recognisedContributionSen(contributions, now));
}

/** The next standing up from `tier`, or `null` at the top of the ladder. */
export function nextTierAbove(tier: SupporterTier | null): SupporterTier | null {
  if (tier === "GOLD") return null;
  if (tier === "SILVER") return "GOLD";
  if (tier === "BRONZE") return "SILVER";
  return "BRONZE";
}

/** MYR still needed to reach the next standing, or `null` at Gold. */
export function amountToNextTier(recognisedSen: number): number | null {
  const next = nextTierAbove(tierForAmount(recognisedSen));
  if (!next) return null;
  return Math.max(0, TIER_THRESHOLDS_SEN[next] - recognisedSen);
}

export function tierLabel(tier: SupporterTier | null, isMs = false): string {
  if (!tier) {
    return isMs ? "Penyokong" : "Supporter";
  }
  const labels: Record<SupporterTier, [string, string]> = {
    BRONZE: ["Bronze", "Gangsa"],
    SILVER: ["Silver", "Perak"],
    GOLD: ["Gold", "Emas"],
  };
  return labels[tier][isMs ? 1 : 0];
}
