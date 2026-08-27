import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  LEGACY_ADMIN_TOKEN_PRINCIPAL,
  verifyAdminSession,
} from "@/lib/security/adminSession";
import { sealSession, SESSION_COOKIE_NAME } from "@/lib/security/session";
import { getAuditLogs } from "@/lib/domain/auditLog";
import {
  getPublicPets,
  getAdminPets,
  toggleArchivePet,
} from "@/actions/pets";
import { submitApplication } from "@/actions/applications";
import { insertServerPet } from "@/lib/server/petRepository";
import { Pet } from "@/types/pet";

// Mock next/headers cookies
const mockCookieMap = new Map<string, { value: string }>();

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => mockCookieMap.get(name),
    set: (name: string, value: string) => {
      mockCookieMap.set(name, { value });
    },
    delete: (name: string) => {
      mockCookieMap.delete(name);
    },
  })),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

const ADMIN_SECRET = "test_super_secret_admin_key";

/** A real, signed-in administrator: the identity the legacy token must not resemble. */
const REAL_ADMIN = {
  id: "admin-1",
  email: "admin@hopeforstrays.org",
  name: "Admin User",
  role: "ADMIN" as const,
};

const VOLUNTEER = {
  id: "vol-1",
  email: "vol@hopeforstrays.org",
  name: "Volunteer User",
  role: "VOLUNTEER" as const,
};

function makeTestPet(id: string): Pet {
  return {
    id,
    name: `Doggo_${id}`,
    species: "dog",
    breed: "Golden Mix",
    age: "2 years",
    ageCategory: "young",
    gender: "Male",
    size: "Medium",
    weight: "18 kg",
    status: "Available",
    adoptionFee: "Free",
    description: "A lovely rescue dog for testing soft delete.",
    rescueStory: "Rescued safely.",
    image: "https://images.unsplash.com/photo-1543466835-00a7907e9de1",
    tags: ["Friendly", "Vaccinated"],
    featured: false,
    intakeDate: "2026-01-01",
    isArchived: false,
    deletedAt: null,
    medical: {
      vaccinated: true,
      microchipped: true,
      spayedNeutered: true,
    },
    compatibility: {
      goodWithDogs: true,
      goodWithCats: true,
      goodWithKids: true,
      energyLevel: "Moderate",
    },
  };
}

describe("Security & Route Protection (verifyAdminSession)", () => {
  beforeEach(() => {
    mockCookieMap.clear();
  });

  it("names the sealed ADMIN session as the principal", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, { value: sealSession(REAL_ADMIN) });

    const principal = await verifyAdminSession();
    expect(principal).toMatchObject({
      id: "admin-1",
      email: "admin@hopeforstrays.org",
      role: "ADMIN",
      authMethod: "session",
    });
  });

  it("names the sealed COORDINATOR session as the principal", async () => {
    const token = sealSession({
      id: "coord-1",
      email: "coord@hopeforstrays.org",
      name: "Coord User",
      role: "COORDINATOR",
    });
    mockCookieMap.set(SESSION_COOKIE_NAME, { value: token });

    const principal = await verifyAdminSession();
    expect(principal).toMatchObject({
      id: "coord-1",
      role: "COORDINATOR",
      authMethod: "session",
    });
  });

  it("returns null for unauthorized role like VOLUNTEER unless admin secret is provided", async () => {
    mockCookieMap.set(SESSION_COOKIE_NAME, { value: sealSession(VOLUNTEER) });

    const principal = await verifyAdminSession();
    expect(principal).toBeNull();
  });

  it("names the legacy token when the admin_session secret cookie matches", async () => {
    process.env.ADMIN_SECRET_KEY = ADMIN_SECRET;
    mockCookieMap.set("admin_session", { value: ADMIN_SECRET });

    const principal = await verifyAdminSession();
    expect(principal).toEqual(LEGACY_ADMIN_TOKEN_PRINCIPAL);
    expect(principal?.authMethod).toBe("legacy-shared-secret");
  });

  it("names the token, not the user, when the secret authorizes a VOLUNTEER request", async () => {
    // The token is what authorized this, so the token is what gets named. The
    // previous implementation read the session a second time and attributed the
    // mutation to the VOLUNTEER, who was never authorized for it.
    process.env.ADMIN_SECRET_KEY = ADMIN_SECRET;
    mockCookieMap.set(SESSION_COOKIE_NAME, { value: sealSession(VOLUNTEER) });
    mockCookieMap.set("admin_session", { value: ADMIN_SECRET });

    const principal = await verifyAdminSession();
    expect(principal?.id).toBe(LEGACY_ADMIN_TOKEN_PRINCIPAL.id);
    expect(principal?.email).not.toBe(VOLUNTEER.email);
  });

  it("returns null when no session and invalid secret cookie", async () => {
    mockCookieMap.set("admin_session", { value: "wrong_password" });

    const principal = await verifyAdminSession();
    expect(principal).toBeNull();
  });
});

