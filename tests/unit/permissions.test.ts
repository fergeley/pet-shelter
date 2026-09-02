import { describe, it, expect } from "vitest";
import {
  CANONICAL_ROLES,
  PERMISSIONS,
  ROLES,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  ROLE_PERMISSIONS,
  isCanonicalRole,
  isUserStatus,
  normalizeRole,
  permissionsForRole,
  roleHasPermission,
} from "@/lib/security/permissions";
import {
  ForbiddenError,
  UnauthorizedError,
  assertHasPermission,
  hasAllPermissions,
  hasAnyPermission,
  hasPermission,
  hasRole,
  permissionsForSession,
  statusForError,
} from "@/lib/security/rbac";
import type { SessionUser } from "@/lib/security/session";

function session(role: string): SessionUser {
  return {
    id: `user-${role}`,
    email: `${role.toLowerCase()}@hopeforstrays.org`,
    name: `${role} User`,
    role: role as SessionUser["role"],
    expiresAt: Date.now() + 3_600_000,
  };
}

describe("Role normalisation", () => {
  it("passes canonical roles through unchanged", () => {
    for (const role of CANONICAL_ROLES) {
      expect(normalizeRole(role)).toBe(role);
    }
  });

  it("folds deprecated aliases onto their canonical replacements", () => {
    expect(normalizeRole("ADMIN")).toBe(ROLES.SUPER_ADMIN);
    expect(normalizeRole("COORDINATOR")).toBe(ROLES.VOLUNTEER_COORDINATOR);
    expect(normalizeRole("VOLUNTEER")).toBe(ROLES.STAFF);
  });

  it("accepts the lowercase values cached by older localStorage sessions", () => {
    expect(normalizeRole("admin")).toBe(ROLES.SUPER_ADMIN);
    expect(normalizeRole("coordinator")).toBe(ROLES.VOLUNTEER_COORDINATOR);
  });

  it("degrades unknown, empty and null roles to the least-privileged role", () => {
    expect(normalizeRole("WIZARD")).toBe(ROLES.STAFF);
    expect(normalizeRole("")).toBe(ROLES.STAFF);
    expect(normalizeRole(null)).toBe(ROLES.STAFF);
    expect(normalizeRole(undefined)).toBe(ROLES.STAFF);
  });

  it("never silently escalates an unrecognised role", () => {
    expect(roleHasPermission("WIZARD", PERMISSIONS.MANAGE_MEMBERS)).toBe(false);
    expect(roleHasPermission("SUPER_ADMIN_X", PERMISSIONS.MANAGE_MEMBERS)).toBe(false);
  });

  it("classifies canonical roles and statuses", () => {
    expect(isCanonicalRole("SUPER_ADMIN")).toBe(true);
    // Deprecated aliases are readable but must never be assignable.
    expect(isCanonicalRole("ADMIN")).toBe(false);
    expect(isUserStatus("SUSPENDED")).toBe(true);
    expect(isUserStatus("DELETED")).toBe(false);
  });
});

describe("Role -> permission matrix", () => {
  it("grants SUPER_ADMIN every catalogued permission", () => {
    const all = Object.values(PERMISSIONS);
    expect([...ROLE_PERMISSIONS.SUPER_ADMIN].sort()).toEqual([...all].sort());
  });

  it("restricts MANAGE_MEMBERS to SUPER_ADMIN alone", () => {
    const holders = CANONICAL_ROLES.filter((role) =>
      roleHasPermission(role, PERMISSIONS.MANAGE_MEMBERS)
    );
    expect(holders).toEqual([ROLES.SUPER_ADMIN]);
  });

  it("gives ANIMAL_MANAGER pets and media but not settings or staff", () => {
    expect(roleHasPermission(ROLES.ANIMAL_MANAGER, PERMISSIONS.MANAGE_PETS)).toBe(true);
    expect(roleHasPermission(ROLES.ANIMAL_MANAGER, PERMISSIONS.MANAGE_PET_MEDIA)).toBe(true);
    expect(roleHasPermission(ROLES.ANIMAL_MANAGER, PERMISSIONS.MANAGE_SETTINGS)).toBe(false);
    expect(roleHasPermission(ROLES.ANIMAL_MANAGER, PERMISSIONS.MANAGE_MEMBERS)).toBe(false);
  });

  it("gives CONTENT_EDITOR content only", () => {
    expect(permissionsForRole(ROLES.CONTENT_EDITOR)).toEqual([PERMISSIONS.MANAGE_CONTENT]);
  });

  it("gives VOLUNTEER_COORDINATOR application review and settings, not pets", () => {
    expect(roleHasPermission(ROLES.VOLUNTEER_COORDINATOR, PERMISSIONS.REVIEW_APPLICATIONS)).toBe(true);
    expect(roleHasPermission(ROLES.VOLUNTEER_COORDINATOR, PERMISSIONS.MANAGE_SETTINGS)).toBe(true);
    expect(roleHasPermission(ROLES.VOLUNTEER_COORDINATOR, PERMISSIONS.MANAGE_PETS)).toBe(false);
  });

  it("leaves STAFF read-only", () => {
    expect(permissionsForRole(ROLES.STAFF)).toEqual([PERMISSIONS.VIEW_APPLICATIONS]);
    expect(roleHasPermission(ROLES.STAFF, PERMISSIONS.REVIEW_APPLICATIONS)).toBe(false);
    expect(roleHasPermission(ROLES.STAFF, PERMISSIONS.DELETE_APPLICATIONS)).toBe(false);
  });

  it("routes a legacy ADMIN role to full SUPER_ADMIN permissions", () => {
    expect(roleHasPermission("ADMIN", PERMISSIONS.MANAGE_MEMBERS)).toBe(true);
  });

  it("carries a label and description for every canonical role", () => {
    for (const role of CANONICAL_ROLES) {
      expect(ROLE_LABELS[role]).toBeTruthy();
      expect(ROLE_DESCRIPTIONS[role]).toBeTruthy();
    }
  });
});

