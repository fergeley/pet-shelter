import initialPetsData from "@/data/pets.json";
import initialApplicationsData from "@/data/applications.json";
import { MedicalTimelineEvent, Pet, PetUpdate } from "@/types/pet";
import { AdoptionApplicationRecord, ApplicationStatus } from "@/types/application";
import { validateApplicationTransition, validatePetTransition } from "./domain/stateMachine";
import { recordAuditLog } from "./domain/auditLog";
import { SessionUser } from "./security/session";
import { prisma } from "./prisma";
import { handlePersistenceError } from "./persistenceMode";

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
  // Nested history. Absent unless the read asked for it via `include`.
  updates?: DbPetUpdateRecord[];
  medicalTimeline?: DbMedicalTimelineEventRecord[];
}

/** A persisted `pet_updates` row. */
export interface DbPetUpdateRecord {
  id: string;
  petId: string;
  date: string;
  title: string;
  titleMs: string | null;
  content: string;
  contentMs: string | null;
  image: string | null;
  category: string | null;
}

/** A persisted `medical_timeline_events` row. */
export interface DbMedicalTimelineEventRecord {
  id: string;
  petId: string;
  date: string;
  title: string;
  titleMs: string | null;
  category: string;
  description: string;
  descriptionMs: string | null;
  veterinarian: string | null;
  verified: boolean;
  badge: string | null;
  badgeMs: string | null;
}

/**
 * Columns written to the `pets` table. Kept as a named shape so the insert and
 * update paths cannot drift apart when a new column is added.
 *
 * Scalars only. Nested history cannot travel in a flat column set — see
 * `buildPetHistoryNestedCreate` and the two payload builders below it.
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
 * Ascending comparison on a `YYYY-MM-DD` string. Lexical order and calendar
 * order coincide for that format, so no `Date` parsing is needed.
 */
function byDateAscending(a: { date: string }, b: { date: string }): number {
  return a.date.localeCompare(b.date);
}

/**
 * Maps a history relation onto its domain shape, ordered by date.
 *
 * Returns `undefined` rather than `[]` for a pet with no rows, so a pet without
 * stored history is indistinguishable from a fixture that never had any — which
 * is what keeps `getPetMedicalTimeline`'s synthetic fallback firing.
 */
function mapHistoryRows<TRow extends { date: string }, TEvent>(
  rows: TRow[] | undefined,
  map: (row: TRow) => TEvent
): TEvent[] | undefined {
  if (!rows || rows.length === 0) return undefined;
  return [...rows].sort(byDateAscending).map(map);
}

function mapDbPetUpdate(row: DbPetUpdateRecord): PetUpdate {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    titleMs: row.titleMs ?? undefined,
    content: row.content,
    contentMs: row.contentMs ?? undefined,
    image: row.image ?? undefined,
    category: (row.category ?? undefined) as PetUpdate["category"],
  };
}

function mapDbMedicalTimelineEvent(row: DbMedicalTimelineEventRecord): MedicalTimelineEvent {
  return {
    id: row.id,
    date: row.date,
    title: row.title,
    titleMs: row.titleMs ?? undefined,
    category: row.category as MedicalTimelineEvent["category"],
    description: row.description,
    descriptionMs: row.descriptionMs ?? undefined,
    veterinarian: row.veterinarian ?? undefined,
    verified: row.verified,
    badge: row.badge ?? undefined,
    badgeMs: row.badgeMs ?? undefined,
  };
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
    updates: mapHistoryRows(p.updates, mapDbPetUpdate),
    medicalTimeline: mapHistoryRows(p.medicalTimeline, mapDbMedicalTimelineEvent),
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

/** A row written to `pet_updates`. `petId` comes from the nesting parent. */
export interface PetUpdatePersistenceRow {
  id: string;
  date: string;
  title: string;
  titleMs: string | null;
  content: string;
  contentMs: string | null;
  image: string | null;
  category: string | null;
}

/** A row written to `medical_timeline_events`. `petId` comes from the nesting parent. */
export interface MedicalTimelineEventPersistenceRow {
  id: string;
  date: string;
  title: string;
  titleMs: string | null;
  category: string;
  description: string;
  descriptionMs: string | null;
  veterinarian: string | null;
  verified: boolean;
  badge: string | null;
  badgeMs: string | null;
}

/** The nested-relation half of a pet write. */
export interface PetHistoryNestedCreate {
  updates: { create: PetUpdatePersistenceRow[] };
  medicalTimeline: { create: MedicalTimelineEventPersistenceRow[] };
}

export type PetCreatePayload = PetPersistencePayload & PetHistoryNestedCreate & { id: string };
export type PetUpdatePayload = PetPersistencePayload & PetHistoryNestedCreate;

/**
 * Flattens the two nested history collections into Prisma nested `create`s.
 *
 * Shared by both write paths so the column mapping cannot drift between them,
 * exactly as `buildPetPersistencePayload` does for the scalars. What the two
 * paths genuinely differ on is *clearing*: create starts from nothing, update
 * must delete the previous rows first — see `updateServerPet`.
 */
export function buildPetHistoryNestedCreate(pet: Pet): PetHistoryNestedCreate {
  return {
    updates: {
      create: (pet.updates ?? []).map((u) => ({
        id: u.id,
        date: u.date,
        title: u.title,
        titleMs: u.titleMs ?? null,
        content: u.content,
        contentMs: u.contentMs ?? null,
        image: u.image ?? null,
        category: u.category ?? null,
      })),
    },
    medicalTimeline: {
      create: (pet.medicalTimeline ?? []).map((e) => ({
        id: e.id,
        date: e.date,
        title: e.title,
        titleMs: e.titleMs ?? null,
        category: e.category,
        description: e.description,
        descriptionMs: e.descriptionMs ?? null,
        veterinarian: e.veterinarian ?? null,
        verified: e.verified,
        badge: e.badge ?? null,
        badgeMs: e.badgeMs ?? null,
      })),
    },
  };
}

/** Everything `prisma.pet.create` needs: the id, the scalars, and nested history. */
export function buildPetCreatePayload(pet: Pet): PetCreatePayload {
  return {
    id: pet.id,
    ...buildPetPersistencePayload(pet),
    ...buildPetHistoryNestedCreate(pet),
  };
}

/**
 * Everything `prisma.pet.update` needs. The id is not written — it addresses
 * the row — and the previous history rows are removed by the surrounding
 * transaction rather than here, so this stays a pure projection of the pet.
 */
export function buildPetUpdatePayload(pet: Pet): PetUpdatePayload {
  return {
    ...buildPetPersistencePayload(pet),
    ...buildPetHistoryNestedCreate(pet),
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

function freshApplications(): AdoptionApplicationRecord[] {
  return structuredClone(initialApplicationsData) as AdoptionApplicationRecord[];
}

let serverPets: Pet[] = freshPets();
let serverApplications: AdoptionApplicationRecord[] = freshApplications();

/**
 * Restores both in-memory collections to the committed JSON fixtures.
 *
 * Test-only, mirroring `resetUserStore()`. Wired into the global `beforeEach`
 * in `tests/setup/nextMocks.ts` so a mutation made by one test — an inserted
 * pet, an approved application, an archived record — cannot leak into the next
 * and make the suite order-dependent.
 */
export function resetServerStore(): void {
  serverPets = freshPets();
  serverApplications = freshApplications();
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
