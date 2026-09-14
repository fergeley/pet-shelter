import { describe, it, expect, beforeEach } from "vitest";
import { createPet, updatePet, getPetById } from "@/actions/pets";
import { buildPetPersistencePayload } from "@/lib/server/petMappers";
import { petFormSchema, PetFormInput, isValidCalendarDate } from "@/lib/validations/pet";
import { approximateBirthDate, withDerivedAge } from "@/lib/domain/petAge";
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

    it("correctly checks leap year calendar dates", () => {
      expect(isValidCalendarDate("2024-02-29")).toBe(true);
      expect(isValidCalendarDate("2023-02-29")).toBe(false);
      expect(isValidCalendarDate("2024-04-31")).toBe(false);
    });

    it("rejects birth dates in the distant future", () => {
      const parsed = petFormSchema.safeParse({
        ...basePetInput,
        birthDate: "2099-01-01",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("cannot be in the future");
      }
    });

    it("rejects birth date that is after intake date", () => {
      const parsed = petFormSchema.safeParse({
        ...basePetInput,
        intakeDate: "2026-01-10",
        birthDate: "2026-05-20",
      });
      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues[0]?.message).toContain("cannot be after intake date");
      }
    });

    it("rejects an invalid calendar date for intakeDate", () => {
      const parsed = petFormSchema.safeParse({
        ...basePetInput,
        intakeDate: "2024-02-31",
      });
      expect(parsed.success).toBe(false);
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

    it("safely updates when birthDate is cleared with an empty string", async () => {
      const created = await createPet({
        ...basePetInput,
        name: "Mochi Clear",
        birthDate: "2024-01-01",
        birthDateIsEstimate: true,
      });
      expect(created.success).toBe(true);
      const petId = created.data!.id;

      const updated = await updatePet(petId, {
        ...basePetInput,
        name: "Mochi Clear",
        birthDate: "",
      });

      expect(updated.success).toBe(true);
      expect(updated.data?.birthDate).toBeDefined();
      expect(updated.data?.birthDate).not.toBe("");
    });

    it("resets birthDateIsEstimate to true when clearing an exact birthDate", async () => {
      const created = await createPet({
        ...basePetInput,
        name: "Mochi Exact Clear",
        birthDate: "2023-05-10",
        birthDateIsEstimate: false,
      });
      expect(created.success).toBe(true);
      expect(created.data?.birthDateIsEstimate).toBe(false);

      const petId = created.data!.id;
      const updated = await updatePet(petId, {
        ...basePetInput,
        name: "Mochi Exact Clear",
        age: "2 years",
        birthDate: "",
      });

      expect(updated.success).toBe(true);
      expect(updated.data?.birthDateIsEstimate).toBe(true);
    });

    it("enforces birthDateIsEstimate: true on createPet when birthDate is omitted", async () => {
      const result = await createPet({
        ...basePetInput,
        name: "Mochi Fallback Estimate",
        age: "2 years",
        birthDate: "",
        birthDateIsEstimate: false, // Attempt to falsely mark an approximated date as exact
      });

      expect(result.success).toBe(true);
      expect(result.data?.birthDateIsEstimate).toBe(true);
    });
  });

  describe("approximateBirthDate & withDerivedAge Edge Cases", () => {
    it("handles Malay terms correctly and symmetrically with English", () => {
      const intake = "2026-06-12";
      const en = approximateBirthDate("2 years", intake);
      const ms = approximateBirthDate("2 tahun", intake);
      expect(ms.birthDate).toBe(en.birthDate);
      expect(ms.birthDate).toBe("2024-06-12");
      expect(ms.isEstimate).toBe(true);

      const enMonth = approximateBirthDate("4 months", "2026-07-22");
      const msMonth = approximateBirthDate("4 bulan", "2026-07-22");
      expect(msMonth.birthDate).toBe(enMonth.birthDate);
      expect(msMonth.birthDate).toBe("2026-03-22");
      expect(msMonth.isEstimate).toBe(true);
    });

    it("withDerivedAge enforces birthDateIsEstimate: boolean", () => {
      const petWithoutDate = withDerivedAge({
        intakeDate: "2026-06-12",
        age: "2 years",
      });
      expect(petWithoutDate.birthDateIsEstimate).toBe(true);
      expect(petWithoutDate.birthDate).toBe("2024-06-12");

      const petWithDate = withDerivedAge({
        intakeDate: "2026-06-12",
        birthDate: "2023-01-01",
        birthDateIsEstimate: false,
      });
      expect(petWithDate.birthDateIsEstimate).toBe(false);
      expect(petWithDate.birthDate).toBe("2023-01-01");
    });
  });
});
