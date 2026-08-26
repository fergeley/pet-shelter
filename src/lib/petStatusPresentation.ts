import { Pet, PetStatus } from "@/types/pet";
import { normalizePetStatus } from "@/lib/domain/stateMachine";

export type PetStatusTone = "available" | "rehabilitation" | "pending" | "adopted";

export interface PetStatusPresentation {
  tone: PetStatusTone;
  /** Dictionary key for the badge label. */
  labelKey: string;
  /** English text used until the key is looked up. */
  labelFallback: string;
  /**
   * The design-system tone class (`tone-success`, `tone-care`, …) declared in
   * `globals.css`. On its own it only remaps the local `--tone-*` group, so it composes
   * with any tone-aware shell — `tone-panel`, `tone-ink`, `eyebrow-tone` — without this
   * module having to know which one the call site picked.
   */
   toneClass: string;
  /** Public solid pill badge. Self-contained: do not add padding or a text colour. */
  badgeClass: string;
  /** Admin-table variant — the same fill in a squarer chip. Also self-contained. */
  chipClass: string;
  /** Only adoptable animals accept an adoption application. */
  isAdoptable: boolean;
  /** Under veterinary or behavioural care: sponsorship is the supported action, not adoption. */
  isInRehabilitation: boolean;
}

/**
 * Domain tone → design tone. The left side is what the shelter calls the state; the
 * right side is what the design system calls the colour group. Keeping the mapping
 * explicit is what lets `globals.css` restyle every status surface at once — and stops
 * a new status from reaching for a raw `bg-success-solid` because it "looks available".
 */
const TONE_CLASS: Record<PetStatusTone, string> = {
  available: "tone-success",
  rehabilitation: "tone-care",
  pending: "tone-warning",
  adopted: "tone-neutral",
};

const PRESENTATIONS: Record<PetStatusTone, PetStatusPresentation> = {
  available: {
    tone: "available",
    labelKey: "common.available",
    labelFallback: "Available",
    toneClass: TONE_CLASS.available,
    badgeClass: `tone-chip tone-chip-pill ${TONE_CLASS.available}`,
      chipClass: `tone-chip ${TONE_CLASS.available}`,
    isAdoptable: true,
    isInRehabilitation: false,
  },
  rehabilitation: {
    tone: "rehabilitation",
    labelKey: "common.inRehabilitation",
    labelFallback: "In Rehabilitation",
    toneClass: TONE_CLASS.rehabilitation,
    badgeClass: `tone-chip tone-chip-pill ${TONE_CLASS.rehabilitation}`,
      chipClass: `tone-chip ${TONE_CLASS.rehabilitation}`,
    isAdoptable: false,
    isInRehabilitation: true,
  },
  pending: {
    tone: "pending",
    labelKey: "common.pending",
    labelFallback: "Pending",
    toneClass: TONE_CLASS.pending,
    badgeClass: `tone-chip tone-chip-pill ${TONE_CLASS.pending}`,
      chipClass: `tone-chip ${TONE_CLASS.pending}`,
    isAdoptable: false,
    isInRehabilitation: false,
  },
  adopted: {
    tone: "adopted",
    labelKey: "common.adopted",
    labelFallback: "Adopted",
    toneClass: TONE_CLASS.adopted,
    badgeClass: `tone-chip tone-chip-pill ${TONE_CLASS.adopted}`,
      chipClass: `tone-chip ${TONE_CLASS.adopted}`,
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
 * The canonical statuses, in the order surfaces should offer them — one per tone, so the
 * legacy alias never appears as a separate choice. Filter controls derive their options
 * from this rather than hand-listing them, which is how rehabilitation was omitted from
 * the admin table's status filter in the first place.
 */
export const PET_STATUS_SEQUENCE: PetStatus[] = [
  "Available",
  "In Rehabilitation",
  "Pending",
  "Adopted",
];

export interface PetStatusFilterOption {
  /** Canonical status, used as the `<option value>` and fed back to `matchesStatusFilter`. */
  value: PetStatus;
  tone: PetStatusTone;
  labelKey: string;
  labelFallback: string;
  /** How many of the supplied animals carry this status, either spelling. */
  count: number;
}

/**
 * Resolve how a pet's status should be presented. Statuses are normalized first, so the
 * legacy `Rehabilitation` alias and the canonical `In Rehabilitation` render identically.
 */
export function getPetStatusPresentation(status: PetStatus): PetStatusPresentation {
  const tone = TONE_BY_STATUS[normalizePetStatus(status)] ?? "pending";
  return PRESENTATIONS[tone];
}

/**
 * Build the status filter's options and their counts over a supplied population.
 *
 * Every animal lands in exactly one bucket — statuses are grouped by tone, so both rehab
 * spellings share a count and an unrecognised value still falls somewhere. The counts
 * therefore sum to `pets.length` by construction, which is the invariant staff notice
 * when it breaks: animals present in the header total but absent from every option.
 */
export function buildPetStatusFilterOptions(
  pets: readonly Pick<Pet, "status">[]
): PetStatusFilterOption[] {
  const counts = new Map<PetStatusTone, number>();
  for (const pet of pets) {
    const { tone } = getPetStatusPresentation(pet.status);
    counts.set(tone, (counts.get(tone) ?? 0) + 1);
  }

  return PET_STATUS_SEQUENCE.map((value) => {
    const { tone, labelKey, labelFallback } = getPetStatusPresentation(value);
    return { value, tone, labelKey, labelFallback, count: counts.get(tone) ?? 0 };
  });
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
