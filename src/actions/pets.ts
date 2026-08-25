"use server";

import { revalidatePath } from "next/cache";
import {
  petFormSchema,
  PetFormInput,
  PetFilterInput,
  sortHistoryByDate,
} from "@/lib/validations/pet";
import { Pet } from "@/types/pet";
import { getCurrentSession, SessionUser } from "@/lib/security/session";
import { normalizePetStatus } from "@/lib/domain/stateMachine";
import { verifyAdminSession } from "@/lib/auth";
import {
  getServerPetsAsync,
  findServerPetById,
  insertServerPet,
  updateServerPet,
  archiveServerPet,
  getServerApplicationsAsync,
} from "@/lib/serverStore";

/**
 * Public catalog query: only returns active, non-archived pets.
 */
export async function getPublicPets(filters?: PetFilterInput): Promise<Pet[]> {
  const allPets = await getServerPetsAsync();
  let filtered = allPets.filter((p) => !p.isArchived);

  if (filters?.species && filters.species !== "all") {
    filtered = filtered.filter((p) => p.species === filters.species);
  }

  if (filters?.status && filters.status !== "all") {
    // Compare canonically so "Rehabilitation" and "In Rehabilitation" match each other.
    const wantedStatus = normalizePetStatus(filters.status);
    filtered = filtered.filter((p) => normalizePetStatus(p.status) === wantedStatus);
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
        p.description.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q))
    );
  }

  return filtered;
}

/**
 * Backward-compatible alias for getPublicPets
 */
export async function getPets(filters?: PetFilterInput): Promise<Pet[]> {
  return getPublicPets(filters);
}

/**
 * Admin catalog query: includes all pets (archived and active) with linked application counts.
 */
export async function getAdminPets(): Promise<(Pet & { applicationCount: number })[]> {
  const allPets = await getServerPetsAsync();
  const apps = await getServerApplicationsAsync();

  return allPets.map((pet) => {
    const petApps = apps.filter(
      (a) => a.petId === pet.id || a.petName.toLowerCase() === pet.name.toLowerCase()
    );
    return {
      ...pet,
      applicationCount: petApps.length,
    };
  });
}

export async function getPetById(id: string): Promise<Pet | null> {
  return findServerPetById(id);
}

async function getAdminActorOrThrow(): Promise<SessionUser> {
  const isAuthorized = await verifyAdminSession();
  if (!isAuthorized && process.env.NODE_ENV === "production") {
    throw new Error("Unauthorized: Admin authorization required");
  }

  const session = await getCurrentSession();
  if (session) return session;

  return {
    id: "admin-token-user",
    email: "admin@hopeforstrays.org",
    name: "Shelter Administrator",
    role: "ADMIN",
    expiresAt: Date.now() + 86400000,
  };
}

export async function createPet(
  data: PetFormInput
): Promise<{ success: boolean; data?: Pet; error?: string }> {
  try {
    const actor = await getAdminActorOrThrow();
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
      galleryImages: validated.galleryImages || [],
      tags: validated.tags,
      featured: validated.featured,
      intakeDate: validated.intakeDate,
      rehabStage: validated.rehabStage,
      rehabStageMs: validated.rehabStageMs,
      rehabProgressPercent: validated.rehabProgressPercent,
      updates: sortHistoryByDate(validated.updates),
      medicalTimeline: sortHistoryByDate(validated.medicalTimeline),
      isArchived: validated.isArchived ?? false,
      deletedAt: validated.deletedAt ?? null,
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

    await insertServerPet(newPet, actor);

    revalidatePath("/pets");
    revalidatePath("/admin/pets");
    revalidatePath("/");

    return { success: true, data: newPet };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to create pet record";
    return { success: false, error: msg };
  }
}

export async function updatePet(
  id: string,
  data: PetFormInput
): Promise<{ success: boolean; data?: Pet; error?: string }> {
  try {
    const actor = await getAdminActorOrThrow();
    const validated = petFormSchema.parse(data);
    const existing = findServerPetById(id);

    if (!existing) {
      return { success: false, error: "Pet not found" };
    }

    const updated: Pet = {
      ...existing,
      ...validated,
      // The submitted form is authoritative for rehabilitation progress: omitting the
      // fields clears them, so a cleared animal cannot keep a stale progress bar.
      rehabStage: validated.rehabStage,
      rehabStageMs: validated.rehabStageMs,
      rehabProgressPercent: validated.rehabProgressPercent,
      // Same rule for nested history, and the same reason. Zod drops absent
      // optional keys, so `{...existing, ...validated}` would silently keep an
      // event the submitter deleted. Assigning unconditionally makes removal by
      // omission — not just by an explicit empty array — actually delete rows.
      updates: sortHistoryByDate(validated.updates),
      medicalTimeline: sortHistoryByDate(validated.medicalTimeline),
      galleryImages: validated.galleryImages || existing.galleryImages || [],
      isArchived: validated.isArchived ?? existing.isArchived ?? false,
      deletedAt: validated.deletedAt !== undefined ? validated.deletedAt : existing.deletedAt,
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

    await updateServerPet(id, updated, actor);

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

/**
 * Soft delete or restore an animal record
 */
export async function toggleArchivePet(
  id: string,
  archive: boolean
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await getAdminActorOrThrow();
    const ok = await archiveServerPet(id, archive, actor);
    if (!ok) {
      return { success: false, error: "Pet not found" };
    }

    revalidatePath("/pets");
    revalidatePath(`/pets/${id}`);
    revalidatePath("/admin/pets");
    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to archive pet";
    return { success: false, error: msg };
  }
}

/**
 * Soft delete (archive) pet
 */
export async function deletePet(id: string): Promise<{ success: boolean; error?: string }> {
  return toggleArchivePet(id, true);
}

export async function updatePetStatus(
  id: string,
  status: Pet["status"]
): Promise<{ success: boolean; error?: string }> {
  try {
    const actor = await getAdminActorOrThrow();
    const existing = findServerPetById(id);
    if (!existing) {
      return { success: false, error: "Pet not found" };
    }

    const updated: Pet = { ...existing, status };
    await updateServerPet(id, updated, actor);

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
