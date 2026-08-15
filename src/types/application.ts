export type ApplicationStatus = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "REJECTED";

export interface AdoptionApplicationRecord {
  id: string;
  petId: string;
  petName: string;
  petBreed?: string;
  applicantName: string;
  email: string;
  phone: string;
  address: string;
  housingType: string;
  hasFencedYard: string;
  currentPets: string;
  currentPetDetails?: string;
  householdExperience: string;
  applicantNotes?: string;
  status: ApplicationStatus;
  adminReviewNotes?: string;
  createdAt: string;
  updatedAt: string;
}
