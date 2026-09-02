import "server-only";

import { cache } from "react";
import exclusiveMediaCatalogue from "@/data/exclusiveMedia.json";
import { getCurrentSponsorSession, SponsorSession } from "@/lib/security/sponsorSession";
import {
  findSponsorById,
  listContributionsBySponsorId,
  listWallOptInSponsors,
} from "@/lib/sponsorStore";
import { getServerPetsAsync } from "@/lib/serverStore";
import { getPetMedicalTimeline } from "@/lib/medicalTimeline";
import {
  deriveTier,
  recognisedContributionMYR,
  amountToNextTier,
  nextTierAbove,
  meetsTier,
  perksForTier,
  PERKS,
} from "./supporterTier";
import {
  SupporterTier,
  SponsorContributionRecord,
  SponsorRecord,
  SponsorDashboardDTO,
  SponsoredRescueDTO,
  SponsorWallEntryDTO,
  ExclusiveGalleryItem,
  ExclusiveVideoItem,
  GatedPayload,
  CertificateData,
} from "@/types/supporter";

/**
 * The authorization boundary for every tier-gated privilege in the app.
 *
 * The rule this module exists to enforce: a gate decides *before* the protected payload
 * is produced. `getGatedPetVideoDiary` and `getGatedPetGallery` return a discriminated
 * union whose `items` field does not exist on the locked branch, so an under-tier caller
 * has no URL to leak into an RSC payload, an HTML response or a JSON body — the type
 * system will not let one be read, and the runtime never loads one.
 *
 * Standing is always re-derived from the ledger here. It is never read from the session
 * cookie, a request body or a form field.
 */

interface PetExclusiveMedia {
  highResGallery: ExclusiveGalleryItem[];
  videoDiary: ExclusiveVideoItem[];
}

const CATALOGUE = exclusiveMediaCatalogue as Record<string, PetExclusiveMedia>;

export interface SponsorContext {
  session: SponsorSession;
  sponsor: SponsorRecord;
  contributions: SponsorContributionRecord[];
  tier: SupporterTier | null;
  recognisedMYR: number;
}

/**
 * Resolves the signed-in sponsor and their derived standing.
 *
 * Memoized with React `cache` so a page that renders several gates performs one ledger
 * read per request rather than one per gate.
 */
export const getSponsorContext = cache(async (): Promise<SponsorContext | null> => {
  const session = await getCurrentSponsorSession();
  if (!session) return null;

  const sponsor = await findSponsorById(session.sponsorId);
  if (!sponsor) return null;

  const contributions = await listContributionsBySponsorId(sponsor.id);
  return {
    session,
    sponsor,
    contributions,
    tier: deriveTier(contributions),
    recognisedMYR: recognisedContributionMYR(contributions),
  };
});

/** The current standing, or `null` for signed-out visitors and sub-Bronze sponsors. */
export async function getCurrentSupporterTier(): Promise<SupporterTier | null> {
  const context = await getSponsorContext();
  return context?.tier ?? null;
}

/** True when the signed-in sponsor's standing satisfies `requiredTier`. */
export async function currentSponsorMeetsTier(
  requiredTier: SupporterTier
): Promise<boolean> {
  return meetsTier(await getCurrentSupporterTier(), requiredTier);
}

function gate<T>(
  requiredTier: SupporterTier,
  currentTier: SupporterTier | null,
  loadItems: () => T[]
): GatedPayload<T> {
  if (!meetsTier(currentTier, requiredTier)) {
    return {
      locked: true,
      requiredTier,
      currentTier,
      // Counting is safe: a count reveals nothing the nudge does not already state.
      lockedCount: loadItems().length,
    };
  }
  return { locked: false, requiredTier, currentTier, items: loadItems() };
}

/** Behind-the-scenes video diary for a pet. Gold only. */
export async function getGatedPetVideoDiary(
  petId: string
): Promise<GatedPayload<ExclusiveVideoItem>> {
  const currentTier = await getCurrentSupporterTier();
  return gate("GOLD", currentTier, () => CATALOGUE[petId]?.videoDiary ?? []);
}

