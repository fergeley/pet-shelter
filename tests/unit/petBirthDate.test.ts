import { describe, it, expect, beforeEach } from "vitest";
import { createPet, updatePet, getPetById } from "@/actions/pets";
import { buildPetPersistencePayload } from "@/lib/server/petMappers";
import { petFormSchema, PetFormInput } from "@/lib/validations/pet";
import { signInAsAdmin } from "../setup/authSession";

describe("Pet Birth Date (PS-114)", () => {
  beforeEach(() => {
    signInAsAdmin();
  });

  const basePetInput: PetFormInput = {
    name: "Mochi",
    species: "cat",
    breed: "Domestic Short Hair",
    age: "1 year",
    ageCategory: "young",
    gender: "Female",
    size: "Small",
    weight: "3.5 kg",
    status: "Available",
    adoptionFee: "Free",
    description: "Friendly indoor cat who loves warm laps.",
    rescueStory: "Rescued from SS2 commercial area.",
    image: "https://images.hopeforstrays.org/mochi.jpg",
    tags: ["Vaccinated", "Friendly"],
    featured: false,
    intakeDate: "2026-01-10",
    vaccinated: true,
    microchipped: true,
    spayedNeutered: true,
    goodWithDogs: false,
    goodWithCats: true,
    goodWithKids: true,
    energyLevel: "Moderate",
  };

  describe("Schema Validation", () => {
    it("accepts a valid ISO birthDate YYYY-MM-DD", () => {
      const parsed = petFormSchema.safeParse({
        ...basePetInput,
        birthDate: "2024-05-20",
        birthDateIsEstimate: false,
      });
      expect(parsed.success).toBe(true);
    });

    it("accepts an empty string or omitted birthDate", () => {
      const parsed = petFormSchema.safeParse({
        ...basePetInput,
        birthDate: "",
      });
      expect(parsed.success).toBe(true);
    });

    it("rejects an invalid calendar date", () => {
      const parsed = petFormSchema.safeParse({
        ...basePetInput,
        birthDate: "2024-02-31",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("YYYY-MM-DD");
      }
    });

    it("rejects non-ISO formatted dates", () => {
      const parsed = petFormSchema.safeParse({
        ...basePetInput,
        birthDate: "20/05/2024",
      });
      expect(parsed.success).toBe(false);
    });
  });

  describe("createPet with birthDate", () => {
    it("persists exact birthDate and birthDateIsEstimate: false", async () => {
      const result = await createPet({
        ...basePetInput,
        name: "Mochi Exact",
        birthDate: "2023-08-15",
        birthDateIsEstimate: false,
      });

      expect(result.success).toBe(true);
      expect(result.data?.birthDate).toBe("2023-08-15");
      expect(result.data?.birthDateIsEstimate).toBe(false);

      const stored = await getPetById(result.data!.id);
      expect(stored?.birthDate).toBe("2023-08-15");
      expect(stored?.birthDateIsEstimate).toBe(false);

      const payload = buildPetPersistencePayload(result.data!);
      expect(payload.birthDate).toBe("2023-08-15");
      expect(payload.birthDateIsEstimate).toBe(false);
    });

    it("persists estimated birthDate when marked as estimate", async () => {
      const result = await createPet({
        ...basePetInput,
        name: "Mochi Approx",
        birthDate: "2024-01-01",
        birthDateIsEstimate: true,
      });

      expect(result.success).toBe(true);
      expect(result.data?.birthDate).toBe("2024-01-01");
      expect(result.data?.birthDateIsEstimate).toBe(true);

      const stored = await getPetById(result.data!.id);
      expect(stored?.birthDate).toBe("2024-01-01");
      expect(stored?.birthDateIsEstimate).toBe(true);
    });

    it("derives birthDate when birthDate is omitted", async () => {
      const result = await createPet({
        ...basePetInput,
        name: "Mochi Derived",
        age: "2 years",
        intakeDate: "2026-06-01",
        birthDate: "",
      });

      expect(result.success).toBe(true);
      // In persistence payload, deriveBirthDate kicks in
      const payload = buildPetPersistencePayload(result.data!);
      expect(payload.birthDate).toBe("2024-06-01");
      expect(payload.birthDateIsEstimate).toBe(true);
    });
  });

  describe("updatePet with birthDate", () => {
    it("updates birthDate and estimate flag on an existing pet", async () => {
      const created = await createPet({
        ...basePetInput,
        name: "Mochi Update",
        birthDate: "2024-01-01",
        birthDateIsEstimate: true,
      });
      expect(created.success).toBe(true);
      const petId = created.data!.id;

      const updated = await updatePet(petId, {
        ...basePetInput,
        name: "Mochi Update",
        birthDate: "2023-11-20",
        birthDateIsEstimate: false,
      });

      expect(updated.success).toBe(true);
      expect(updated.data?.birthDate).toBe("2023-11-20");
      expect(updated.data?.birthDateIsEstimate).toBe(false);

      const stored = await getPetById(petId);
      expect(stored?.birthDate).toBe("2023-11-20");
      expect(stored?.birthDateIsEstimate).toBe(false);
    });
  });
});
