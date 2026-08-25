import { Pet, PetStatus } from "@/types/pet";
import { normalizePetStatus } from "@/lib/domain/stateMachine";

export type PetStatusTone = "available" | "rehabilitation" | "pending" | "adopted";

export interface PetStatusPresentation {
  tone: PetStatusTone;
  /** Dictionary key for the badge label. */
  labelKey: string;
  /** English text used until the key is looked up. */
  labelFallback: string;
  /** Badge surface classes — white text sits on all four at WCAG AAA. */
  badgeClass: string;
  /** Only adoptable animals accept an adoption application. */
  isAdoptable: boolean;
  /** Under veterinary or behavioural care: sponsorship is the supported action, not adoption. */
  isInRehabilitation: boolean;
}

const PRESENTATIONS: Record<PetStatusTone, PetStatusPresentation> = {
  available: {
    tone: "available",
    labelKey: "common.available",
    labelFallback: "Available",
    badgeClass: "bg-emerald-800 dark:bg-emerald-900",
    isAdoptable: true,
    isInRehabilitation: false,
  },
  rehabilitation: {
    tone: "rehabilitation",
    labelKey: "common.inRehabilitation",
    labelFallback: "In Rehabilitation",
    badgeClass: "bg-indigo-800 dark:bg-indigo-900",
    isAdoptable: false,
    isInRehabilitation: true,
  },
  pending: {
    tone: "pending",
    labelKey: "common.pending",
    labelFallback: "Pending",
    badgeClass: "bg-amber-800 dark:bg-amber-900",
    isAdoptable: false,
    isInRehabilitation: false,
  },
  adopted: {
    tone: "adopted",
    labelKey: "common.adopted",
    labelFallback: "Adopted",
    badgeClass: "bg-slate-700 dark:bg-slate-800",
    isAdoptable: false,
    isInRehabilitation: false,
  },
};

const TONE_BY_STATUS: Record<PetStatus, PetStatusTone> = {
  Available: "available",
  "In Rehabilitation": "rehabilitation",
  Rehabilitation: "rehabilitation", // Alias entry — mirrors "In Rehabilitation"
  Pending: "pending",
  Adopted: "adopted",
};

/**
 * Resolve how a pet's status should be presented. Statuses are normalized first, so the
 * legacy `Rehabilitation` alias and the canonical `In Rehabilitation` render identically.
 */
export function getPetStatusPresentation(status: PetStatus): PetStatusPresentation {
  const tone = TONE_BY_STATUS[normalizePetStatus(status)] ?? "pending";
  return PRESENTATIONS[tone];
}

/**
 * Compare a pet's status against a gallery filter value, which arrives as a raw string
 * from the URL. Both sides are normalized, so selecting "In Rehabilitation" also matches
 * animals stored under the legacy `Rehabilitation` alias, and vice versa.
 */
export function matchesStatusFilter(status: PetStatus, selectedStatus: string): boolean {
  if (selectedStatus === "all") return true;
  return normalizePetStatus(status) === normalizePetStatus(selectedStatus as PetStatus);
}

type RehabStageFields = Pick<Pet, "rehabStage" | "rehabStageMs">;

/**
 * Rehabilitation stages are bilingual free text held on the pet, not dictionary keys, so
 * they follow the same `*Ms`-with-English-fallback shape as the rest of the fixture copy.
 */
export function getRehabStageLabel(pet: RehabStageFields, isMs: boolean): string | undefined {
  const preferred = isMs ? pet.rehabStageMs : pet.rehabStage;
  return preferred?.trim() || pet.rehabStage?.trim() || undefined;
}

/**
 * Clamped so a malformed value cannot blow out the progress bar's width — the store
 * accepts any integer for this column.
 */
export function getRehabProgressPercent(pet: Pick<Pet, "rehabProgressPercent">): number | undefined {
  const percent = pet.rehabProgressPercent;
  if (typeof percent !== "number" || Number.isNaN(percent)) return undefined;
  return Math.max(0, Math.min(100, Math.round(percent)));
}
