import initialApplicationsData from "@/data/applications.json";
import { AdoptionApplicationRecord, ApplicationStatus } from "@/types/application";
import { validateApplicationTransition } from "@/lib/domain/stateMachine";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { SessionUser } from "@/lib/security/session";
import { prisma } from "@/lib/server/prisma";
import { handlePersistenceError, isDatabasePersistent } from "@/lib/persistenceMode";
import { markCachedPetAdopted } from "./petRepository";

/**
 * Internal signal distinguishing "the caller asked for an illegal transition or
 * lost a race" from "the database is unreachable". The former is a user-facing
 * answer; the latter routes through handlePersistenceError.
 */
class TransitionError extends Error {}

/**
 * Adoption-application reads and writes over the repository layer.
 *
 * Ordering invariant (mirrors ./petRepository): **database first, mirror
 * second.** The in-memory store is a fallback read source only; it is written
 * after the database confirms, and reads never overwrite it wholesale — a read
 * that did would race concurrent inserts and silently drop just-submitted
 * applications.
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

/**
 * A `Date | string` column reduced to a `YYYY-MM-DD` domain string.
 *
 * `toString().split("T")[0]` is locale-fragile for real `Date` objects (whose
 * `toString()` is "Mon Jan 05 ..."), so this always goes through the ISO form.
 */
function toDayString(value: Date | string): string {
  return new Date(value).toISOString().slice(0, 10);
}

function mapDbApplicationToRecord(a: DbApplicationRecord): AdoptionApplicationRecord {
  return {
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
    createdAt: toDayString(a.createdAt),
    updatedAt: toDayString(a.updatedAt),
  };
}

export async function getServerApplicationsAsync(): Promise<AdoptionApplicationRecord[]> {
  if (isDatabasePersistent()) {
    try {
      const dbApps = await prisma.adoptionApplication.findMany({
        orderBy: { createdAt: "desc" },
      });
      return dbApps.map((a) => mapDbApplicationToRecord(a as unknown as DbApplicationRecord));
    } catch (err) {
      handlePersistenceError("Prisma applications query", err, "read");
      return serverApplications;
    }
  }
  return serverApplications;
}

export function findServerApplicationById(id: string): AdoptionApplicationRecord | null {
  const norm = id.trim().toLowerCase();
  return serverApplications.find((a) => a.id.toLowerCase() === norm) || null;
}

/**
 * Reads one application from the database. Pure read: a successful fetch is
 * *returned*, never pushed into the mirror — cache coherence must not be a
 * side effect of a find.
 */
export async function findServerApplicationByIdAsync(id: string): Promise<AdoptionApplicationRecord | null> {
  if (isDatabasePersistent()) {
    try {
      const dbApp = await prisma.adoptionApplication.findUnique({ where: { id } });
      if (dbApp) return mapDbApplicationToRecord(dbApp as unknown as DbApplicationRecord);
    } catch (err) {
      handlePersistenceError("Prisma find application by id", err, "read");
      return findServerApplicationById(id); // DB unreachable: fall back to the mirror.
    }
  }
  return findServerApplicationById(id);
}

export async function insertServerApplication(newApp: AdoptionApplicationRecord): Promise<void> {
  if (isDatabasePersistent()) {
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
      // Unique violations rethrow — a duplicate submission must reach the caller, not the mirror.
    }
  }

  serverApplications = [newApp, ...serverApplications.filter((a) => a.id !== newApp.id)];

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
 * Atomic status update with FSM enforcement, a single ACID Prisma transaction,
 * and audit trail.
 *
 * The authoritative pre-state is read from the **database inside the
 * transaction** — never from the mirror — so two concurrent writers cannot both
 * validate against the same stale status and both "succeed". The transition
 * guard is enforced twice: once for a human-readable error, and once as a
 * conditional `updateMany` (`where status = oldStatus`) inside the transaction,
 * which races-loses return zero affected rows on.
 *
 * Failure semantics: if the transaction fails, the function returns
 * `{ success: false }` and touches *nothing* — no mirror mutation, no cascade,
 * no audit entry. The caller must never be told an approval succeeded while the
 * database says otherwise, and the auto-reject cascade must never run for a pet
 * the database did not actually mark Adopted.
 */
