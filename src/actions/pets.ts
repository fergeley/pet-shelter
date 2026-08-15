"use server";

import { revalidatePath } from "next/cache";
import { petFormSchema, PetFormInput, PetFilterInput } from "@/lib/validations/pet";
import initialPetsData from "@/data/pets.json";
import { Pet } from "@/types/pet";

// In-memory server cache for demo and server actions
let serverPets: Pet[] = [...(initialPetsData as Pet[])];

export async function getPets(filters?: PetFilterInput): Promise<Pet[]> {
  let filtered = [...serverPets];

  if (filters?.species && filters.species !== "all") {
    filtered = filtered.filter((p) => p.species === filters.species);
  }

  if (filters?.status && filters.status !== "all") {
    filtered = filtered.filter((p) => p.status === filters.status);
  }

  if (filters?.ageCategory && filters.ageCategory !== "all") {
    filtered = filtered.filter((p) => p.ageCategory === filters.ageCategory);
  }

  if (filters?.size && filters.size !== "all") {
    filtered = filtered.filter((p) => p.size === filters.size);
  }

  if (filters?.search && filters.search.trim() !== "") {
    const q = filters.search.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.breed.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q)
    );
  }

  return filtered;
}

export async function getPetById(id: string): Promise<Pet | null> {
  const pet = serverPets.find((p) => p.id === id);
  return pet || null;
}

export async function createPet(data: PetFormInput): Promise<{ success: boolean; data?: Pet; error?: string }> {
  try {
    const validated = petFormSchema.parse(data);
    const newPet: Pet = {
      id: `pet-${Date.now()}`,
      name: validated.name,
      species: validated.species,
      breed: validated.breed,
      age: validated.age,
      ageCategory: validated.ageCategory,
      gender: validated.gender,
      size: validated.size,
      weight: validated.weight,
      status: validated.status,
      adoptionFee: validated.adoptionFee,
      description: validated.description,
      rescueStory: validated.rescueStory,
      image: validated.image,
      tags: validated.tags,
      featured: validated.featured,
      intakeDate: validated.intakeDate,
      medical: {
        vaccinated: validated.vaccinated,
        microchipped: validated.microchipped,
        spayedNeutered: validated.spayedNeutered,
        specialNeeds: validated.specialNeeds,
      },
      compatibility: {
        goodWithDogs: validated.goodWithDogs,
        goodWithCats: validated.goodWithCats,
        goodWithKids: validated.goodWithKids,
        energyLevel: validated.energyLevel,
      },
    };

    serverPets = [newPet, ...serverPets];
    revalidatePath("/pets");
    revalidatePath("/admin/pets");
    revalidatePath("/");

    return { success: true, data: newPet };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create pet record";
    return { success: false, error: msg };
  }
}

export async function updatePet(id: string, data: PetFormInput): Promise<{ success: boolean; data?: Pet; error?: string }> {
  try {
    const validated = petFormSchema.parse(data);
    const index = serverPets.findIndex((p) => p.id === id);
    if (index === -1) {
      return { success: false, error: "Pet not found" };
    }

    const updated: Pet = {
      ...serverPets[index],
      ...validated,
      medical: {
        vaccinated: validated.vaccinated,
        microchipped: validated.microchipped,
        spayedNeutered: validated.spayedNeutered,
        specialNeeds: validated.specialNeeds,
      },
      compatibility: {
        goodWithDogs: validated.goodWithDogs,
        goodWithCats: validated.goodWithCats,
        goodWithKids: validated.goodWithKids,
        energyLevel: validated.energyLevel,
      },
    };

    serverPets[index] = updated;
    revalidatePath("/pets");
    revalidatePath("/admin/pets");
    revalidatePath("/");

    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update pet record";
    return { success: false, error: msg };
  }
}

export async function deletePet(id: string): Promise<{ success: boolean; error?: string }> {
  const index = serverPets.findIndex((p) => p.id === id);
  if (index === -1) {
    return { success: false, error: "Pet not found" };
  }

  serverPets = serverPets.filter((p) => p.id !== id);
  revalidatePath("/pets");
  revalidatePath("/admin/pets");
  revalidatePath("/");

  return { success: true };
}

export async function updatePetStatus(id: string, status: Pet["status"]): Promise<{ success: boolean; error?: string }> {
  const index = serverPets.findIndex((p) => p.id === id);
  if (index === -1) {
    return { success: false, error: "Pet not found" };
  }

  serverPets[index] = { ...serverPets[index], status };
  revalidatePath("/pets");
  revalidatePath("/admin/pets");
  revalidatePath("/");

  return { success: true };
}
