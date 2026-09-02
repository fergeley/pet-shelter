import initialPetsData from "@/data/pets.json";
import { Pet } from "@/types/pet";
import { validatePetTransition } from "@/lib/domain/stateMachine";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { SessionUser } from "@/lib/security/session";
import { prisma } from "@/lib/server/prisma";
import { handlePersistenceError } from "@/lib/persistenceMode";
import { withDerivedAge } from "@/lib/domain/petAge";
import {
  DbPetRecord,
  buildPetCreatePayload,
  buildPetUpdatePayload,
  mapDbPetToPet,
} from "./petMappers";

/**
 * Pet reads and writes over the repository layer.
 *
 * Deterministic storage strategy:
 * - When DATABASE_URL is set / active: pure Prisma persistence with ACID guarantees.
 * - When offline / test mode: isolated in-memory fixture store for fast zero-dependency runs.
 */

function freshPets(): Pet[] {
  // Ages are recomputed on load: the fixture's stored `age` strings are frozen prose and rot
  // against the calendar, so the fallback store would otherwise disagree with the DB path (PS-114).
  return (structuredClone(initialPetsData) as Pet[]).map((pet) => withDerivedAge(pet));
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
      include: {
        updates: { orderBy: { date: "asc" } },
        medicalTimeline: {
          orderBy: { date: "asc" },
          include: { vet: true },
        },
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

/**
 * Reads an animal's stored gallery straight from the database.
 *
 * `findServerPetById` answers from `serverPets`, which is seeded from fixtures
 * and mutated only by writes this process handled — `getServerPetsAsync` returns
 * database rows without ever writing them back. Harmless for display, but it
 * cannot be the baseline for "which photos are new": another instance's uploads
 * are invisible to it, so those photos look new again and supporters are mailed
 * them a second time.
 *
 * Returns null when the row cannot be read, leaving the caller to fall back.
 */
export async function getStoredGalleryImages(id: string): Promise<string[] | null> {
  try {
    const row = await prisma.pet.findUnique({
      where: { id },
      select: { galleryImages: true },
    });
    return row ? row.galleryImages : null;
  } catch {
    return null;
  }
}

export function findServerPetById(id: string): Pet | null {
  const norm = id.trim().toLowerCase();
  return serverPets.find((p) => p.id.toLowerCase() === norm) || null;
}

/**
 * Marks the cached pet adopted and returns it, or null when no pet matches.
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
  return archiveServerPet(id, true, actor);
}
