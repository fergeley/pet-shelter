import { vi } from "vitest";
import type { DbPetRecord } from "@/lib/server/petMappers";

/**
 * Shared plumbing for Tier 3a — the strict-persistence suites that do *not*
 * require a PostgreSQL server. Not a `*.test.ts` file, so the glob skips it.
 *
 * Tier 3b (`tests/integration/db/`) is the tier that talks to a real database.
 * The split matters: everything here runs under `STRICT_PERSISTENCE=true` with
 * the Prisma *client* doubled, which is what makes it possible to assert the
 * behaviours strict mode exists for — a failing query must propagate rather
 * than silently serve fixtures — without depending on a database being up, and
 * to provoke failures on demand that a healthy database would never produce.
 */

/** The subset of the Prisma client the repositories under test actually call. */
export interface PrismaDouble {
  pet: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  adoptionApplication: {
    findMany: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  auditLog: {
    create: ReturnType<typeof vi.fn>;
    findMany: ReturnType<typeof vi.fn>;
  };
  petUpdate: { deleteMany: ReturnType<typeof vi.fn> };
  medicalTimelineEvent: { deleteMany: ReturnType<typeof vi.fn> };
  user: { findUnique: ReturnType<typeof vi.fn>; findMany: ReturnType<typeof vi.fn>; create: ReturnType<typeof vi.fn> };
  /**
   * Reads only. The FAQ write paths (`create`, `update`, `delete`, and the
   * `$transaction` + `$queryRaw … FOR UPDATE` that reordering uses) have no
   * suite here yet, and a delegate nothing calls is a method that drifts from
   * the shape the repository actually needs. Add them with the test that needs
   * them.
   */
  faq: { findMany: ReturnType<typeof vi.fn> };
  $transaction: ReturnType<typeof vi.fn>;
  $queryRaw: ReturnType<typeof vi.fn>;
  $disconnect: ReturnType<typeof vi.fn>;
}

/**
 * Builds a client double whose reads all resolve empty by default.
 *
 * Empty rather than populated on purpose: `getServerPetsAsync` only trusts the
 * database when it returns at least one row, and falls through to the in-memory
 * fixtures otherwise. Defaulting to empty means a test that forgets to arrange
 * its rows exercises the fallback and fails on a fixture value it never chose,
 * instead of quietly passing against data it did not write.
 *
 * That rationale is about the *pet* reader, not a house rule. `faqRepository`
 * deliberately treats an empty result as an answer — staff have unpublished
 * everything — and falls back only from its `catch`, so for FAQs this default
 * means "nothing published" rather than "arrange your rows". See
 * `faqEmptyPublishSet.test.ts`, which pins that difference.
 */
export function createPrismaDouble(): PrismaDouble {
  return {
    pet: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
    },
    adoptionApplication: {
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn().mockResolvedValue({ count: 0 }),
      delete: vi.fn().mockResolvedValue({}),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
      findMany: vi.fn().mockResolvedValue([]),
    },
    petUpdate: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    medicalTimelineEvent: { deleteMany: vi.fn().mockResolvedValue({ count: 0 }) },
    user: {
      findUnique: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
      create: vi.fn().mockResolvedValue({}),
    },
    faq: { findMany: vi.fn().mockResolvedValue([]) },
    // Mirrors the real interactive form: the callback receives a transaction
    // client, and here that client is the double itself, so a test can assert
    // on the writes a transaction made.
    $transaction: vi.fn(),
    $queryRaw: vi.fn().mockResolvedValue([{ "?column?": 1 }]),
    $disconnect: vi.fn().mockResolvedValue(undefined),
  };
}

/** Wires `$transaction` to run its callback against the double, or to run an array of promises. */
export function wireTransaction(double: PrismaDouble): void {
  double.$transaction.mockImplementation(async (arg: unknown) => {
    if (typeof arg === "function") {
      return (arg as (tx: PrismaDouble) => Promise<unknown>)(double);
    }
    return Promise.all(arg as Promise<unknown>[]);
  });
}

let rowCounter = 0;

/**
 * A complete `pets` row as `prisma.pet.findMany` returns one.
 *
 * Every column the mapper reads is present, so a test states only the field it
 * is about. Nested history defaults to empty arrays because the repository's
 * read always asks for them via `include`.
 */
export function makeDbPet(overrides: Partial<DbPetRecord> = {}): DbPetRecord {
  rowCounter += 1;
  return {
    id: `itest-pet-${rowCounter}`,
    name: `Row${rowCounter}`,
    species: "dog",
    breed: "Local Mixed",
    birthDate: "2024-06-12",
    birthDateIsEstimate: true,
    gender: "Female",
    size: "Medium",
    weight: "18 kg",
    status: "Available",
    adoptionFee: "Free",
    description: "Persisted description.",
    rescueStory: "Persisted rescue story.",
    image: "https://example.test/row.jpg",
    galleryImages: [],
    tags: ["House-Trained"],
    featured: false,
    intakeDate: "2026-06-12",
    rehabStage: null,
    rehabStageMs: null,
    rehabProgressPercent: null,
    vaccinated: true,
    microchipped: true,
    spayedNeutered: true,
    specialNeeds: null,
    goodWithDogs: true,
    goodWithCats: true,
    goodWithKids: true,
    energyLevel: "Moderate",
    isArchived: false,
    deletedAt: null,
    updates: [],
    medicalTimeline: [],
    ...overrides,
  };
}

/**
 * Retrieves the double a file installed via `vi.mock("@/lib/server/prisma")`.
 *
 * The mock factory has to construct the double itself — `vi.mock` is hoisted
 * above every import, so it cannot close over a module-scope value — which
 * leaves importing the mocked module as the only way to get a handle on it.
 */
export async function getPrismaDouble(): Promise<PrismaDouble> {
  const mocked = await import("@/lib/server/prisma");
  return mocked.prisma as unknown as PrismaDouble;
}

/**
 * Restores every method to its default resolution, in place.
 *
 * Mutates the existing object rather than replacing it: the repositories hold
 * the same reference for the lifetime of the module, so a reassignment would
 * leave them talking to the previous test's double.
 */
export function resetPrismaDouble(double: PrismaDouble): void {
  const fresh = createPrismaDouble() as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(fresh)) {
    (double as unknown as Record<string, unknown>)[key] = value;
  }
}
