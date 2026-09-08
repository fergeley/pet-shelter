export type ApplicationStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

export interface AdoptionApplicationRecord {
  id: string;
  /**
   * Public reference code (`HFS-APP-YYYYMM-XXXX`) the applicant quotes to the
   * tracking portal. Optional because every application created before the
   * code existed is still addressed by `id`, and both remain valid lookups.
   */
  referenceCode?: string;
  petId: string;
  petName: string;
  petBreed?: string;
  applicantName: string;
  email: string;
  phone: string;
  address: string;
  /**
   * NRIC or passport number. Restricted: never enters the public tracking DTO
   * and never enters a notification email — see `toPublicTrackingDTO`.
   */
  identification?: string;
  housingType: string;
  hasFencedYard: string;
  landlordApproval?: string;
  currentPets: string;
  currentPetDetails?: string;
  householdExperience: string;
  vetClinic?: string;
  dailyAloneHours?: string;
  applicantNotes?: string;
  status: ApplicationStatus;
  adminReviewNotes?: string;

  /**
   * Workflow milestones. These are deliberately timestamps rather than
   * `ApplicationStatus` values: an application can be at the home-visit stage
   * and still be UNDER_REVIEW, so the two are independent axes. See
   * `src/lib/domain/applicationWorkflow.ts`.
   */
  interviewAt?: string | null;
  interviewLocation?: string | null;
  interviewMeetingType?: string | null;
  homeVisitAt?: string | null;

  createdAt: string;
  updatedAt: string;
}
