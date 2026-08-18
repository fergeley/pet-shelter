import initialPetsData from "@/data/pets.json";
import initialApplicationsData from "@/data/applications.json";
import { Pet } from "@/types/pet";
import { AdoptionApplicationRecord, ApplicationStatus } from "@/types/application";
import { validateApplicationTransition, validatePetTransition } from "./domain/stateMachine";
import { recordAuditLog } from "./domain/auditLog";
import { SessionUser } from "./security/session";
import { prisma } from "./prisma";

export interface DbPetRecord {
  id: string;
  name: string;
  species: string;
  breed: string;
  age: string;
  ageCategory: string;
  gender: string;
  size: string;
  weight: string;
  status: string;
  adoptionFee: string;
  description: string;
  rescueStory: string;
  image: string;
  galleryImages: string[];
  tags: string[];
  featured: boolean;
  intakeDate: string;
  rehabStage: string | null;
  rehabStageMs: string | null;
  rehabProgressPercent: number | null;
  vaccinated: boolean;
  microchipped: boolean;
  spayedNeutered: boolean;
  specialNeeds: string | null;
  goodWithDogs: boolean;
  goodWithCats: boolean;
  goodWithKids: boolean;
  energyLevel: string;
  isArchived: boolean;
  deletedAt: Date | string | null;
}

/**
 * Columns written to the `pets` table. Kept as a named shape so the insert and
 * update paths cannot drift apart when a new column is added.
 */
export interface PetPersistencePayload {
  name: string;
  species: string;
  breed: string;
  age: string;
  ageCategory: string;
  gender: string;
  size: string;
  weight: string;
  status: string;
  adoptionFee: string;
  description: string;
  rescueStory: string;
  image: string;
  galleryImages: string[];
  tags: string[];
  featured: boolean;
  intakeDate: string;
  rehabStage: string | null;
  rehabStageMs: string | null;
  rehabProgressPercent: number | null;
  isArchived: boolean;
  deletedAt: Date | null;
  vaccinated: boolean;
  microchipped: boolean;
  spayedNeutered: boolean;
  specialNeeds: string | null;
  goodWithDogs: boolean;
  goodWithCats: boolean;
  goodWithKids: boolean;
  energyLevel: string;
}

/**
 * Maps a persisted `pets` row onto the domain `Pet` shape. Nullable columns
 * become `undefined` so optional domain fields stay absent rather than null.
 */
export function mapDbPetToPet(p: DbPetRecord): Pet {
  return {
    id: p.id,
    name: p.name,
    species: p.species as Pet["species"],
    breed: p.breed,
    age: p.age,
    ageCategory: p.ageCategory as Pet["ageCategory"],
    gender: p.gender as Pet["gender"],
    size: p.size as Pet["size"],
    weight: p.weight,
    status: p.status as Pet["status"],
    adoptionFee: p.adoptionFee,
    description: p.description,
    rescueStory: p.rescueStory,
    image: p.image,
    galleryImages: p.galleryImages,
    tags: p.tags,
    featured: p.featured,
    intakeDate: p.intakeDate,
    rehabStage: p.rehabStage ?? undefined,
    rehabStageMs: p.rehabStageMs ?? undefined,
    rehabProgressPercent: p.rehabProgressPercent ?? undefined,
    isArchived: p.isArchived ?? false,
    deletedAt: p.deletedAt ? p.deletedAt.toString() : null,
    medical: {
      vaccinated: p.vaccinated,
      microchipped: p.microchipped,
      spayedNeutered: p.spayedNeutered,
      specialNeeds: p.specialNeeds || undefined,
    },
    compatibility: {
      goodWithDogs: p.goodWithDogs,
      goodWithCats: p.goodWithCats,
      goodWithKids: p.goodWithKids,
      energyLevel: p.energyLevel as Pet["compatibility"]["energyLevel"],
    },
  };
}

/**
 * Flattens a domain `Pet` into the column set written by both create and update.
 * The caller's status spelling is preserved verbatim — normalization is a read
 * and comparison concern, not a storage one.
 */
