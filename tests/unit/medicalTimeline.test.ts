import { describe, it, expect } from "vitest";
import {
  getPetMedicalTimeline,
  getCategoryBadgeClasses,
  getCategoryToneClass,
} from "@/lib/medicalTimeline";
import { Pet } from "@/types/pet";
import petsData from "@/data/pets.json";

describe("Rescue Intake & Clinical Medical Timeline", () => {
  const seededPets = petsData as unknown as Pet[];

  it("should extract custom clinical medical timeline from seeded pets", () => {
    const bella = seededPets.find((p) => p.id === "pet-001");
    expect(bella).toBeDefined();
    expect(bella?.medicalTimeline).toBeDefined();
    expect(bella?.medicalTimeline?.length).toBeGreaterThan(0);

    const timelineEn = getPetMedicalTimeline(bella!, "en");
    expect(timelineEn.length).toBe(bella?.medicalTimeline?.length);
    expect(timelineEn[0].category).toBe("intake");
    expect(timelineEn[0].veterinarian).toContain("DVM");
  });

  it("should format bilingual timeline titles and descriptions in Bahasa Malaysia", () => {
    const bella = seededPets.find((p) => p.id === "pet-001");
    const timelineMs = getPetMedicalTimeline(bella!, "ms");
    
    expect(timelineMs[0].title).toBe("Penyelamatan & Saringan Kemasukan Awal");
    expect(timelineMs[0].badge).toBe("Kemasukan Bersih");
    expect(timelineMs[0].description).toContain("kawasan industri Seksyen 19 Petaling Jaya");
  });

  it("should deterministically generate synthetic clinical timeline for a dynamic pet without custom timeline", () => {
    const syntheticPet: Pet = {
      id: "dynamic-pet-99",
      name: "Rocky",
      species: "dog",
      breed: "Local Mixed Breed",
      gender: "Male",
      age: "2 years",
      ageCategory: "young",
      size: "Medium",
      weight: "16 kg",
      image: "https://example.com/rocky.jpg",
      status: "Available",
      adoptionFee: "Free Adoption",
      intakeDate: "2026-05-15",
      tags: ["Playful"],
      description: "Friendly stray dog.",
      rescueStory: "Rescued in Subang.",
      compatibility: {
        goodWithDogs: true,
        goodWithCats: false,
        goodWithKids: true,
        energyLevel: "High",
      },
      medical: {
        vaccinated: true,
        spayedNeutered: true,
        microchipped: true,
      },
    };

    const timeline = getPetMedicalTimeline(syntheticPet, "en");
    expect(timeline.length).toBe(6); // intake, diagnostic, treatment, vaccination, surgery, clearance
    expect(timeline[0].category).toBe("intake");
    expect(timeline[0].date).toBe("2026-05-15");
    expect(timeline[5].category).toBe("clearance");
    expect(timeline[5].badge).toBe("Adoption Ready");
  });

  it("should safely handle partial or minimal medical records without crashing", () => {
    const minimalCat = {
      id: "minimal-cat-1",
      name: "Mochi",
      species: "cat",
      breed: "Domestic Short Hair",
      gender: "Female",
      age: "6 months",
      ageCategory: "young",
      size: "Small",
      weight: "2.8 kg",
      image: "https://example.com/mochi.jpg",
      status: "Available",
      adoptionFee: "Free Adoption",
      tags: ["Gentle"],
      description: "Quiet kitten.",
      rescueStory: "Found in Petaling Jaya.",
      compatibility: {
        goodWithDogs: true,
        goodWithCats: true,
        goodWithKids: true,
        energyLevel: "Low",
      },
      medical: {
        vaccinated: false,
        spayedNeutered: false,
        microchipped: false,
      },
    } as unknown as Pet;

    const timeline = getPetMedicalTimeline(minimalCat, "en");
    // Should have intake, diagnostic (FIV/FeLV), treatment
    expect(timeline.length).toBe(3);
    expect(timeline[0].category).toBe("intake");
    expect(timeline[1].title).toContain("FIV/FeLV");
    expect(timeline[2].category).toBe("treatment");
  });

  it("should return a design-system tone class for every category", () => {
    expect(getCategoryToneClass("intake")).toBe("tone-info");
    expect(getCategoryToneClass("diagnostic")).toBe("tone-highlight");
    expect(getCategoryToneClass("treatment")).toBe("tone-warning");
    expect(getCategoryToneClass("vaccination")).toBe("tone-success");
    expect(getCategoryToneClass("surgery")).toBe("tone-danger");
    expect(getCategoryToneClass("clearance")).toBe("tone-success");
  });

  // Colour-only classes: the badge's padding, radius and type scale belong to the call
  // site, so a `tone-panel` shell leaking in here would double up on both.
  it("should return tone-soft colour classes without a panel shell", () => {
    for (const category of [
      "intake",
      "diagnostic",
      "treatment",
      "vaccination",
      "surgery",
      "clearance",
    ] as const) {
      const classes = getCategoryBadgeClasses(category);
      expect(classes).toContain("tone-soft");
      expect(classes).toContain(getCategoryToneClass(category));
      expect(classes).not.toContain("tone-panel ");
    }
  });

  // Clearance shares vaccination's tone, so the emphasised surface is the only thing
  // separating "vaccinated" from "cleared by a vet" at a glance.
  it("should distinguish clearance from vaccination by surface weight, not hue", () => {
    expect(getCategoryBadgeClasses("clearance")).toContain("tone-panel-strong");
    expect(getCategoryBadgeClasses("vaccination")).not.toContain("tone-panel-strong");
  });
});
