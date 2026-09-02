import { describe, it, expect, vi, beforeEach } from "vitest";
import { getAdminPets, getPublicPets } from "@/actions/pets";
import { ROLES } from "@/lib/security/permissions";

/**
 * Regression guard for a real data exposure.
 *
 * `/admin/pets` is a Server Component that calls `getAdminPets()` directly.
 * The admin layout is a client component and shows a loading state until its
 * session effect resolves, but server-component output is serialised into the
 * RSC flight payload regardless — so while this function was unguarded, an
 * anonymous GET of /admin/pets returned 200 with the entire inventory,
 * including archived animals and per-pet application counts.
 */

const currentRole = { value: null as string | null };

vi.mock("@/lib/security/session", () => ({
  getCurrentSession: vi.fn(async () =>
    currentRole.value === null
      ? null
      : {
          id: "actor-1",
          email: "actor@hopeforstrays.org",
          name: "Test Actor",
          role: currentRole.value,
          expiresAt: Date.now() + 3_600_000,
        }
  ),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

describe("getAdminPets authorization", () => {
  beforeEach(() => {
    currentRole.value = null;
  });

  it("refuses an anonymous caller", async () => {
    await expect(getAdminPets()).rejects.toThrow(/Authentication required/i);
  });

  it.each([ROLES.CONTENT_EDITOR, ROLES.VOLUNTEER_COORDINATOR, ROLES.STAFF])(
    "refuses a %s",
    async (role) => {
      currentRole.value = role;
      await expect(getAdminPets()).rejects.toThrow(/MANAGE_PETS/);
    }
  );

  it.each([ROLES.SUPER_ADMIN, ROLES.ANIMAL_MANAGER, "ADMIN"])(
    "admits a %s and returns the admin projection",
    async (role) => {
      currentRole.value = role;

      const pets = await getAdminPets();
      expect(Array.isArray(pets)).toBe(true);
      expect(pets.length).toBeGreaterThan(0);
      expect(pets[0]).toHaveProperty("applicationCount");
    }
  );

  it("leaves the public catalog reachable without a session", async () => {
    // getPublicPets is genuinely public and must not have been swept up in the
    // fix; it already filters archived records.
    const pets = await getPublicPets();
    expect(Array.isArray(pets)).toBe(true);
    expect(pets.every((p) => !p.isArchived)).toBe(true);
  });
});