export function buildPetPersistencePayload(pet: Pet): PetPersistencePayload {
  return {
    name: pet.name,
    species: pet.species,
    breed: pet.breed,
    age: pet.age,
    ageCategory: pet.ageCategory,
    gender: pet.gender,
    size: pet.size,
    weight: pet.weight,
    status: pet.status,
    adoptionFee: pet.adoptionFee,
    description: pet.description,
    rescueStory: pet.rescueStory,
    image: pet.image,
    galleryImages: pet.galleryImages || [],
    tags: pet.tags || [],
    featured: pet.featured || false,
    intakeDate: pet.intakeDate,
    rehabStage: pet.rehabStage ?? null,
    rehabStageMs: pet.rehabStageMs ?? null,
    rehabProgressPercent: pet.rehabProgressPercent ?? null,
    isArchived: pet.isArchived ?? false,
    deletedAt: pet.deletedAt ? new Date(pet.deletedAt) : null,
    vaccinated: pet.medical?.vaccinated ?? true,
    microchipped: pet.medical?.microchipped ?? true,
    spayedNeutered: pet.medical?.spayedNeutered ?? true,
    specialNeeds: pet.medical?.specialNeeds || null,
    goodWithDogs: pet.compatibility?.goodWithDogs ?? true,
    goodWithCats: pet.compatibility?.goodWithCats ?? true,
    goodWithKids: pet.compatibility?.goodWithKids ?? true,
    energyLevel: pet.compatibility?.energyLevel || "Moderate",
  };
}

interface DbApplicationRecord {
  id: string;
  petId: string | null;
  petName: string;
  petBreed: string | null;
  applicantName: string;
  email: string;
  phone: string;
  address: string;
  housingType: string;
  hasFencedYard: string;
  currentPets: string;
  currentPetDetails: string | null;
  householdExperience: string;
  applicantNotes: string | null;
  status: string;
  adminReviewNotes: string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

type DbTransaction = {
  adoptionApplication: {
    update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<unknown>;
    updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
  };
  pet: {
    updateMany: (args: { where: Record<string, unknown>; data: Record<string, unknown> }) => Promise<unknown>;
  };
};

// In-memory cache for instant reads, SSR, and offline test environments
let serverPets: Pet[] = [...(initialPetsData as Pet[])];
let serverApplications: AdoptionApplicationRecord[] = [
  ...(initialApplicationsData as AdoptionApplicationRecord[]),
];

export function getServerPets(): Pet[] {
  return serverPets;
}

export async function getServerPetsAsync(): Promise<Pet[]> {
  try {
    const dbPets = await prisma.pet.findMany({
      orderBy: { createdAt: "desc" },
    });
    if (dbPets && dbPets.length > 0) {
      return (dbPets as unknown as DbPetRecord[]).map(mapDbPetToPet);
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Database Store] Prisma pet query falling back to memory store:", err instanceof Error ? err.message : err);
    }
  }
  return serverPets;
}

export function getServerApplications(): AdoptionApplicationRecord[] {
  return serverApplications;
}

export async function getServerApplicationsAsync(): Promise<AdoptionApplicationRecord[]> {
  try {
    const dbApps = await prisma.adoptionApplication.findMany({
      orderBy: { createdAt: "desc" },
    });
    if (dbApps && dbApps.length > 0) {
      return (dbApps as unknown as DbApplicationRecord[]).map((a: DbApplicationRecord) => ({
        id: a.id,
        petId: a.petId || "",
        petName: a.petName,
        petBreed: a.petBreed || undefined,
        applicantName: a.applicantName,
        email: a.email,
        phone: a.phone,
        address: a.address,
        housingType: a.housingType,
        hasFencedYard: a.hasFencedYard,
        currentPets: a.currentPets,
        currentPetDetails: a.currentPetDetails || undefined,
        householdExperience: a.householdExperience,
        applicantNotes: a.applicantNotes || undefined,
        status: a.status as ApplicationStatus,
        adminReviewNotes: a.adminReviewNotes || undefined,
        createdAt: a.createdAt.toString().split("T")[0],
        updatedAt: a.updatedAt.toString().split("T")[0],
      }));
    }
  } catch (err) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[Database Store] Prisma applications query falling back to memory store:", err instanceof Error ? err.message : err);
    }
  }
  return serverApplications;
}

export function findServerPetById(id: string): Pet | null {
  const norm = id.trim().toLowerCase();
  return serverPets.find((p) => p.id.toLowerCase() === norm) || null;
}

export function findServerApplicationById(id: string): AdoptionApplicationRecord | null {
  const norm = id.trim().toLowerCase();
  return serverApplications.find((a) => a.id.toLowerCase() === norm) || null;
}

