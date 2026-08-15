"use server";

import { revalidatePath } from "next/cache";
import { petFormSchema, PetFormInput, PetFilterInput } from "@/lib/validations/pet";
import { Pet } from "@/types/pet";
import { getCurrentSession } from "@/lib/security/session";
import { assertAuthorized, ROLES } from "@/lib/security/rbac";
import {
  getServerPetsAsync,
  findServerPetById,
  insertServerPet,
  updateServerPet,
  deleteServerPet,
} from "@/lib/serverStore";

export async function getPets(filters?: PetFilterInput): Promise<Pet[]> {
  const allPets = await getServerPetsAsync();
  let filtered = [...allPets];

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
  return findServerPetById(id);
}

export async function createPet(data: PetFormInput): Promise<{ success: boolean; data?: Pet; error?: string }> {
  try {
    const session = await getCurrentSession();
    assertAuthorized(session, [ROLES.ADMIN, ROLES.COORDINATOR]);

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

    await insertServerPet(newPet, session);

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
    const session = await getCurrentSession();
    assertAuthorized(session, [ROLES.ADMIN, ROLES.COORDINATOR]);

    const validated = petFormSchema.parse(data);
    const existing = findServerPetById(id);
    if (!existing) {
      return { success: false, error: "Pet not found" };
    }

    const updated: Pet = {
      ...existing,
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

    await updateServerPet(id, updated, session);

    revalidatePath("/pets");
    revalidatePath(`/pets/${id}`);
    revalidatePath("/admin/pets");
    revalidatePath("/");

    return { success: true, data: updated };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update pet record";
    return { success: false, error: msg };
  }
}

export async function deletePet(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentSession();
    assertAuthorized(session, [ROLES.ADMIN]);

    const ok = await deleteServerPet(id, session);
    if (!ok) {
      return { success: false, error: "Pet not found" };
    }

    revalidatePath("/pets");
    revalidatePath("/admin/pets");
    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete pet";
    return { success: false, error: msg };
  }
}

export async function updatePetStatus(id: string, status: Pet["status"]): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentSession();
    assertAuthorized(session, [ROLES.ADMIN, ROLES.COORDINATOR]);

    const existing = findServerPetById(id);
    if (!existing) {
      return { success: false, error: "Pet not found" };
    }

    const updated: Pet = { ...existing, status };
    await updateServerPet(id, updated, session);

    revalidatePath("/pets");
    revalidatePath(`/pets/${id}`);
    revalidatePath("/admin/pets");
    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update pet status";
    return { success: false, error: msg };
  }
}