describe("Session permission guards", () => {
  const superAdmin = session(ROLES.SUPER_ADMIN);
  const animalManager = session(ROLES.ANIMAL_MANAGER);
  const staff = session(ROLES.STAFF);
  const legacyAdmin = session("ADMIN");

  it("denies every permission to an unauthenticated caller", () => {
    expect(hasPermission(null, PERMISSIONS.VIEW_APPLICATIONS)).toBe(false);
    expect(hasAnyPermission(null, [PERMISSIONS.VIEW_APPLICATIONS])).toBe(false);
    expect(hasAllPermissions(null, [PERMISSIONS.VIEW_APPLICATIONS])).toBe(false);
    expect(permissionsForSession(null)).toEqual([]);
  });

  it("throws UnauthorizedError (401) when signed out", () => {
    expect(() => assertHasPermission(null, PERMISSIONS.MANAGE_MEMBERS)).toThrow(UnauthorizedError);
    try {
      assertHasPermission(null, PERMISSIONS.MANAGE_MEMBERS);
    } catch (error) {
      expect(statusForError(error)).toBe(401);
    }
  });

  it("throws ForbiddenError (403) for an authenticated but under-privileged caller", () => {
    expect(() => assertHasPermission(staff, PERMISSIONS.MANAGE_MEMBERS)).toThrow(ForbiddenError);
    try {
      assertHasPermission(animalManager, PERMISSIONS.MANAGE_MEMBERS);
    } catch (error) {
      expect(statusForError(error)).toBe(403);
      expect((error as Error).message).toContain("MANAGE_MEMBERS");
    }
  });

  it("admits a SUPER_ADMIN to staff management", () => {
    expect(() => assertHasPermission(superAdmin, PERMISSIONS.MANAGE_MEMBERS)).not.toThrow();
  });

  it("keeps a pre-migration ADMIN session working", () => {
    expect(hasPermission(legacyAdmin, PERMISSIONS.MANAGE_MEMBERS)).toBe(true);
    expect(() => assertHasPermission(legacyAdmin, PERMISSIONS.MANAGE_SETTINGS)).not.toThrow();
  });

  it("matches a legacy allow-list against a canonical session and vice versa", () => {
    // Call sites written before the migration must not start denying access.
    expect(hasRole(superAdmin, [ROLES.ADMIN])).toBe(true);
    expect(hasRole(legacyAdmin, [ROLES.SUPER_ADMIN])).toBe(true);
    expect(hasRole(staff, [ROLES.ADMIN, ROLES.COORDINATOR])).toBe(false);
  });

  it("evaluates any/all correctly", () => {
    expect(hasAnyPermission(animalManager, [PERMISSIONS.MANAGE_MEMBERS, PERMISSIONS.MANAGE_PETS])).toBe(true);
    expect(hasAllPermissions(animalManager, [PERMISSIONS.MANAGE_MEMBERS, PERMISSIONS.MANAGE_PETS])).toBe(false);
    expect(hasAllPermissions(animalManager, [PERMISSIONS.MANAGE_PETS, PERMISSIONS.MANAGE_PET_MEDIA])).toBe(true);
  });

  it("maps unrecognised errors to 500", () => {
    expect(statusForError(new Error("boom"))).toBe(500);
  });
});
