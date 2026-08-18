import { ApplicationStatus } from "@/types/application";
import { PetStatus } from "@/types/pet";

export class DomainValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DomainValidationError";
  }
}

/**
 * Allowed state transitions for Adoption Applications.
 */
export const APPLICATION_TRANSITION_GRAPH: Record<ApplicationStatus, ApplicationStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "REJECTED"],
  UNDER_REVIEW: ["APPROVED", "REJECTED", "SUBMITTED"],
  APPROVED: ["UNDER_REVIEW"], // In case an approval needs re-evaluation
  REJECTED: ["UNDER_REVIEW"], // In case of appeal or updated references
};

/**
 * "Rehabilitation" is an alias of "In Rehabilitation": both denote an animal under
 * clinical or behavioural care and not yet cleared for adoption. Transitions are
 * always evaluated against the canonical value.
 */
const PET_STATUS_ALIASES: Record<PetStatus, PetStatus> = {
  Available: "Available",
  Pending: "Pending",
  Adopted: "Adopted",
  "In Rehabilitation": "In Rehabilitation",
  Rehabilitation: "In Rehabilitation",
};

/**
 * Resolves a pet status to its canonical form. Unknown values pass through unchanged
 * so that callers still fail on genuinely invalid input.
 */
export function normalizePetStatus(status: PetStatus): PetStatus {
  return PET_STATUS_ALIASES[status] ?? status;
}

// Rehabilitating animals leave care only via veterinary clearance back to Available.
const REHAB_TRANSITIONS: PetStatus[] = ["Available"];

/**
 * Allowed state transitions for Pets.
 */
export const PET_TRANSITION_GRAPH: Record<PetStatus, PetStatus[]> = {
  Available: ["Pending", "Adopted", "In Rehabilitation"],
  Pending: ["Available", "Adopted", "In Rehabilitation"],
  Adopted: ["Available"], // Returned to shelter
  "In Rehabilitation": REHAB_TRANSITIONS,
  Rehabilitation: REHAB_TRANSITIONS, // Alias entry — mirrors "In Rehabilitation"
};

/**
 * Validates an adoption application state transition.
 * Throws DomainValidationError if the transition is illegal.
 */
export function validateApplicationTransition(current: ApplicationStatus, next: ApplicationStatus): void {
  if (current === next) return; // No-op transition is allowed

  const allowedNext = APPLICATION_TRANSITION_GRAPH[current] || [];
  if (!allowedNext.includes(next)) {
    throw new DomainValidationError(
      `Illegal status transition: Cannot change application from '${current}' to '${next}'. Allowed next states: [${allowedNext.join(", ")}]`
    );
  }
}

/**
 * Validates a pet status transition.
 * Throws DomainValidationError if the transition is illegal.
 */
export function validatePetTransition(current: PetStatus, next: PetStatus): void {
  const from = normalizePetStatus(current);
  const to = normalizePetStatus(next);
  if (from === to) return;

  const allowedNext = (PET_TRANSITION_GRAPH[from] || []).map(normalizePetStatus);
  if (!allowedNext.includes(to)) {
    throw new DomainValidationError(
      `Illegal pet status transition: Cannot change pet from '${current}' to '${next}'. Allowed: [${allowedNext.join(", ")}]`
    );
  }
}
