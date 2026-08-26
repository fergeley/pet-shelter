import { describe, it, expect } from "vitest";
import { adoptionFormSchema } from "@/hooks/useAdoptionFormController";
import { SPONSORSHIP_TIERS } from "@/lib/client/sponsorshipStore";
import { matchPetsWithQuiz } from "@/lib/matchEngine";
import initialPetsData from "@/data/pets.json";
import { Pet } from "@/types/pet";
import {
  validateApplicationTransition,
  DomainValidationError,
} from "@/lib/domain/stateMachine";

describe("Architecture & Controller Decoupling Tests", () => {
  const pets = initialPetsData as Pet[];

  describe("Adoption Form Schema & Controller Validation", () => {
    it("validates compliant adoption form inputs", () => {
      const validPayload = {
        petId: "pet-001",
        petName: "Kopi",
        applicantName: "Ahmad Razak",
        applicantEmail: "ahmad@example.com",
        applicantPhone: "0123456789",
        applicantAddress: "No. 12, Jalan SS2/5, 47300 Petaling Jaya, Selangor",
        housingType: "landed_terrace",
        hasFencedYard: "yes",
        currentPets: "none",
        householdExperience: "experienced",
        agreeToTerms: true,
      };

      const parsed = adoptionFormSchema.safeParse(validPayload);
      expect(parsed.success).toBe(true);
    });

    it("rejects application when terms are not accepted", () => {
      const invalidPayload = {
        petId: "pet-001",
        petName: "Kopi",
        applicantName: "Ahmad Razak",
        applicantEmail: "ahmad@example.com",
        applicantPhone: "0123456789",
        applicantAddress: "No. 12, Jalan SS2/5, 47300 Petaling Jaya, Selangor",
        housingType: "landed_terrace",
        hasFencedYard: "yes",
        currentPets: "none",
        householdExperience: "experienced",
        agreeToTerms: false,
      };

      const parsed = adoptionFormSchema.safeParse(invalidPayload);
      expect(parsed.success).toBe(false);
    });
  });

  describe("Sponsorship Controller Calculations", () => {
    it("provides valid sponsorship tiers with Malaysian currency amounts", () => {
      expect(SPONSORSHIP_TIERS.length).toBeGreaterThanOrEqual(4);
      SPONSORSHIP_TIERS.forEach((tier) => {
        expect(tier.amount).toBeGreaterThan(0);
        expect(tier.name).toBeTruthy();
        expect(tier.description).toBeTruthy();
      });
    });
  });

  describe("Pet Match Quiz Scoring Integration", () => {
    it("ranks companions according to housing and activity profile", () => {
      const answers = {
        housing: "landed_fenced_yard" as const,
        household: "has_toddlers_kids" as const,
        existingPets: "dogs_only" as const,
        dailyActivity: "active_1_2h" as const,
        experience: "experienced_handler" as const,
        preferredSpecies: "dog" as const,
      };

      const matches = matchPetsWithQuiz(pets, answers);
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].score.matchPercentage).toBeGreaterThan(0);
      expect(matches[0].pet.species).toBe("dog");
    });
  });

  describe("State Machine Guard in Application Controller Flow", () => {
    it("strictly verifies valid status progression from SUBMITTED to UNDER_REVIEW to APPROVED", () => {
      expect(() => validateApplicationTransition("SUBMITTED", "UNDER_REVIEW")).not.toThrow();
      expect(() => validateApplicationTransition("UNDER_REVIEW", "APPROVED")).not.toThrow();
      expect(() => validateApplicationTransition("SUBMITTED", "APPROVED")).toThrow(DomainValidationError);
      expect(() => validateApplicationTransition("APPROVED", "REJECTED")).toThrow(DomainValidationError);
    });
  });
});