describe("Audit trail distinguishes the legacy token from a real administrator", () => {
  beforeEach(() => {
    mockCookieMap.clear();
    process.env.ADMIN_SECRET_KEY = ADMIN_SECRET;
  });

  /**
   * Archives a fresh pet through the real action and returns the audit row it
   * produced. Whatever authorized the call is whatever the row must name.
   */
  async function archiveAndReadAuditRow() {
    const petId = `audit-pet-${Math.random().toString(36).substring(7)}`;
    // Seeded directly, so the fixture write is not the row under test.
    await insertServerPet(makeTestPet(petId), { ...REAL_ADMIN, expiresAt: Date.now() + 86400000 });

    const result = await toggleArchivePet(petId, true);
    expect(result.success).toBe(true);

    const row = getAuditLogs(200).find(
      (entry) => entry.action === "PET_ARCHIVED" && entry.entityId === petId
    );
    expect(row).toBeDefined();
    return row!;
  }

  function authenticateAsRealAdmin() {
    mockCookieMap.clear();
    mockCookieMap.set(SESSION_COOKIE_NAME, { value: sealSession(REAL_ADMIN) });
  }

  function authenticateWithSharedSecret() {
    mockCookieMap.clear();
    mockCookieMap.set("admin_session", { value: ADMIN_SECRET });
  }

  it("records the signed-in administrator when a sealed session authorized the archive", async () => {
    authenticateAsRealAdmin();

    const row = await archiveAndReadAuditRow();
    expect(row.actorId).toBe("admin-1");
    expect(row.actorEmail).toBe("admin@hopeforstrays.org");
  });

  it("records an unmistakably non-human identity when only the shared secret authorized it", async () => {
    authenticateWithSharedSecret();

    const row = await archiveAndReadAuditRow();
    expect(row.actorId).toBe(LEGACY_ADMIN_TOKEN_PRINCIPAL.id);
    expect(row.actorEmail).toBe(LEGACY_ADMIN_TOKEN_PRINCIPAL.email);
    // `.invalid` is reserved by RFC 2606, so this can never be a staff mailbox.
    expect(row.actorEmail.endsWith(".invalid")).toBe(true);
  });

  it("writes a different actor for each, though both carry the ADMIN role", async () => {
    // This is the property the change exists for. Before it, both paths wrote
    // admin@hopeforstrays.org and an auditor could not tell which had acted.
    authenticateAsRealAdmin();
    const sessionRow = await archiveAndReadAuditRow();

    authenticateWithSharedSecret();
    const tokenRow = await archiveAndReadAuditRow();

    expect(sessionRow.actorRole).toBe("ADMIN");
    expect(tokenRow.actorRole).toBe("ADMIN");
    expect(tokenRow.actorId).not.toBe(sessionRow.actorId);
    expect(tokenRow.actorEmail).not.toBe(sessionRow.actorEmail);
  });
});

describe("Soft Deletes & Query Filtering", () => {
  const actor = {
    id: "test-admin",
    email: "admin@test.com",
    name: "Test Admin",
    role: "ADMIN" as const,
    expiresAt: Date.now() + 86400000,
  };

  let testPetId: string;

  beforeEach(async () => {
    mockCookieMap.clear();
    mockCookieMap.set(SESSION_COOKIE_NAME, { value: sealSession(REAL_ADMIN) });

    testPetId = `test-pet-${Math.random().toString(36).substring(7)}`;

    // Insert unique test pet
    await insertServerPet(makeTestPet(testPetId), actor);
  });

  it("includes active pet in getPublicPets", async () => {
    const publicPets = await getPublicPets({ search: testPetId });
    expect(publicPets.some((p) => p.id === testPetId)).toBe(true);
  });

  it("archives pet and excludes it from getPublicPets while keeping in getAdminPets", async () => {
    const archiveResult = await toggleArchivePet(testPetId, true);
    expect(archiveResult.success).toBe(true);

    // Should NOT appear in public pets
    const publicPets = await getPublicPets({ search: testPetId });
    expect(publicPets.some((p) => p.id === testPetId)).toBe(false);

    // SHOULD appear in admin pets with isArchived: true
    const adminPets = await getAdminPets();
    const archivedInAdmin = adminPets.find((p) => p.id === testPetId);
    expect(archivedInAdmin).toBeDefined();
    expect(archivedInAdmin?.isArchived).toBe(true);
    expect(archivedInAdmin?.deletedAt).toBeDefined();
  });

  it("restores archived pet to public catalog", async () => {
    await toggleArchivePet(testPetId, true);
    const restoreResult = await toggleArchivePet(testPetId, false);
    expect(restoreResult.success).toBe(true);

    const publicPets = await getPublicPets({ search: testPetId });
    expect(publicPets.some((p) => p.id === testPetId)).toBe(true);
  });

  it("blocks public adoption application submission on archived pet", async () => {
    await toggleArchivePet(testPetId, true);

    const submitResult = await submitApplication({
      petId: testPetId,
      petName: `Doggo_${testPetId}`,
      applicantName: "Jane Doe",
      email: `applicant_${Date.now()}@example.com`,
      phone: "012-3456789",
      address: "123 Jalan SS2, Petaling Jaya",
      housingType: "landed_terrace",
      hasFencedYard: "yes",
      currentPets: "none",
      householdExperience: "experienced",
    });

    expect(submitResult.success).toBe(false);
    expect(submitResult.error).toContain("archived");
  });
});
