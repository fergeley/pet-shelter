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
 * Ordering invariant for every write path: **database first, mirror second.**
 * The in-memory fixture store is a fallback read source, never a source of
 * truth — it is only mutated *after* the database confirms the write (or when
 * no database is configured). A cache entry can therefore never describe a
 * state the database refused.
 *
 * Deterministic storage strategy:
 * - When DATABASE_URL is set / active: pure Prisma persistence with ACID guarantees.
 * - When offline / test mode: isolated in-memory fixture store for fast zero-dependency runs.
 */

const PET_INCLUDE = {
  updates: { orderBy: { date: "asc" as const } },
  medicalTimeline: {
    orderBy: { date: "asc" as const },
    include: { vet: true },
  },
} as const;

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

/**
 * Lists all pets.
 *
 * An empty result is a *valid answer* — a freshly provisioned or fully archived
 * database genuinely has no pets — and is returned as `[]` rather than treated
 * as a failure. Only a thrown query error falls back, via the shared decision
 * point, to the in-memory store.
 */
export async function getServerPetsAsync(): Promise<Pet[]> {
  try {
    const dbPets = await prisma.pet.findMany({
      orderBy: { createdAt: "desc" },
      include: PET_INCLUDE,
    });
    return dbPets.map((row) => mapDbPetToPet(row as unknown as DbPetRecord));
  } catch (err) {
    handlePersistenceError("Prisma pet query", err, "read");
    return serverPets;
  }
}

/**
 * Reads an animal's stored gallery straight from the database.
 *
 * The in-memory store is seeded from fixtures and mutated only by writes this
 * process handled — it cannot be the baseline for "which photos are new":
 * another instance's uploads are invisible to it, so those photos would look
 * new again and supporters are mailed them a second time. Only the database
 * can answer this question.
 *
 * Returns null when the row does not exist. Read failures are routed through
 * the shared persistence decision point (strict mode rethrows) before falling
 * back to null, so the caller's fallback is never reached silently.
 */
export async function getStoredGalleryImages(id: string): Promise<string[] | null> {
  try {
    const row = await prisma.pet.findUnique({
      where: { id },
      select: { galleryImages: true },
    });
    return row ? row.galleryImages : null;
  } catch (err) {
    handlePersistenceError("Prisma gallery read", err, "read");
    return null;
  }
}

export function findServerPetById(id: string): Pet | null {
  const norm = id.trim().toLowerCase();
  return serverPets.find((p) => p.id.toLowerCase() === norm) || null;
}

/**
 * Marks the cached pet adopted and returns it, or null when no pet matches.
 *
 * Replace-on-write: the mirror array is never mutated in place, so concurrent
 * readers never observe a partially-updated entry.
 */
export function markCachedPetAdopted(petId: string, petName: string): Pet | null {
  const target = serverPets.find(
    (p) => p.id === petId || p.name.toLowerCase() === petName.toLowerCase()
  );
  if (!target) return null;
  const adopted = { ...target, status: "Adopted" as const };
  serverPets = serverPets.map((p) => (p.id === target.id ? adopted : p));
  return adopted;
}

export async function insertServerPet(newPet: Pet, actor: SessionUser): Promise<void> {
  // DB first: a refused write must not leave the mirror ahead of the database.
  try {
    await prisma.pet.create({
      data: buildPetCreatePayload(newPet),
    });
  } catch (err) {
    handlePersistenceError("Prisma pet creation", err, "write");
    // Unique violations rethrow (see persistenceMode) — never mirror a conflicted id.
  }

  serverPets = [newPet, ...serverPets.filter((p) => p.id !== newPet.id)];

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
  const previous = serverPets.find((p) => p.id === id);
  if (!previous) return false;

  if (previous.status !== updated.status) {
    validatePetTransition(previous.status, updated.status);
  }

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

  serverPets = serverPets.map((p) => (p.id === id ? updated : p));

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
  const pet = serverPets.find((p) => p.id === id);
  if (!pet) return false;

  // One timestamp for all three representations (column, mirror, audit log) —
  // calling `new Date()` per site can straddle a boundary and disagree.
  const deletedAt = archive ? new Date() : null;

  try {
    await prisma.pet.update({
      where: { id },
      data: { isArchived: archive, deletedAt },
    });
  } catch (err) {
    handlePersistenceError("Prisma pet archive", err, "write");
  }

  serverPets = serverPets.map((p) =>
    p.id === id ? { ...p, isArchived: archive, deletedAt: deletedAt?.toISOString() ?? null } : p
  );

  recordAuditLog({
    actorId: actor.id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: archive ? "PET_ARCHIVED" : "PET_RESTORED",
    entity: "Pet",
    entityId: id,
    details: { petName: pet.name, isArchived: archive, deletedAt: deletedAt?.toISOString() ?? null },
  });

  return true;
}

export async function deleteServerPet(id: string, actor: SessionUser): Promise<boolean> {
  return archiveServerPet(id, true, actor);
}
