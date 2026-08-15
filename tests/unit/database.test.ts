import { describe, it, expect } from "vitest";
import { prisma } from "@/lib/prisma";
import {
  getServerPetsAsync,
  getServerApplicationsAsync,
  atomicUpdateApplicationStatus,
} from "@/lib/serverStore";
import { ROLES } from "@/lib/security/rbac";
import { findUserByEmail, listUsers } from "@/lib/userStore";

describe("Database & Persistence Integration Layer", () => {
  const mockAdminActor = {
    id: "usr-admin-01",
    email: "admin@hopeforstrays.org",
    name: "Dr. Sarah Tan",
    role: ROLES.ADMIN,
    expiresAt: Date.now() + 86400000,
  };

  it("exports a valid PrismaClient instance", () => {
    expect(prisma).toBeDefined();
    expect(prisma.pet).toBeDefined();
    expect(prisma.adoptionApplication).toBeDefined();
    expect(prisma.user).toBeDefined();
    expect(prisma.auditLog).toBeDefined();
  });

  it("retrieves seeded pets list through persistence store", async () => {
    const pets = await getServerPetsAsync();
    expect(Array.isArray(pets)).toBe(true);
    expect(pets.length).toBeGreaterThan(0);
    expect(pets.some((p) => p.name === "Bella")).toBe(true);
  });

  it("retrieves seeded staff users through user store", async () => {
    const users = await listUsers();
    expect(users.length).toBeGreaterThanOrEqual(3);

    const admin = await findUserByEmail("admin@hopeforstrays.org");
    expect(admin).not.toBeNull();
    expect(admin?.role).toBe("ADMIN");
    expect(admin?.name).toBe("Dr. Sarah Tan");
  });

  it("executes multi-entity atomic application approval", async () => {
    const apps = await getServerApplicationsAsync();
    expect(apps.length).toBeGreaterThan(0);

    const appToReview = apps.find((a) => a.id === "app-002");
    expect(appToReview).toBeDefined();

    if (appToReview) {
      const result = await atomicUpdateApplicationStatus(
        appToReview.id,
        "UNDER_REVIEW",
        "Staff interview scheduled",
        mockAdminActor
      );
      expect(result.success).toBe(true);

      const approvedResult = await atomicUpdateApplicationStatus(
        appToReview.id,
        "APPROVED",
        "Home visit passed, approved for adoption",
        mockAdminActor
      );
      expect(approvedResult.success).toBe(true);
    }
  });
});
