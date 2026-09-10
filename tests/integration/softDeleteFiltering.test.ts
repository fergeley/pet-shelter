import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import {
  getPrismaDouble,
  makeDbPet,
  resetPrismaDouble,
  type PrismaDouble,
} from "./support/prismaDouble";
import { signInAs } from "../setup/authSession";

/**
 * Tier 3a — soft-delete filtering under `STRICT_PERSISTENCE=true`.
 *
 * The point of this tier is that a *persisted* archive flag decides what the
 * public catalogue shows. Tier 2 already covers the pure predicates; what it
 * cannot cover is the join between the repository read, the mapper, and the
 * action's filter — the path where a renamed column or a dropped `include`
 * would otherwise be absorbed by the in-memory fallback and reported green.
 */

/**
 * An async factory, because `vi.mock` is hoisted above this file's imports and
 * so cannot close over anything at module scope. Building the double inside it
 * and reading it back with `getPrismaDouble()` is what gives the tests a handle.
 */
vi.mock("@/lib/server/prisma", async () => {
  const { createPrismaDouble } = await import("./support/prismaDouble");
  const double = createPrismaDouble();
  return { prisma: double, default: double, disconnectPrisma: vi.fn().mockResolvedValue(undefined) };
});

let prismaDouble: PrismaDouble;

beforeAll(async () => {
  prismaDouble = await getPrismaDouble();
});

const ARCHIVED = makeDbPet({
  id: "itest-archived",
  name: "Archived Rescue",
  isArchived: true,
  deletedAt: "2026-08-01T00:00:00.000Z",
});
const ACTIVE = makeDbPet({ id: "itest-active", name: "Active Rescue", isArchived: false });
const REHAB = makeDbPet({
  id: "itest-rehab",
  name: "Rehab Rescue",
  status: "In Rehabilitation",
  rehabStage: "Recovery",
  rehabStageMs: "Pemulihan",
  rehabProgressPercent: 60,
});

/** Arranges the persisted catalogue the repository will read. */
function givenPersistedPets(rows = [ACTIVE, ARCHIVED, REHAB]) {
  prismaDouble.pet.findMany.mockResolvedValue(rows);
}

beforeEach(() => {
  resetPrismaDouble(prismaDouble);
});

