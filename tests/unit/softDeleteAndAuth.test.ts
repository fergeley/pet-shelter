import { describe, it, expect, beforeEach, vi } from "vitest";
import { hasAdminPermission } from "@/lib/auth";
import { PERMISSIONS } from "@/lib/security/rbac";
import { sealSession, SESSION_COOKIE_NAME } from "@/lib/security/session";
import {
  getPublicPets,
  getAdminPets,
  toggleArchivePet,
} from "@/actions/pets";
import { submitApplication } from "@/actions/applications";
import { insertServerPet } from "@/lib/serverStore";

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

describe("Security & Route Protection (hasAdminPermission)", () => {
  beforeEach(() => {
    mockCookieMap.clear();
  });

  function signIn(id: string, role: string) {
    const token = sealSession({
      id,
      email: `${id}@hopeforstrays.org`,
      name: `${role} User`,
      role: role as Parameters<typeof sealSession>[0]["role"],
    });
    mockCookieMap.set(SESSION_COOKIE_NAME, { value: token });
  }

  it("admits a pre-migration ADMIN session to every capability", async () => {
    signIn("admin-1", "ADMIN");

    expect(await hasAdminPermission(PERMISSIONS.MANAGE_PETS)).toBe(true);
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_PET_MEDIA)).toBe(true);
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_MEMBERS)).toBe(true);
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_SETTINGS)).toBe(true);
  });

  it("scopes an ANIMAL_MANAGER to pets and media only", async () => {
    signIn("animal-1", "ANIMAL_MANAGER");

    // This is the guard the /api/upload route actually uses.
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_PET_MEDIA)).toBe(true);
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_PETS)).toBe(true);
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_MEMBERS)).toBe(false);
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_SETTINGS)).toBe(false);
  });

  it("keeps a VOLUNTEER_COORDINATOR out of pets, uploads and shelter settings", async () => {
    signIn("coord-1", "COORDINATOR");

    expect(await hasAdminPermission(PERMISSIONS.REVIEW_APPLICATIONS)).toBe(true);
    expect(await hasAdminPermission(PERMISSIONS.SEND_SHELTER_EMAIL)).toBe(true);
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_PETS)).toBe(false);
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_PET_MEDIA)).toBe(false);
    // Regression guard: updateShelterSettings was ADMIN-only before the RBAC
    // migration and must not become reachable by a coordinator, because that
    // schema carries the Resend and storage credentials.
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_SETTINGS)).toBe(false);
  });

  it("leaves a STAFF session read-only", async () => {
    signIn("vol-1", "VOLUNTEER");

    expect(await hasAdminPermission(PERMISSIONS.VIEW_APPLICATIONS)).toBe(true);
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_PETS)).toBe(false);
    expect(await hasAdminPermission(PERMISSIONS.MANAGE_PET_MEDIA)).toBe(false);
  });

  it("honours the admin_session break-glass secret", async () => {
    process.env.ADMIN_SECRET_KEY = "test_super_secret_admin_key";
    mockCookieMap.set("admin_session", { value: "test_super_secret_admin_key" });

    expect(await hasAdminPermission(PERMISSIONS.MANAGE_PETS)).toBe(true);
  });

  it("returns false when no session and invalid secret cookie", async () => {
    mockCookieMap.set("admin_session", { value: "wrong_password" });

    expect(await hasAdminPermission(PERMISSIONS.MANAGE_PETS)).toBe(false);
    expect(await hasAdminPermission(PERMISSIONS.VIEW_APPLICATIONS)).toBe(false);
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
    const token = sealSession({
      id: "admin-1",
      email: "admin@hopeforstrays.org",
      name: "Admin User",
      role: "ADMIN",
    });
    mockCookieMap.set(SESSION_COOKIE_NAME, { value: token });

    testPetId = `test-pet-${Math.random().toString(36).substring(7)}`;

    // Insert unique test pet
    await insertServerPet(
      {
        id: testPetId,
        name: `Doggo_${testPetId}`,
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
      },
      actor
    );
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
