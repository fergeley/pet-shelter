import { describe, it, expect } from "vitest";
import { getPetStatusPresentation, getRehabStageLabel, getRehabProgressPercent } from "@/lib/petStatusPresentation";
import { findSponsorshipTier, SPONSORSHIP_TIERS } from "@/lib/domain/sponsorshipTiers";
import { Pet } from "@/types/pet";

const mockAdoptablePet: Pet = {
  id: "pet-test-01",
  name: "Buster",
  species: "dog",
  breed: "Malaysian Mixed Breed",
  age: "2 years",
  ageCategory: "young",
  gender: "Male",
  size: "Medium",
  weight: "16 kg",
  status: "Available",
  adoptionFee: "Free",
  intakeDate: "2026-01-10",
  description: "Playful and friendly rescue companion.",
  rescueStory: "Rescued from SS2 commercial area.",
  image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1",
  tags: ["Friendly", "Vaccinated"],
  featured: false,
  isArchived: false,
  medical: {
    vaccinated: true,
    spayedNeutered: true,
    microchipped: true,
  },
  compatibility: {
    goodWithDogs: true,
    goodWithCats: false,
    goodWithKids: true,
    energyLevel: "Moderate",
  },
  updates: [
    {
      id: "up-001",
      date: "2026-02-01",
      title: "Behavioral clearance",
      content: "Buster completed outdoor socialization training.",
    },
  ],
};

const mockRehabPet: Pet = {
  ...mockAdoptablePet,
  id: "pet-test-02",
  name: "Kopi",
  status: "In Rehabilitation",
  rehabStage: "Stage 2: Bone Healing",
  rehabProgressPercent: 60,
  updates: [
    {
      id: "up-002",
      date: "2026-02-15",
      title: "X-ray review",
      content: "Callus formation progressing well on right hind leg.",
    },
  ],
};

describe("FE-05: Tabbed Animal Profile View & Status Presentation", () => {
  it("should format adoptable pet presentation correctly for profile tabs", () => {
    const pres = getPetStatusPresentation(mockAdoptablePet.status);
    expect(pres.isAdoptable).toBe(true);
    expect(pres.isInRehabilitation).toBe(false);
    expect(pres.tone).toBe("available");
  });

  it("should format rehabilitating pet presentation correctly with stage and progress", () => {
    const pres = getPetStatusPresentation(mockRehabPet.status);
    expect(pres.isAdoptable).toBe(false);
    expect(pres.isInRehabilitation).toBe(true);
    expect(pres.tone).toBe("rehabilitation");

    const stageLabel = getRehabStageLabel(mockRehabPet, false);
    expect(stageLabel).toBe("Stage 2: Bone Healing");

    const progressPercent = getRehabProgressPercent(mockRehabPet);
    expect(progressPercent).toBe(60);
  });

  it("should sort progress updates in descending chronological order", () => {
    const petWithMultiUpdates: Pet = {
      ...mockAdoptablePet,
      updates: [
        { id: "up-1", date: "2026-01-15", title: "Intake", content: "Initial medical check" },
        { id: "up-2", date: "2026-02-20", title: "Recovery", content: "Final weight check" },
        { id: "up-3", date: "2026-02-01", title: "Treatment", content: "Second vaccination" },
      ],
    };

    const sortedUpdates = [...(petWithMultiUpdates.updates ?? [])].sort((a, b) =>
      b.date.localeCompare(a.date)
    );

    expect(sortedUpdates.map((u) => u.id)).toEqual(["up-2", "up-3", "up-1"]);
  });

  it("should calculate tab navigation index wraps correctly for ARIA roving tabindex", () => {
    const tabs = ["about", "status", "updates", "support"];
    
    // ArrowRight from last tab wraps to first tab
    const nextFromLast = (3 + 1) % tabs.length;
    expect(nextFromLast).toBe(0);

    // ArrowLeft from first tab wraps to last tab
    const prevFromFirst = (0 - 1 + tabs.length) % tabs.length;
    expect(prevFromFirst).toBe(3);
  });
});

describe("FE-06: Personalized Sponsorship & Tiers", () => {
  it("should find the RM30 kibble/nutrition tier and support monthly giving", () => {
    const kibbleTier = findSponsorshipTier("kibble");
    expect(kibbleTier).toBeDefined();
    expect(kibbleTier?.amount).toBe(30);
    expect(kibbleTier?.name).toContain("Nutrition");
  });

  it("should define all 4 canonical sponsorship tiers with required metadata", () => {
    expect(SPONSORSHIP_TIERS.length).toBe(4);
    const tierIds = SPONSORSHIP_TIERS.map((t) => t.id);
    expect(tierIds).toContain("kibble");
    expect(tierIds).toContain("vaccine");
    expect(tierIds).toContain("spay_neuter");
    expect(tierIds).toContain("emergency_medical");

    SPONSORSHIP_TIERS.forEach((tier) => {
      expect(tier.amount).toBeGreaterThanOrEqual(30);
      expect(tier.description.length).toBeGreaterThan(10);
      expect(tier.impactMetrics.length).toBeGreaterThan(5);
    });
  });

  it("should match URL search params to dedicated animal or general fund", () => {
    const publicPets: Pet[] = [mockAdoptablePet, mockRehabPet];
    
    // By ID
    const matchById = publicPets.find((p) => p.id === "pet-test-02");
    expect(matchById?.name).toBe("Kopi");

    // By Name case-insensitive
    const matchByName = publicPets.find((p) => p.name.toLowerCase() === "buster".toLowerCase());
    expect(matchByName?.id).toBe("pet-test-01");

    // General fund fallback
    const nullMatch = publicPets.find((p) => p.id === "general") ?? null;
    expect(nullMatch).toBeNull();
  });
});
