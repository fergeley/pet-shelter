import { describe, it, expect, beforeEach, vi } from "vitest";
import { verifyAdminSession } from "@/lib/auth";
import { sealSession, SESSION_COOKIE_NAME } from "@/lib/security/session";
import {
  getPublicPets,
  getAdminPets,
  toggleArchivePet,
} from "@/actions/pets";
import { submitApplication } from "@/actions/applications";
import { insertServerPet } from "@/lib/server/petRepository";

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

describe("Security & Route Protection (verifyAdminSession)", () => {
  beforeEach(() => {
    mockCookieMap.clear();
  });

  it("returns true when valid ADMIN cryptographic session cookie is present", async () => {
    const token = sealSession({
      id: "admin-1",
      email: "admin@hopeforstrays.org",
      name: "Admin User",
      role: "ADMIN",
    });
    mockCookieMap.set(SESSION_COOKIE_NAME, { value: token });

    const isAuth = await verifyAdminSession();
    expect(isAuth).toBe(true);
  });

  it("returns true when valid COORDINATOR session cookie is present", async () => {
    const token = sealSession({
      id: "coord-1",
      email: "coord@hopeforstrays.org",
      name: "Coord User",
      role: "COORDINATOR",
    });
    mockCookieMap.set(SESSION_COOKIE_NAME, { value: token });

    const isAuth = await verifyAdminSession();
    expect(isAuth).toBe(true);
  });

  it("returns false for unauthorized role like VOLUNTEER unless admin secret is provided", async () => {
    const token = sealSession({
      id: "vol-1",
      email: "vol@hopeforstrays.org",
      name: "Volunteer User",
      role: "VOLUNTEER",
    });
    mockCookieMap.set(SESSION_COOKIE_NAME, { value: token });

    const isAuth = await verifyAdminSession();
    expect(isAuth).toBe(false);
  });

  it("returns true when valid admin_session secret cookie matches", async () => {
    process.env.ADMIN_SECRET_KEY = "test_super_secret_admin_key";
    mockCookieMap.set("admin_session", { value: "test_super_secret_admin_key" });

    const isAuth = await verifyAdminSession();
    expect(isAuth).toBe(true);
  });

  it("returns false when no session and invalid secret cookie", async () => {
    mockCookieMap.set("admin_session", { value: "wrong_password" });

    const isAuth = await verifyAdminSession();
    expect(isAuth).toBe(false);
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
