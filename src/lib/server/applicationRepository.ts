import initialApplicationsData from "@/data/applications.json";
import { AdoptionApplicationRecord, ApplicationStatus } from "@/types/application";
import { validateApplicationTransition } from "@/lib/domain/stateMachine";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { SessionUser } from "@/lib/security/session";
import { prisma } from "@/lib/server/prisma";
import { handlePersistenceError } from "@/lib/persistenceMode";
import { markCachedPetAdopted } from "./petRepository";

/**
 * Adoption-application reads and writes over the dual-layer store.
 *
 * Depends on `./petRepository` in one direction only: approving an application
 * adopts the pet. Pet writes never touch applications, which is what keeps the
 * two modules acyclic — do not add an import the other way.
 */

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

// Deep-cloned for the same reason as the pet cache — see `./petRepository`.
function freshApplications(): AdoptionApplicationRecord[] {
  return structuredClone(initialApplicationsData) as AdoptionApplicationRecord[];
}

let serverApplications: AdoptionApplicationRecord[] = freshApplications();

/** Test-only. Reached through `resetServerStore()` in `./fallbackState`. */
export function resetApplications(): void {
  serverApplications = freshApplications();
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
    handlePersistenceError("Prisma applications query", err, "read");
  }
  return serverApplications;
}

export function findServerApplicationById(id: string): AdoptionApplicationRecord | null {
  const norm = id.trim().toLowerCase();
  return serverApplications.find((a) => a.id.toLowerCase() === norm) || null;
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
    handlePersistenceError("Prisma application creation", err, "write");
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
    handlePersistenceError("Prisma application status transaction", err, "write");
  }

  // 3. Apply Multi-Entity Update to Cache
  if (targetStatus === "APPROVED") {
    const adoptedPet = markCachedPetAdopted(currentApp.petId, currentApp.petName);

    if (adoptedPet) {
      recordAuditLog({
        actorId: actor.id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "PET_STATUS_TRANSITION_ADOPTED",
        entity: "Pet",
        entityId: adoptedPet.id,
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
    handlePersistenceError("Prisma application delete", err, "write");
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
