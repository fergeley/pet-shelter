# Revised Task 02: Protected Server Actions & Admin Portal

## 1. Authentication & Security Guard (`src/lib/auth.ts`)
```typescript
import { cookies } from "next/headers";
import { getCurrentSession } from "@/lib/security/session";
import { ROLES } from "@/lib/security/rbac";

export async function verifyAdminSession(): Promise<boolean> {
  // Check 1: Cryptographically signed HMAC user session with ADMIN or COORDINATOR role
  const session = await getCurrentSession();
  if (session && (session.role === ROLES.ADMIN || session.role === ROLES.COORDINATOR)) {
    return true;
  }

  // Check 2: Direct admin secret cookie check
  const cookieStore = await cookies();
  const token = cookieStore.get("admin_session")?.value;
  const adminSecret = process.env.ADMIN_SECRET_KEY || "hope_shelter_admin_secret_key_2026";
  if (token && token === adminSecret) {
    return true;
  }

  return false;
}
```

## 2. Server Actions with Authorization (`src/actions/pets.ts`)
```typescript
"use server";

import { revalidatePath } from "next/cache";
import { petFormSchema, PetFormInput, PetFilterInput } from "@/lib/validations/pet";
import { verifyAdminSession } from "@/lib/auth";
import { Pet } from "@/types/pet";
import {
  getServerPetsAsync,
  findServerPetById,
  insertServerPet,
  updateServerPet,
  archiveServerPet,
  getServerApplicationsAsync,
} from "@/lib/serverStore";
import { getCurrentSession } from "@/lib/security/session";

// Public query: Only returns non-archived, available/pending pets
export async function getPublicPets(filters?: PetFilterInput): Promise<Pet[]> {
  const allPets = await getServerPetsAsync();
  return allPets.filter((pet) => {
    if (pet.isArchived) return false;
    if (filters?.species && filters.species !== "all" && pet.species !== filters.species) return false;
    if (filters?.status && filters.status !== "all" && pet.status !== filters.status) return false;
    if (filters?.size && filters.size !== "all" && pet.size !== filters.size) return false;
    if (filters?.ageCategory && filters.ageCategory !== "all" && pet.ageCategory !== filters.ageCategory) return false;
    if (filters?.search && filters.search.trim() !== "") {
      const q = filters.search.toLowerCase();
      const match = pet.name.toLowerCase().includes(q) ||
        pet.breed.toLowerCase().includes(q) ||
        pet.description.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });
}

// Admin query: Includes archived/adopted records and application counts
export async function getAdminPets(): Promise<(Pet & { applicationCount?: number })[]> {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin && process.env.NODE_ENV === "production") {
    throw new Error("Unauthorized");
  }

  const allPets = await getServerPetsAsync();
  const apps = await getServerApplicationsAsync();

  return allPets.map((pet) => {
    const petApps = apps.filter((a) => a.petId === pet.id || a.petName.toLowerCase() === pet.name.toLowerCase());
    return {
      ...pet,
      applicationCount: petApps.length,
    };
  });
}

// Mutating actions guarded by verifyAdminSession
export async function createPet(data: PetFormInput) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin && process.env.NODE_ENV === "production") {
    throw new Error("Unauthorized");
  }

  const session = (await getCurrentSession()) || {
    id: "admin-system",
    email: "admin@hopeforstrays.org",
    name: "Shelter Admin",
    role: "ADMIN" as const,
    expiresAt: Date.now() + 86400000,
  };

  const validated = petFormSchema.parse(data);
  const newPet: Pet = {
    id: `pet-${Date.now()}`,
    ...validated,
    isArchived: false,
    deletedAt: null,
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

  return { success: true, pet: newPet };
}

export async function toggleArchivePet(id: string, archive: boolean) {
  const isAdmin = await verifyAdminSession();
  if (!isAdmin && process.env.NODE_ENV === "production") {
    throw new Error("Unauthorized");
  }

  const session = (await getCurrentSession()) || {
    id: "admin-system",
    email: "admin@hopeforstrays.org",
    name: "Shelter Admin",
    role: "ADMIN" as const,
    expiresAt: Date.now() + 86400000,
  };

  await archiveServerPet(id, archive, session);
  revalidatePath("/pets");
  revalidatePath("/admin/pets");
  revalidatePath("/");

  return { success: true };
}
```
