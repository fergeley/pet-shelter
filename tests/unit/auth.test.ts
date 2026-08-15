import { describe, it, expect, beforeEach, vi } from "vitest";
import { loginAction, registerAction, logoutAction, getCurrentUserAction } from "@/actions/auth";
import { resetUserStore } from "@/lib/userStore";
import { ROLES } from "@/lib/security/rbac";

// Mock Next.js next/headers cookies store
const cookieStore = new Map<string, { name: string; value: string; [key: string]: unknown }>();

vi.mock("next/headers", () => {
  return {
    cookies: async () => ({
      get: (name: string) => cookieStore.get(name),
      set: (name: string, value: string, options: Record<string, unknown>) => {
        if (options?.maxAge === 0) {
          cookieStore.delete(name);
        } else {
          cookieStore.set(name, { name, value, ...options });
        }
      },
      delete: (name: string) => cookieStore.delete(name),
    }),
  };
});

describe("Authentication Server Actions (Native Register & Login)", () => {
  beforeEach(async () => {
    cookieStore.clear();
    await resetUserStore();
  });

  describe("loginAction", () => {
    it("should successfully log in with valid demo credentials and set session cookie", async () => {
      const response = await loginAction({
        email: "admin@hopeforstrays.org",
        password: "admin123",
      });

      expect(response.success).toBe(true);
      expect(response.user).toBeDefined();
      expect(response.user?.email).toBe("admin@hopeforstrays.org");
      expect(response.user?.role).toBe(ROLES.ADMIN);

      // Verify cookie was set
      const sessionCookie = cookieStore.get("hope_shelter_session");
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie?.value).toMatch(/\./); // base64.signature
    });

    it("should support quick demo login with PIN 1234", async () => {
      const response = await loginAction({
        email: "coordinator@hopeforstrays.org",
        password: "1234",
      });

      expect(response.success).toBe(true);
      expect(response.user?.role).toBe(ROLES.COORDINATOR);
    });

    it("should reject login with wrong password", async () => {
      const response = await loginAction({
        email: "admin@hopeforstrays.org",
        password: "wrong-password-999",
      });

      expect(response.success).toBe(false);
      expect(response.error).toMatch(/Invalid staff email or password/i);
      expect(cookieStore.get("hope_shelter_session")).toBeUndefined();
    });

    it("should reject login for non-existent email", async () => {
      const response = await loginAction({
        email: "nobody@unknown.com",
        password: "somepassword",
      });

      expect(response.success).toBe(false);
      expect(response.error).toMatch(/Invalid staff email or password/i);
    });

    it("should enforce rate limiting on repeated failed login attempts", async () => {
      const email = "bruteforce@target.com";

      // 5 failed attempts
      for (let i = 0; i < 5; i++) {
        await loginAction({ email, password: `wrong-${i}` });
      }

      // 6th attempt should be blocked by rate limiter
      const blockedRes = await loginAction({ email, password: "attempt-6" });
      expect(blockedRes.success).toBe(false);
      expect(blockedRes.error).toMatch(/Too many login attempts/i);
      expect(blockedRes.retryAfterSeconds).toBeGreaterThan(0);
    });
  });

  describe("registerAction", () => {
    it("should register a new staff member and immediately set session cookie", async () => {
      const regResponse = await registerAction({
        name: "Nurul Huda",
        email: "nurul@hopeforstrays.org",
        password: "SecureShelterPass2026!",
        role: ROLES.STAFF,
      });

      expect(regResponse.success).toBe(true);
      expect(regResponse.user).toBeDefined();
      expect(regResponse.user?.name).toBe("Nurul Huda");
      expect(regResponse.user?.email).toBe("nurul@hopeforstrays.org");
      expect(regResponse.user?.role).toBe(ROLES.STAFF);

      // Verify cookie was set
      const sessionCookie = cookieStore.get("hope_shelter_session");
      expect(sessionCookie).toBeDefined();

      // Verify user can now log in with the new password
      const loginRes = await loginAction({
        email: "nurul@hopeforstrays.org",
        password: "SecureShelterPass2026!",
      });
      expect(loginRes.success).toBe(true);
      expect(loginRes.user?.name).toBe("Nurul Huda");
    });

    it("should reject registration with password shorter than 8 characters", async () => {
      const res = await registerAction({
        name: "Short Pass User",
        email: "short@hopeforstrays.org",
        password: "short",
        role: ROLES.STAFF,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/at least 8 characters/i);
    });

    it("should reject registration with invalid email format", async () => {
      const res = await registerAction({
        name: "Invalid Email User",
        email: "invalid-email-address",
        password: "ValidPassword123!",
        role: ROLES.STAFF,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/valid email/i);
    });

    it("should reject registration with duplicate email", async () => {
      const res = await registerAction({
        name: "Imposter Admin",
        email: "admin@hopeforstrays.org",
        password: "SomePassword123!",
        role: ROLES.STAFF,
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/already exists/i);
    });

    it("should reject registration for elevated ADMIN/COORDINATOR roles without security invite PIN", async () => {
      const res = await registerAction({
        name: "Privilege Escalation Attacker",
        email: "attacker@test.com",
        password: "ValidPassword123!",
        role: ROLES.ADMIN,
        staffInviteCode: "wrong-code",
      });

      expect(res.success).toBe(false);
      expect(res.error).toMatch(/invite code is required/i);
    });

    it("should allow registration for elevated roles with valid security invite PIN", async () => {
      const res = await registerAction({
        name: "New Shelter Coordinator",
        email: "new.coordinator@hopeforstrays.org",
        password: "ValidCoordinatorPassword123!",
        role: ROLES.COORDINATOR,
        staffInviteCode: "1234",
      });

      expect(res.success).toBe(true);
      expect(res.user?.role).toBe(ROLES.COORDINATOR);
    });
  });

  describe("logoutAction & getCurrentUserAction", () => {
    it("should clear session cookie on logout", async () => {
      // First login
      await loginAction({
        email: "admin@hopeforstrays.org",
        password: "admin123",
      });
      expect(cookieStore.get("hope_shelter_session")).toBeDefined();

      // Logout
      const logoutRes = await logoutAction();
      expect(logoutRes.success).toBe(true);
      expect(cookieStore.get("hope_shelter_session")).toBeUndefined();
    });

    it("should return the current session user when authenticated", async () => {
      await loginAction({
        email: "staff@hopeforstrays.org",
        password: "staff123",
      });

      const userRes = await getCurrentUserAction();
      expect(userRes.user).not.toBeNull();
      expect(userRes.user?.email).toBe("staff@hopeforstrays.org");
    });
  });
});