/** High-resolution recovery album for a pet. Silver and above. */
export async function getGatedPetGallery(
  petId: string
): Promise<GatedPayload<ExclusiveGalleryItem>> {
  const currentTier = await getCurrentSupporterTier();
  return gate("SILVER", currentTier, () => CATALOGUE[petId]?.highResGallery ?? []);
}

/**
 * Derives a rehabilitation stage from the pet's medical timeline.
 *
 * Reuses `getPetMedicalTimeline`, which already synthesises deterministic clinical
 * milestones when a pet carries no custom events, so a sponsored rescue always shows a
 * truthful stage rather than an empty badge.
 */
export function deriveRehabStage(
  pet: Parameters<typeof getPetMedicalTimeline>[0]
): { stage: string; stageMs: string; badges: string[] } {
  const timeline = getPetMedicalTimeline(pet);
  const categories = new Set(timeline.map((event) => event.category));

  const badges: string[] = [];
  if (pet.medical.vaccinated) badges.push("Vaccinated");
  if (pet.medical.spayedNeutered) badges.push("Spayed / Neutered");
  if (pet.medical.microchipped) badges.push("Microchipped");
  if (pet.medical.specialNeeds) badges.push("Ongoing care");

  if (categories.has("clearance")) {
    return { stage: "Medically cleared", stageMs: "Diluluskan dari segi perubatan", badges };
  }
  if (categories.has("surgery")) {
    return { stage: "Post-surgical recovery", stageMs: "Pemulihan selepas pembedahan", badges };
  }
  if (categories.has("vaccination")) {
    return { stage: "Immunisation in progress", stageMs: "Imunisasi sedang berjalan", badges };
  }
  if (categories.has("treatment")) {
    return { stage: "Under treatment", stageMs: "Dalam rawatan", badges };
  }
  return { stage: "Intake assessment", stageMs: "Penilaian kemasukan", badges };
}

function billingFrequencyOf(
  contributions: SponsorContributionRecord[]
): SponsorDashboardDTO["billingFrequency"] {
  if (contributions.length === 0) return "none";
  const hasMonthly = contributions.some((c) => c.frequency === "monthly" && c.isActive);
  const hasOneTime = contributions.some((c) => c.frequency === "one_time");
  if (hasMonthly && hasOneTime) return "mixed";
  if (hasMonthly) return "monthly";
  return "one_time";
}

/**
 * Everything the sponsor dashboard is allowed to see, projected from the ledger.
 * Password hashes, tax identifiers and other donors' rows never enter this DTO.
 */
export async function getSponsorDashboard(): Promise<SponsorDashboardDTO | null> {
  const context = await getSponsorContext();
  if (!context) return null;

  const { sponsor, contributions, tier, recognisedMYR } = context;

  const byPet = new Map<string, SponsorContributionRecord[]>();
  for (const contribution of contributions) {
    if (!contribution.targetPetId) continue;
    const bucket = byPet.get(contribution.targetPetId);
    if (bucket) bucket.push(contribution);
    else byPet.set(contribution.targetPetId, [contribution]);
  }

  // One pet read for the whole dashboard rather than one per sponsored rescue.
  const petsById = new Map((await getServerPetsAsync()).map((pet) => [pet.id, pet]));

  const rescues: SponsoredRescueDTO[] = [];
  for (const [petId, petContributions] of byPet) {
    const pet = petsById.get(petId);
    if (!pet) continue;

    const { stage, stageMs, badges } = deriveRehabStage(pet);
    rescues.push({
      petId: pet.id,
      name: pet.name,
      breed: pet.breed,
      species: pet.species,
      image: pet.image,
      status: pet.status,
      rehabStage: stage,
      rehabStageMs: stageMs,
      medicalBadges: badges,
      totalContributedMYR: petContributions.reduce((sum, c) => sum + c.amountMYR, 0),
      lastContributionAt: petContributions
        .map((c) => c.createdAt)
        .sort()
        .reverse()[0],
    });
  }

  rescues.sort((a, b) => b.lastContributionAt.localeCompare(a.lastContributionAt));

  const unlocked = new Set(perksForTier(tier).map((perk) => perk.id));

  return {
    sponsorId: sponsor.id,
    name: sponsor.name,
    email: sponsor.email,
    tier,
    recognisedMYR,
    amountToNextTierMYR: amountToNextTier(recognisedMYR),
    nextTier: nextTierAbove(tier),
    billingFrequency: billingFrequencyOf(contributions),
    hasActiveRecurring: contributions.some((c) => c.frequency === "monthly" && c.isActive),
    displayOnWall: sponsor.displayOnWall,
    memberSince: sponsor.createdAt,
    perks: PERKS.map((perk) => ({
      id: perk.id,
      label: perk.label,
      labelMs: perk.labelMs,
      unlocked: unlocked.has(perk.id),
    })),
    rescues,
  };
}