export async function insertServerPet(newPet: Pet, actor: SessionUser): Promise<void> {
  serverPets = [newPet, ...serverPets];

  try {
    await prisma.pet.create({
      data: {
        id: newPet.id,
        ...buildPetPersistencePayload(newPet),
      },
    });
  } catch (err) {
    console.warn("[Database Store] Prisma pet creation fallback notice:", err instanceof Error ? err.message : err);
  }

  recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "PET_CREATED",
    entity: "Pet",
    entityId: newPet.id,
    details: { name: newPet.name, species: newPet.species, status: newPet.status },
  });
}

export async function updateServerPet(id: string, updated: Pet, actor: SessionUser): Promise<boolean> {
  const index = serverPets.findIndex((p) => p.id === id);
  if (index === -1) return false;

  const previous = serverPets[index];
  if (previous.status !== updated.status) {
    validatePetTransition(previous.status, updated.status);
  }

  serverPets[index] = updated;

  try {
    await prisma.pet.update({
      where: { id },
      data: buildPetPersistencePayload(updated),
    });
  } catch (err) {
    console.warn("[Database Store] Prisma pet update fallback notice:", err instanceof Error ? err.message : err);
  }

  recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "PET_UPDATED",
    entity: "Pet",
    entityId: id,
    details: { before: previous, after: updated },
  });

  return true;
}

export async function archiveServerPet(id: string, archive: boolean, actor: SessionUser): Promise<boolean> {
  const index = serverPets.findIndex((p) => p.id === id);
  if (index === -1) return false;

  const pet = serverPets[index];
  const deletedAt = archive ? new Date().toISOString() : null;
  serverPets[index] = {
    ...pet,
    isArchived: archive,
    deletedAt,
  };

  try {
    await prisma.pet.update({
      where: { id },
      data: {
        isArchived: archive,
        deletedAt: archive ? new Date() : null,
      },
    });
  } catch (err) {
    console.warn("[Database Store] Prisma pet archive fallback notice:", err instanceof Error ? err.message : err);
  }

  recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: archive ? "PET_ARCHIVED" : "PET_RESTORED",
    entity: "Pet",
    entityId: id,
    details: { petName: pet.name, isArchived: archive, deletedAt },
  });

  return true;
}

export async function deleteServerPet(id: string, actor: SessionUser): Promise<boolean> {
  // Perform soft delete (archival) to preserve data integrity and application histories
  return archiveServerPet(id, true, actor);
}

export async function insertServerApplication(newApp: AdoptionApplicationRecord): Promise<void> {
  serverApplications = [newApp, ...serverApplications];

  try {
    await prisma.adoptionApplication.create({
      data: {
        id: newApp.id,
        petId: newApp.petId,
        petName: newApp.petName,
        petBreed: newApp.petBreed || null,
        applicantName: newApp.applicantName,
        email: newApp.email,
        phone: newApp.phone,
        address: newApp.address,
        housingType: newApp.housingType,
        hasFencedYard: newApp.hasFencedYard,
        currentPets: newApp.currentPets,
        currentPetDetails: newApp.currentPetDetails || null,
        householdExperience: newApp.householdExperience,
        applicantNotes: newApp.applicantNotes || null,
        status: newApp.status,
        adminReviewNotes: newApp.adminReviewNotes || null,
      },
    });
  } catch (err) {
    console.warn("[Database Store] Prisma application creation fallback notice:", err instanceof Error ? err.message : err);
  }

  recordAuditLog({
    actorId: "public_user",
    actorEmail: newApp.email,
    actorRole: "PUBLIC",
    action: "APPLICATION_SUBMITTED",
    entity: "AdoptionApplication",
    entityId: newApp.id,
    details: { petId: newApp.petId, petName: newApp.petName, applicantName: newApp.applicantName },
  });
}

/**
 * Atomic status update with State Machine enforcement, Prisma interactive multi-entity cascade, and Audit Trail.
 * If status is APPROVED, automatically adopts the pet and rejects competing applications.
 */