export async function atomicUpdateApplicationStatus(
  applicationId: string,
  targetStatus: ApplicationStatus,
  notes: string | undefined,
  actor: SessionUser
): Promise<{ success: boolean; error?: string }> {
  let appIndex = serverApplications.findIndex((a) => a.id === applicationId);
  if (appIndex === -1 && isDatabasePersistent()) {
    const fetched = await findServerApplicationByIdAsync(applicationId);
    if (fetched) {
      serverApplications = [fetched, ...serverApplications.filter((a) => a.id !== fetched.id)];
      appIndex = serverApplications.findIndex((a) => a.id === applicationId);
    }
  }

  const inMemoryApp = appIndex !== -1 ? serverApplications[appIndex] : null;
  if (!inMemoryApp && !isDatabasePersistent()) {
    return { success: false, error: "Application not found" };
  }

  if (inMemoryApp) {
    try {
      validateApplicationTransition(inMemoryApp.status, targetStatus);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Invalid status transition";
      return { success: false, error: msg };
    }
  }

  const today = toDayString(new Date());

  if (isDatabasePersistent()) {
    try {
      await prisma.$transaction(async (tx) => {
        const current = await tx.adoptionApplication.findUnique({
          where: { id: applicationId },
        });
        if (!current) throw new Error("Application not found");

        const oldStatus = current.status as ApplicationStatus;
        validateApplicationTransition(oldStatus, targetStatus);

        const updated = await tx.adoptionApplication.updateMany({
          where: { id: applicationId, status: oldStatus },
          data: {
            status: targetStatus,
            adminReviewNotes: notes !== undefined ? notes : current.adminReviewNotes,
            updatedAt: new Date(),
          },
        });
        if (updated.count === 0) {
          throw new TransitionError(
            "Application was modified concurrently; reload and retry"
          );
        }

        if (targetStatus === "APPROVED" && current.petId) {
          await tx.pet.updateMany({
            where: { id: current.petId },
            data: { status: "Adopted" },
          });

          await tx.adoptionApplication.updateMany({
            where: {
              petId: current.petId,
              id: { not: applicationId },
              status: { in: ["SUBMITTED", "UNDER_REVIEW"] },
            },
            data: {
              status: "REJECTED",
              adminReviewNotes: `Automatically closed: ${current.petName} was adopted by an approved applicant on ${today}.`,
            },
          });
        }
      });
    } catch (err) {
      if (err instanceof TransitionError) {
        return { success: false, error: err.message };
      }
      handlePersistenceError("Prisma application status transaction", err, "write");
      return { success: false, error: err instanceof Error ? err.message : "Persistence failed" };
    }
  }

  if (appIndex === -1) {
    appIndex = serverApplications.findIndex((a) => a.id === applicationId);
  }
  if (appIndex === -1) {
    return { success: false, error: "Application not found" };
  }

  const currentApp = serverApplications[appIndex];
  const oldStatus = currentApp.status;

  if (targetStatus === "APPROVED") {
    const adoptedPet = markCachedPetAdopted(currentApp.petId ?? "", currentApp.petName);
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

  serverApplications = serverApplications.map((a) =>
    a.id === applicationId
      ? {
          ...a,
          status: targetStatus,
          adminReviewNotes: notes !== undefined ? notes : a.adminReviewNotes,
          updatedAt: today,
        }
      : a
  );

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
  let removed: AdoptionApplicationRecord | undefined = serverApplications.find((a) => a.id === id);

  if (isDatabasePersistent()) {
    try {
      if (!removed) {
        const dbApp = await prisma.adoptionApplication.findUnique({ where: { id } });
        removed = dbApp ? mapDbApplicationToRecord(dbApp as unknown as DbApplicationRecord) : undefined;
      }
      if (!removed) return false;

      await prisma.adoptionApplication.delete({ where: { id } });
    } catch (err) {
      handlePersistenceError("Prisma application delete", err, "write");
      return false;
    }
  } else if (!removed) {
    return false;
  }

  serverApplications = serverApplications.filter((a) => a.id !== id);

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