/** Registration under which Hope for Strays issues receipts and certificates. */
const SHELTER_REG_NO = "PPM-021-10-18082021";

/**
 * Stable per-sponsor, per-year certificate suffix.
 *
 * A reprint of the same year's certificate must carry the same number, so this is derived
 * from the sponsor id rather than randomised. It is an identifier, not a secret: it grants
 * nothing on its own and is never accepted as proof of anything.
 */
function certificateSuffix(sponsorId: string): string {
  let hash = 0;
  for (let i = 0; i < sponsorId.length; i += 1) {
    hash = (hash * 31 + sponsorId.charCodeAt(i)) % 100000;
  }
  return String(hash).padStart(5, "0");
}

/**
 * The signed-in sponsor's annual e-Certificate, or `null` below Silver.
 *
 * The `null` return is the gate: the certificate is *not built* for an under-tier
 * sponsor, so there is no rendered artefact to intercept.
 */
export async function getSponsorCertificate(
  now: Date = new Date()
): Promise<CertificateData | null> {
  const context = await getSponsorContext();
  if (!context || !meetsTier(context.tier, "SILVER") || !context.tier) return null;

  const dashboard = await getSponsorDashboard();
  const year = now.getFullYear();

  return {
    sponsorName: context.sponsor.name,
    tier: context.tier,
    certificateNumber: `HFS-CERT-${year}-${certificateSuffix(context.sponsor.id)}`,
    issuedOn: now.toLocaleDateString("en-MY", {
      year: "numeric",
      month: "long",
      day: "numeric",
    }),
    coveringPeriod: `${year - 1}–${year}`,
    recognisedMYR: context.recognisedMYR,
    rescueNames: dashboard?.rescues.map((rescue) => rescue.name) ?? [],
    shelterRegistrationNo: SHELTER_REG_NO,
  };
}

/**
 * The public sponsor wall.
 *
 * Two filters, both required: the sponsor must have opted in, and must hold a standing.
 * Amounts, emails, tax identifiers and pet dedications are never projected.
 */
export async function getSponsorWall(): Promise<Record<SupporterTier, SponsorWallEntryDTO[]>> {
  const rows = await listWallOptInSponsors();
  const wall: Record<SupporterTier, SponsorWallEntryDTO[]> = {
    GOLD: [],
    SILVER: [],
    BRONZE: [],
  };

  for (const { sponsor, contributions } of rows) {
    if (!sponsor.displayOnWall) continue;
    const tier = deriveTier(contributions);
    if (!tier) continue;
    wall[tier].push({
      name: sponsor.name,
      tier,
      memberSince: sponsor.createdAt,
    });
  }

  for (const tier of Object.keys(wall) as SupporterTier[]) {
    wall[tier].sort(
      (a, b) => a.memberSince.localeCompare(b.memberSince) || a.name.localeCompare(b.name)
    );
  }

  return wall;
}