export async function atomicUpdateApplicationStatus(
  applicationId: string,
  targetStatus: ApplicationStatus,
  notes: string | undefined,
  actor: SessionUser
): Promise<{ success: boolean; error?: string }> {
  const appIndex = serverApplications.findIndex((a) => a.id === applicationId);
  if (appIndex === -1) {
    return { success: false, error: "Application not found" };
  }

  const currentApp = serverApplications[appIndex];
  const oldStatus = currentApp.status;

  // 1. Finite State Machine Validation
  try {
    validateApplicationTransition(oldStatus, targetStatus);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid status transition";
    return { success: false, error: msg };
  }

  const today = new Date().toISOString().split("T")[0];

  // 2. Try Prisma Interactive Transaction ($transaction)
  try {
    await prisma.$transaction(async (tx: unknown) => {
      const dbTx = tx as DbTransaction;
      // Update target application
      await dbTx.adoptionApplication.update({
        where: { id: applicationId },
        data: {
          status: targetStatus,
          adminReviewNotes: notes !== undefined ? notes : currentApp.adminReviewNotes,
        },
      });

      // If APPROVED, cascade to Pet and auto-reject conflicting applications
      if (targetStatus === "APPROVED") {
        await dbTx.pet.updateMany({
          where: { id: currentApp.petId },
          data: { status: "Adopted" },
        });

        await dbTx.adoptionApplication.updateMany({
          where: {
            petId: currentApp.petId,
            id: { not: applicationId },
            status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
          },
          data: {
            status: "REJECTED",
            adminReviewNotes: `Automatically closed: ${currentApp.petName} was adopted by an approved applicant on ${today}.`,
          },
        });
      }
    });
  } catch (err) {
    console.warn("[Database Store] Prisma transaction fallback notice:", err instanceof Error ? err.message : err);
  }

  // 3. Apply Multi-Entity Update to Cache
  if (targetStatus === "APPROVED") {
    const petIndex = serverPets.findIndex(
      (p) => p.id === currentApp.petId || p.name.toLowerCase() === currentApp.petName.toLowerCase()
    );

    if (petIndex !== -1) {
      const pet = serverPets[petIndex];
      serverPets[petIndex] = {
        ...pet,
        status: "Adopted",
      };

      recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "PET_STATUS_TRANSITION_ADOPTED",
        entity: "Pet",
        entityId: pet.id,
        details: { adoptionApplicationId: applicationId, applicant: currentApp.applicantName },
      });
    }

    // Auto-reject any other active applications for this pet
    serverApplications = serverApplications.map((otherApp) => {
      if (
        otherApp.id !== applicationId &&
        (otherApp.petId === currentApp.petId ||
          otherApp.petName.toLowerCase() === currentApp.petName.toLowerCase()) &&
        (otherApp.status === "SUBMITTED" || otherApp.status === "UNDER_REVIEW")
      ) {
        recordAuditLog({
          actorId: actor.id,
          actorEmail: actor.email,
          actorRole: actor.role,
          action: "APPLICATION_AUTO_REJECTED_DUE_TO_ADOPTION",
          entity: "AdoptionApplication",
          entityId: otherApp.id,
          details: { approvedApplicationId: applicationId, petId: currentApp.petId },
        });

        return {
          ...otherApp,
          status: "REJECTED" as ApplicationStatus,
          adminReviewNotes: `Automatically closed: ${currentApp.petName} was adopted by an approved applicant on ${today}.`,
          updatedAt: today,
        };
      }
      return otherApp;
    });
  }

  // Update target application in memory
  serverApplications[appIndex] = {
    ...serverApplications[appIndex],
    status: targetStatus,
    adminReviewNotes: notes !== undefined ? notes : currentApp.adminReviewNotes,
    updatedAt: today,
  };

  recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: `APPLICATION_STATUS_${targetStatus}`,
    entity: "AdoptionApplication",
    entityId: applicationId,
    details: { before: oldStatus, after: targetStatus, notes },
  });

  return { success: true };
}

export async function deleteServerApplication(id: string, actor: SessionUser): Promise<boolean> {
  const index = serverApplications.findIndex((a) => a.id === id);
  if (index === -1) return false;

  const removed = serverApplications[index];
  serverApplications = serverApplications.filter((a) => a.id !== id);

  try {
    await prisma.adoptionApplication.delete({
      where: { id },
    });
  } catch (err) {
    console.warn("[Database Store] Prisma application delete fallback notice:", err instanceof Error ? err.message : err);
  }

  recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "APPLICATION_DELETED",
    entity: "AdoptionApplication",
    entityId: id,
    details: { applicantName: removed.applicantName, petName: removed.petName },
  });

  return true;
}
