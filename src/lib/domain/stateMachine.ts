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
 * Allowed state transitions for Pets.
 */
export const PET_TRANSITION_GRAPH: Record<PetStatus, PetStatus[]> = {
  Available: ["Pending", "Adopted"],
  Pending: ["Available", "Adopted"],
  Adopted: ["Available"], // Returned to shelter
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
  if (current === next) return;

  const allowedNext = PET_TRANSITION_GRAPH[current] || [];
  if (!allowedNext.includes(next)) {
    throw new DomainValidationError(
      `Illegal pet status transition: Cannot change pet from '${current}' to '${next}'. Allowed: [${allowedNext.join(", ")}]`
    );
  }
}
