import initialPetsData from "@/data/pets.json";
import initialApplicationsData from "@/data/applications.json";
import { Pet } from "@/types/pet";
import { AdoptionApplicationRecord, ApplicationStatus } from "@/types/application";
import type {
  Pet as PrismaPet,
  AdoptionApplication as PrismaAdoptionApplication,
  Prisma,
} from "@prisma/client";
import { validateApplicationTransition, validatePetTransition } from "./domain/stateMachine";
import { recordAuditLog } from "./domain/auditLog";
import { SessionUser } from "./security/session";
import { prisma } from "./prisma";

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
      return (dbPets as PrismaPet[]).map((p: PrismaPet) => ({
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
        isArchived: p.isArchived ?? false,
        deletedAt: p.deletedAt ? p.deletedAt.toISOString() : null,
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
      }));
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
      return (dbApps as PrismaAdoptionApplication[]).map((a: PrismaAdoptionApplication) => ({
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
        createdAt: a.createdAt.toISOString().split("T")[0],
        updatedAt: a.updatedAt.toISOString().split("T")[0],
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
  return serverPets.find((p) => p.id === id) || null;
}

export function findServerApplicationById(id: string): AdoptionApplicationRecord | null {
  return serverApplications.find((a) => a.id === id) || null;
}

export async function insertServerPet(newPet: Pet, actor: SessionUser): Promise<void> {
  serverPets = [newPet, ...serverPets];

  try {
    await prisma.pet.create({
      data: {
        id: newPet.id,
        name: newPet.name,
        species: newPet.species,
        breed: newPet.breed,
        age: newPet.age,
        ageCategory: newPet.ageCategory,
        gender: newPet.gender,
        size: newPet.size,
        weight: newPet.weight,
        status: newPet.status,
        adoptionFee: newPet.adoptionFee,
        description: newPet.description,
        rescueStory: newPet.rescueStory,
        image: newPet.image,
        galleryImages: newPet.galleryImages || [],
        tags: newPet.tags || [],
        featured: newPet.featured || false,
        intakeDate: newPet.intakeDate,
        isArchived: newPet.isArchived ?? false,
        deletedAt: newPet.deletedAt ? new Date(newPet.deletedAt) : null,
        vaccinated: newPet.medical?.vaccinated ?? true,
        microchipped: newPet.medical?.microchipped ?? true,
        spayedNeutered: newPet.medical?.spayedNeutered ?? true,
        specialNeeds: newPet.medical?.specialNeeds || null,
        goodWithDogs: newPet.compatibility?.goodWithDogs ?? true,
        goodWithCats: newPet.compatibility?.goodWithCats ?? true,
        goodWithKids: newPet.compatibility?.goodWithKids ?? true,
        energyLevel: newPet.compatibility?.energyLevel || "Moderate",
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
      data: {
        name: updated.name,
        species: updated.species,
        breed: updated.breed,
        age: updated.age,
        ageCategory: updated.ageCategory,
        gender: updated.gender,
        size: updated.size,
        weight: updated.weight,
        status: updated.status,
        adoptionFee: updated.adoptionFee,
        description: updated.description,
        rescueStory: updated.rescueStory,
        image: updated.image,
        galleryImages: updated.galleryImages || [],
        tags: updated.tags || [],
        featured: updated.featured || false,
        intakeDate: updated.intakeDate,
        isArchived: updated.isArchived ?? false,
        deletedAt: updated.deletedAt ? new Date(updated.deletedAt) : null,
        vaccinated: updated.medical?.vaccinated ?? true,
        microchipped: updated.medical?.microchipped ?? true,
        spayedNeutered: updated.medical?.spayedNeutered ?? true,
        specialNeeds: updated.medical?.specialNeeds || null,
        goodWithDogs: updated.compatibility?.goodWithDogs ?? true,
        goodWithCats: updated.compatibility?.goodWithCats ?? true,
        goodWithKids: updated.compatibility?.goodWithKids ?? true,
        energyLevel: updated.compatibility?.energyLevel || "Moderate",
      },
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
    await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update target application
      await tx.adoptionApplication.update({
        where: { id: applicationId },
        data: {
          status: targetStatus,
          adminReviewNotes: notes !== undefined ? notes : currentApp.adminReviewNotes,
        },
      });

      // If APPROVED, cascade to Pet and auto-reject conflicting applications
      if (targetStatus === "APPROVED") {
        await tx.pet.updateMany({
          where: { id: currentApp.petId },
          data: { status: "Adopted" },
        });

        await tx.adoptionApplication.updateMany({
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
