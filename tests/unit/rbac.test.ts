import { describe, it, expect } from "vitest";
import {
  ROLES,
  UnauthorizedError,
  ForbiddenError,
  hasRole,
  assertAuthorized,
} from "@/lib/security/rbac";
import { SessionUser } from "@/lib/security/session";

describe("Role-Based Access Control (RBAC)", () => {
  const adminUser: SessionUser = {
    id: "user-admin-1",
    email: "admin@hopeforstrays.org",
    name: "Admin User",
    role: ROLES.ADMIN,
    expiresAt: Date.now() + 3600000,
  };

  const coordinatorUser: SessionUser = {
    id: "user-coord-1",
    email: "coord@hopeforstrays.org",
    name: "Coordinator User",
    role: ROLES.COORDINATOR,
    expiresAt: Date.now() + 3600000,
  };

  const staffUser: SessionUser = {
    id: "user-staff-1",
    email: "staff@hopeforstrays.org",
    name: "Staff User",
    role: ROLES.STAFF,
    expiresAt: Date.now() + 3600000,
  };

  describe("hasRole", () => {
    it("should return false for unauthenticated null user", () => {
      expect(hasRole(null, [ROLES.ADMIN, ROLES.STAFF])).toBe(false);
    });

    it("should return true when user role matches allowed roles", () => {
      expect(hasRole(adminUser, [ROLES.ADMIN])).toBe(true);
      expect(hasRole(coordinatorUser, [ROLES.ADMIN, ROLES.COORDINATOR])).toBe(true);
      expect(hasRole(staffUser, [ROLES.STAFF, ROLES.VOLUNTEER])).toBe(true);
    });

    it("should return false when user role is not in allowed roles", () => {
      expect(hasRole(staffUser, [ROLES.ADMIN, ROLES.COORDINATOR])).toBe(false);
      expect(hasRole(coordinatorUser, [ROLES.ADMIN])).toBe(false);
    });
  });

  describe("assertAuthorized", () => {
    it("should throw UnauthorizedError when user is not authenticated (null)", () => {
      expect(() => assertAuthorized(null, [ROLES.ADMIN])).toThrow(UnauthorizedError);
      expect(() => assertAuthorized(null, [ROLES.ADMIN])).toThrow(
        "Authentication required. Please sign in."
      );
    });

    it("should throw ForbiddenError when user has insufficient permissions", () => {
      expect(() => assertAuthorized(staffUser, [ROLES.ADMIN, ROLES.COORDINATOR])).toThrow(
        ForbiddenError
      );
      expect(() => assertAuthorized(staffUser, [ROLES.ADMIN])).toThrow(
        "Role 'STAFF' is not authorized for this operation."
      );
    });

    it("should pass assertion without throwing when user has an authorized role", () => {
      expect(() => assertAuthorized(adminUser, [ROLES.ADMIN])).not.toThrow();
      expect(() =>
        assertAuthorized(coordinatorUser, [ROLES.ADMIN, ROLES.COORDINATOR])
      ).not.toThrow();
      expect(() =>
        assertAuthorized(staffUser, [ROLES.ADMIN, ROLES.COORDINATOR, ROLES.STAFF])
      ).not.toThrow();
    });
  });
});
