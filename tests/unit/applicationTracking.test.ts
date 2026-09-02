import { describe, it, expect, beforeEach, vi } from "vitest";
import { lookupApplicationStatusAction, submitApplication } from "@/actions/applications";
import { insertServerPet } from "@/lib/server/petRepository";
import { Pet } from "@/types/pet";
import { SessionUser } from "@/lib/security/session";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

describe("Public Adoption Application Tracking Portal", () => {
  const adminUser: SessionUser = {
    id: "admin-1",
    name: "Admin User",
    email: "admin@hopeforstrays.org",
    role: "ADMIN",
    expiresAt: Date.now() + 86400000,
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    const mockPet: Pet = {
      id: "pet-tracking-test-1",
      name: "Milo",
      species: "dog",
      breed: "Golden Retriever Mix",
      age: "2 years",
      ageCategory: "adult",
      gender: "Male",
      size: "Large",
      weight: "22 kg",
      status: "Available",
      adoptionFee: "Free",
      description: "Friendly and social dog.",
      rescueStory: "Rescued from SS2 Petaling Jaya.",
      image: "https://images.unsplash.com/photo-1552053831-71594a27632d",
      galleryImages: [],
      tags: ["Friendly", "Playful"],
      featured: true,
      intakeDate: "2026-06-01",
      isArchived: false,
      deletedAt: null,
      medical: {
        vaccinated: true,
        microchipped: true,
        spayedNeutered: true,
      },
      compatibility: {
        goodWithDogs: true,
        goodWithCats: true,
        goodWithKids: true,
        energyLevel: "Moderate",
      },
    };

    // Seed test pet
    await insertServerPet(mockPet, adminUser);
  });

  it("should successfully lookup a submitted application with valid reference ID and email", async () => {
    // 1. Submit application
    const submitResult = await submitApplication({
      petId: "pet-tracking-test-1",
      petName: "Milo",
      applicantName: "Ahmad Razak",
      email: "ahmad.razak@example.com",
      phone: "012-3456789",
      address: "Petaling Jaya, Selangor",
      housingType: "landed_terrace",
      hasFencedYard: "yes",
      currentPets: "dogs",
      householdExperience: "experienced",
      applicantNotes: "We love golden retrievers!",
    });

    expect(submitResult.success).toBe(true);
    const appId = submitResult.data!.id;

    // 2. Lookup with exact match
    const lookup = await lookupApplicationStatusAction({
      referenceId: appId,
      email: "ahmad.razak@example.com",
    });

    expect(lookup.success).toBe(true);
    expect(lookup.data).toBeDefined();
    expect(lookup.data?.id).toBe(appId);
    expect(lookup.data?.petName).toBe("Milo");
    expect(lookup.data?.petBreed).toBe("Golden Retriever Mix");
    expect(lookup.data?.status).toBe("SUBMITTED");
    expect(lookup.data?.applicantName).toBe("Ahmad Razak");
  });

  it("should handle case-insensitivity and whitespace trimming", async () => {
    const submitResult = await submitApplication({
      petId: "pet-tracking-test-1",
      petName: "Milo",
      applicantName: "Samantha Lee",
      email: "samantha.lee@example.com",
      phone: "013-9876543",
      address: "Damansara, Selangor",
      housingType: "condo_apartment",
      hasFencedYard: "no",
      currentPets: "none",
      householdExperience: "first_time",
    });

    expect(submitResult.success).toBe(true);
    const appId = submitResult.data!.id;

    // Lookup with uppercase and leading/trailing spaces
    const lookup = await lookupApplicationStatusAction({
      referenceId: `  ${appId}  `,
      email: "  SAMANTHA.LEE@EXAMPLE.COM  ",
    });

    expect(lookup.success).toBe(true);
    expect(lookup.data?.id).toBe(appId);
    expect(lookup.data?.applicantName).toBe("Samantha Lee");
  });

  it("should reject lookup when email does not match application record", async () => {
    const submitResult = await submitApplication({
      petId: "pet-tracking-test-1",
      petName: "Milo",
      applicantName: "Tan Wei Meng",
      email: "tan.wm@example.com",
      phone: "017-1122334",
      address: "Subang Jaya, Selangor",
      housingType: "semi_d_bungalow",
      hasFencedYard: "yes",
      currentPets: "none",
      householdExperience: "experienced",
    });

    expect(submitResult.success).toBe(true);
    const appId = submitResult.data!.id;

    // Lookup with wrong email
    const lookup = await lookupApplicationStatusAction({
      referenceId: appId,
      email: "hacker@example.com",
    });

    expect(lookup.success).toBe(false);
    expect(lookup.error).toContain("No application matching this Reference ID");
  });

  it("should reject non-existent reference ID", async () => {
    const lookup = await lookupApplicationStatusAction({
      referenceId: "app-invalid-9999999",
      email: "nobody@example.com",
    });

    expect(lookup.success).toBe(false);
    expect(lookup.error).toContain("No application matching this Reference ID");
  });
});