describe("soft-delete filtering under strict persistence", () => {
  it("runs with the fallback disabled", async () => {
    const { isStrictPersistence } = await import("@/lib/persistenceMode");

    // Guards every assertion below. Without strict mode a failing query would
    // be swallowed and served from fixtures, and each test would still pass.
    expect(isStrictPersistence()).toBe(true);
  });

  describe("public catalogue", () => {
    it("serves persisted rows rather than the bundled fixtures", async () => {
      givenPersistedPets();
      const { getPublicPets } = await import("@/actions/pets");

      const pets = await getPublicPets();

      // `pets.json` contains none of these names, so matching them proves the
      // read reached the repository and the mapper rather than the fallback.
      expect(pets.map((p) => p.name)).toEqual(["Active Rescue", "Rehab Rescue"]);
    });

    it("excludes an archived animal", async () => {
      givenPersistedPets();
      const { getPublicPets } = await import("@/actions/pets");

      const pets = await getPublicPets();

      expect(pets.some((p) => p.id === "itest-archived")).toBe(false);
    });

    it("excludes it however the caller filters", async () => {
      givenPersistedPets([makeDbPet({ id: "itest-archived-dog", species: "dog", isArchived: true })]);
      const { getPublicPets } = await import("@/actions/pets");

      // The archive check must precede every other predicate; a filter that
      // narrowed first and archived second would leak the row here.
      expect(await getPublicPets({ species: "dog" })).toHaveLength(0);
      expect(await getPublicPets({ status: "Available" })).toHaveLength(0);
      expect(await getPublicPets({ search: "archived" })).toHaveLength(0);
    });

    it("preserves persisted rehabilitation progress through the mapper", async () => {
      givenPersistedPets();
      const { getPublicPets } = await import("@/actions/pets");

      const rehab = (await getPublicPets()).find((p) => p.id === "itest-rehab");

      expect(rehab).toMatchObject({
        status: "In Rehabilitation",
        rehabStage: "Recovery",
        rehabStageMs: "Pemulihan",
        rehabProgressPercent: 60,
      });
    });

    it("matches the legacy Rehabilitation spelling against the canonical one", async () => {
      givenPersistedPets([makeDbPet({ id: "itest-legacy", status: "Rehabilitation" })]);
      const { getPublicPets } = await import("@/actions/pets");

      const pets = await getPublicPets({ status: "In Rehabilitation" });

      expect(pets.map((p) => p.id)).toEqual(["itest-legacy"]);
    });
  });

  describe("public profile read", () => {
    /** Arranges the single row `findServerPetByIdAsync` will read. */
    function givenPersistedPet(row: ReturnType<typeof makeDbPet> | null) {
      prismaDouble.pet.findUnique.mockResolvedValue(row);
    }

    it("serves a persisted animal rather than the bundled fixture", async () => {
      givenPersistedPet(ACTIVE);
      const { getPetById } = await import("@/actions/pets");

      const pet = await getPetById("itest-active");

      // `pets.json` holds no animal by this name, so matching it proves the read reached the
      // database rather than the in-memory mirror.
      expect(pet).toMatchObject({ id: "itest-active", name: "Active Rescue" });
      expect(prismaDouble.pet.findUnique).toHaveBeenCalled();
    });

    it("returns null for an animal archived in the database", async () => {
      // The id is deliberately `pet-001` — a real row in `src/data/pets.json`, present in the
      // fallback mirror and *not* archived there.
      //
      // That is the whole regression. The action used to read the synchronous repository
      // helper, which only searches that mirror; a cold process initialises it from the
      // fixture, so an archive performed anywhere else was invisible and the profile page
      // served the fixture animal. With an `itest-` id this test passes against the broken
      // reader too — the mirror has no such row, so it returns null for the wrong reason —
      // which is exactly the shape of assertion that makes a suite look green over a live bug.
      givenPersistedPet(makeDbPet({ id: "pet-001", name: "Bella", isArchived: true }));
      const { getPetById } = await import("@/actions/pets");

      expect(await getPetById("pet-001")).toBeNull();
    });

    it("finds an animal that exists only in the database", async () => {
      // The converse of the same defect: a pet absent from the fixture mirror used to 404 on
      // any instance that had not already loaded the catalogue.
      givenPersistedPet(makeDbPet({ id: "itest-db-only", name: "Database Only" }));
      const { getPetById } = await import("@/actions/pets");

      expect(await getPetById("itest-db-only")).toMatchObject({ id: "itest-db-only" });
    });

    it("returns null when the row does not exist", async () => {
      givenPersistedPet(null);
      const { getPetById } = await import("@/actions/pets");

      expect(await getPetById("itest-no-such-animal")).toBeNull();
    });
  });

  describe("admin catalogue", () => {
    // getAdminPets() is authorization-guarded: /admin/pets is a Server
    // Component that calls it directly, so an unguarded read shipped the whole
    // inventory to anonymous visitors in the RSC payload. These tests are about
    // filtering, not authorization, so they hold a real session.
    beforeEach(async () => {
      await signInAs("ADMIN");
    });

    it("includes archived animals the public catalogue hides", async () => {
      givenPersistedPets();
      const { getAdminPets } = await import("@/actions/pets");

      const pets = await getAdminPets();

      // Soft deletion has to stay reversible from the admin surface; an admin
      // query that inherited the public filter would strand the record.
      expect(pets.map((p) => p.id)).toContain("itest-archived");
    });

    it("reports the archive flag and deletion timestamp it read back", async () => {
      givenPersistedPets();
      const { getAdminPets } = await import("@/actions/pets");

      const archived = (await getAdminPets()).find((p) => p.id === "itest-archived");

      expect(archived?.isArchived).toBe(true);
      expect(archived?.deletedAt).toBeTruthy();
    });
  });

  describe("strict mode surfaces failures instead of masking them", () => {
    it("rejects when the catalogue query fails", async () => {
      prismaDouble.pet.findMany.mockRejectedValue(new Error("relation \"pets\" does not exist"));
      const { getPublicPets } = await import("@/actions/pets");

      // The behaviour this whole tier exists for. Outside strict mode this same
      // call resolves with fixture data and reports a healthy catalogue while
      // the schema is broken.
      await expect(getPublicPets()).rejects.toThrow(/relation "pets" does not exist/);
    });

    it("propagates the original error rather than a wrapper", async () => {
      class PrismaKnownRequestError extends Error {
        code = "P2022";
      }
      prismaDouble.pet.findMany.mockRejectedValue(new PrismaKnownRequestError("column missing"));
      const { getPublicPets } = await import("@/actions/pets");

      // The Prisma error code is the detail that names the broken column, so a
      // wrapper here would cost the diagnosis this tier is meant to deliver.
      await expect(getPublicPets()).rejects.toMatchObject({ code: "P2022" });
    });

    it("returns an empty array without falling back to fixtures when the database is merely empty", async () => {
      prismaDouble.pet.findMany.mockResolvedValue([]);
      const { getPublicPets } = await import("@/actions/pets");

      // An empty table is an answer, not an outage — returns [] without falling back.
      const pets = await getPublicPets();
      expect(pets).toEqual([]);
    });
  });
});
