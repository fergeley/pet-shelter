import { describe, it, expect, beforeEach, vi } from "vitest";
import { loginAction } from "@/actions/auth";
import { USER_STATUSES } from "@/lib/security/permissions";
import { ROLES } from "@/lib/security/rbac";

/**
 * The account-status gate on sign-in.
 *
 * `status` now travels on the same userStore row that supplies the password
 * hash, so login makes one query instead of two. These cases pin the behaviour
 * that consolidation must not lose: a suspended member cannot obtain a fresh
 * 24-hour session, and an invitee cannot sign in before redeeming their link.
 */

const h = vi.hoisted(() => ({
  cookieStore: new Map<string, { name: string; value: string }>(),
  user: {
    id: "usr-1",
    email: "member@hopeforstrays.org",
    name: "Test Member",
    // Deliberately unusable. NODE_ENV is "test", so the development-only demo
    // password is accepted and password verification is not what is under test.
    passwordHash: "not-a-real-hash",
    // Literals, not the enum constants: vi.hoisted runs before imports.
    role: "ANIMAL_MANAGER" as string,
    status: "ACTIVE" as string,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  lookups: { count: 0 },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => h.cookieStore.get(name),
    set: (name: string, value: string) =>
      h.cookieStore.set(name, { name, value }),
    delete: (name: string) => h.cookieStore.delete(name),
  }),
}));

vi.mock("@/lib/userStore", () => ({
  findUserByEmail: vi.fn(async () => {
    h.lookups.count += 1;
    return h.user;
  }),
  createUser: vi.fn(),
}));

// memberStore must no longer be consulted on the login path at all.
const memberStoreCalls = { findMemberByEmail: 0, recordLogin: 0 };
vi.mock("@/lib/memberStore", () => ({
  recordLogin: vi.fn(async () => {
    memberStoreCalls.recordLogin += 1;
  }),
  findMemberByEmail: vi.fn(async () => {
    memberStoreCalls.findMemberByEmail += 1;
    return null;
  }),
}));

describe("Login account-status gate", () => {
  beforeEach(() => {
    h.cookieStore.clear();
    h.lookups.count = 0;
    memberStoreCalls.findMemberByEmail = 0;
    memberStoreCalls.recordLogin = 0;
    h.user.status = USER_STATUSES.ACTIVE;
    h.user.role = ROLES.ANIMAL_MANAGER;
  });

  it("admits an ACTIVE member and issues a session cookie", async () => {
    const res = await loginAction({ email: h.user.email, password: "1234" });

    expect(res.success).toBe(true);
    expect(res.user?.role).toBe(ROLES.ANIMAL_MANAGER);
    expect(h.cookieStore.get("hope_shelter_session")).toBeDefined();
  });

  it("refuses a SUSPENDED member and issues no cookie", async () => {
    h.user.status = USER_STATUSES.SUSPENDED;

    const res = await loginAction({ email: h.user.email, password: "1234" });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/suspended/i);
    expect(h.cookieStore.get("hope_shelter_session")).toBeUndefined();
  });

  it("refuses an INVITED member who has not redeemed their link", async () => {
    h.user.status = USER_STATUSES.INVITED;

    const res = await loginAction({ email: h.user.email, password: "1234" });

    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not been activated/i);
    expect(h.cookieStore.get("hope_shelter_session")).toBeUndefined();
  });

  it("normalises a deprecated role stored on the row", async () => {
    h.user.role = "ADMIN";

    const res = await loginAction({ email: h.user.email, password: "1234" });

    expect(res.success).toBe(true);
    expect(res.user?.role).toBe(ROLES.SUPER_ADMIN);
  });

  it("reads the user exactly once and never re-queries memberStore", async () => {
    await loginAction({ email: h.user.email, password: "1234" });

    expect(h.lookups.count).toBe(1);
    expect(memberStoreCalls.findMemberByEmail).toBe(0);
    // lastLoginAt is still stamped, and awaited so a serverless host cannot
    // suspend execution before the write lands.
    expect(memberStoreCalls.recordLogin).toBe(1);
  });
});
