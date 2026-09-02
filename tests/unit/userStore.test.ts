import { describe, it, expect, beforeEach } from "vitest";
import {
  findUserByEmail,
  findUserById,
  createUser,
  listUsers,
  resetUserStore,
} from "@/lib/userStore";
import { ROLES } from "@/lib/security/rbac";
import { hashPassword } from "@/lib/security/crypto";

describe("User Store Repository", () => {
  beforeEach(async () => {
    await resetUserStore();
  });

  it("should have pre-seeded demo accounts available on initialization", async () => {
    const admin = await findUserByEmail("admin@hopeforstrays.org");
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe(ROLES.SUPER_ADMIN);
    expect(admin?.name).toBe("Dr. Sarah Tan");

    const coord = await findUserByEmail("coordinator@hopeforstrays.org");
    expect(coord).not.toBeNull();
    expect(coord?.role).toBe(ROLES.VOLUNTEER_COORDINATOR);

    const staff = await findUserByEmail("staff@hopeforstrays.org");
    expect(staff).not.toBeNull();
    expect(staff?.role).toBe(ROLES.STAFF);
  });

  it("should find users by email in a case-insensitive manner with whitespace trimming", async () => {
    const user1 = await findUserByEmail("  ADMIN@HopeForStrays.ORG  ");
    expect(user1).not.toBeNull();
    expect(user1?.email).toBe("admin@hopeforstrays.org");
  });

  it("should find user by unique ID", async () => {
    const user = await findUserById("usr-admin-01");
    expect(user).not.toBeNull();
    expect(user?.email).toBe("admin@hopeforstrays.org");

    const notFound = await findUserById("non-existent-id-999");
    expect(notFound).toBeNull();
  });

  it("should create and register a new user successfully", async () => {
    const passwordHash = await hashPassword("VolunteerPassword123!");
    const newUser = await createUser({
      name: "Marcus Aurelius",
      email: "marcus@shelter.org",
      passwordHash,
      role: ROLES.CONTENT_EDITOR,
    });

    expect(newUser.id).toMatch(/^usr-/);
    expect(newUser.name).toBe("Marcus Aurelius");
    expect(newUser.email).toBe("marcus@shelter.org");
    expect(newUser.role).toBe(ROLES.CONTENT_EDITOR);

    // Verify lookup succeeds
    const found = await findUserByEmail("marcus@shelter.org");
    expect(found?.id).toBe(newUser.id);
  });

  it("should reject creating a user with a duplicate email", async () => {
    const passwordHash = await hashPassword("ValidPass1234");

    await expect(
      createUser({
        name: "Duplicate User",
        email: "admin@hopeforstrays.org", // Already exists
        passwordHash,
        role: ROLES.STAFF,
      })
    ).rejects.toThrow(/already exists/i);
  });

  it("should list all users without leaking sensitive password hashes", async () => {
    const users = await listUsers();
    expect(users.length).toBeGreaterThanOrEqual(3);

    for (const u of users) {
      expect(u.id).toBeDefined();
      expect(u.email).toBeDefined();
      expect(u.role).toBeDefined();
      // passwordHash should NOT be present in list output
      expect((u as Record<string, unknown>).passwordHash).toBeUndefined();
    }
  });
});
