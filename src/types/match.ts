import { Pet } from "./pet";

export type HousingEnvironment = "condo_apartment" | "landed_no_yard" | "landed_fenced_yard";
export type HouseholdComposition = "adults_only" | "has_toddlers_kids" | "has_elderly" | "multi_generation";
export type ExistingPets = "none" | "dogs_only" | "cats_only" | "both_dogs_and_cats";
export type DailyActivityLevel = "low_under_30m" | "moderate_30_60m" | "active_1_2h" | "very_active_2h_plus";
export type AdopterExperience = "first_time" | "some_experience" | "experienced_handler";

export interface QuizAnswers {
  housing: HousingEnvironment;
  household: HouseholdComposition;
  existingPets: ExistingPets;
  dailyActivity: DailyActivityLevel;
  experience: AdopterExperience;
  preferredSpecies?: "dog" | "cat" | "any";
}

export interface MatchScoreBreakdown {
  housingScore: number;
  activityScore: number;
  experienceScore: number;
  safetyScore: number;
  totalScore: number; // 0 - 100
  matchPercentage: number; // 0 - 100
  reasons: string[];
  cautions: string[];
  isHardGateDisqualified: boolean;
  disqualificationReason?: string;
}

export interface PetMatchResult {
  pet: Pet;
  score: MatchScoreBreakdown;
}
