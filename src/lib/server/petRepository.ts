import initialPetsData from "@/data/pets.json";
import { Pet } from "@/types/pet";
import { validatePetTransition } from "@/lib/domain/stateMachine";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { SessionUser } from "@/lib/security/session";
import { prisma } from "@/lib/server/prisma";
import { handlePersistenceError } from "@/lib/persistenceMode";
import {
  DbPetRecord,
  buildPetCreatePayload,
  buildPetUpdatePayload,
  mapDbPetToPet,
} from "./petMappers";

/**
 * Pet reads and writes over the dual-layer store: Prisma first, the in-memory
 * fixture cache as the fallback.
 *
 * Owns `serverPets` outright. Nothing else may reassign it — the one legitimate
 * cross-domain mutation, the adoption cascade, goes through
 * `markCachedPetAdopted` below.
 */

// In-memory cache for instant reads, SSR, and offline test environments.
//
// Seeded through `structuredClone` rather than a spread: a spread copies the
// array but shares every element with the imported JSON module, so a single
// in-place edit to a pet would corrupt the fixture for the rest of the process
// and survive any reset. Deep-cloning makes `resetServerStore()` genuinely
// restorative, which is what the hermetic test lifecycle depends on.
function freshPets(): Pet[] {
  return structuredClone(initialPetsData) as Pet[];
}

let serverPets: Pet[] = freshPets();

/** Test-only. Reached through `resetServerStore()` in `./fallbackState`. */
export function resetPets(): void {
  serverPets = freshPets();
}

export function getServerPets(): Pet[] {
  return serverPets;
}

export async function getServerPetsAsync(): Promise<Pet[]> {
  try {
    const dbPets = await prisma.pet.findMany({
      orderBy: { createdAt: "desc" },
      // Ordered explicitly: row order is otherwise whatever the planner returns.
      include: {
        updates: { orderBy: { date: "asc" } },
        medicalTimeline: { orderBy: { date: "asc" } },
      },
    });
    if (dbPets && dbPets.length > 0) {
      return (dbPets as unknown as DbPetRecord[]).map(mapDbPetToPet);
    }
  } catch (err) {
    handlePersistenceError("Prisma pet query", err, "read");
  }
  return serverPets;
}

export function findServerPetById(id: string): Pet | null {
  const norm = id.trim().toLowerCase();
  return serverPets.find((p) => p.id.toLowerCase() === norm) || null;
}

/**
 * Marks the cached pet adopted and returns it, or null when no pet matches.
 *
 * The single sanctioned write into the pet cache from outside this module. It
 * exists because approving an adoption application cascades to the pet, and the
 * dependency is deliberately one-way: `applicationRepository` imports this,
 * nothing here imports applications. Audit logging is left to the caller, whose
 * entry references the application that triggered the transition.
 */
export function markCachedPetAdopted(petId: string, petName: string): Pet | null {
  const index = serverPets.findIndex(
    (p) => p.id === petId || p.name.toLowerCase() === petName.toLowerCase()
  );
  if (index === -1) return null;

  serverPets[index] = { ...serverPets[index], status: "Adopted" };
  return serverPets[index];
}

export async function insertServerPet(newPet: Pet, actor: SessionUser): Promise<void> {
  serverPets = [newPet, ...serverPets];

  try {
    await prisma.pet.create({
      data: buildPetCreatePayload(newPet),
    });
  } catch (err) {
    handlePersistenceError("Prisma pet creation", err, "write");
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
    // Clear-then-write, in one transaction. The submitted pet is authoritative
    // for its history: an event that is no longer listed must have its row
    // deleted, not merely left unwritten. Sequencing the deletes ahead of the
    // nested creates also avoids re-inserting an id that still exists, since
    // history rows keep their caller-supplied primary keys.
    await prisma.$transaction([
      prisma.petUpdate.deleteMany({ where: { petId: id } }),
      prisma.medicalTimelineEvent.deleteMany({ where: { petId: id } }),
      prisma.pet.update({
        where: { id },
        data: buildPetUpdatePayload(updated),
      }),
    ]);
  } catch (err) {
    handlePersistenceError("Prisma pet update", err, "write");
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
    handlePersistenceError("Prisma pet archive", err, "write");
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
