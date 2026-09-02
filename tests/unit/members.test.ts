import { describe, it, expect, beforeEach, vi } from "vitest";
import { sealSession, SESSION_COOKIE_NAME } from "@/lib/security/session";
import { ROLES, type CanonicalRole } from "@/lib/security/permissions";

/**
 * Integration test for the member administration guard chain.
 *
 * Only the outermost edges are mocked — cookies, Postgres, outbound email and
 * cache revalidation. The session sealing, role normalisation, permission
 * matrix, DAL status re-check and action logic all run for real, so a hole in
 * any of them surfaces here.
 */

interface FakeUser {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: string;
  status: string;
  lastLoginAt: Date | null;
  invitedBy: string | null;
  inviteTokenHash: string | null;
  inviteTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const h = vi.hoisted(() => ({
  cookieStore: new Map<string, { name: string; value: string }>(),
  users: [] as FakeUser[],
  auditLogs: [] as Record<string, unknown>[],
  sentInvites: [] as { email: string; token: string; roleLabel: string }[],
  emailShouldFail: { value: false },
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => h.cookieStore.get(name),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      if (options?.maxAge === 0) h.cookieStore.delete(name);
      else h.cookieStore.set(name, { name, value });
    },
    delete: (name: string) => h.cookieStore.delete(name),
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

vi.mock("@/lib/email", () => ({
  sendStaffInvitationEmail: vi.fn(async (invite: { email: string; token: string; roleLabel: string }) => {
    if (h.emailShouldFail.value) {
      return { success: false, error: "Resend rejected the message" };
    }
    h.sentInvites.push({
      email: invite.email,
      token: invite.token,
      roleLabel: invite.roleLabel,
    });
    return { success: true, messageId: "test-message-id" };
  }),
}));

vi.mock("@/lib/prisma", () => {
  function project(user: FakeUser) {
    return { ...user };
  }

  function match(where: Record<string, unknown>, user: FakeUser): boolean {
    if (where.id !== undefined && user.id !== where.id) return false;
    if (where.email !== undefined && user.email !== where.email) return false;
    if (where.status !== undefined && user.status !== where.status) return false;
    if (where.role !== undefined) {
      const roleClause = where.role as { in?: string[] } | string;
      if (typeof roleClause === "string") {
        if (user.role !== roleClause) return false;
      } else if (roleClause.in && !roleClause.in.includes(user.role)) {
        return false;
      }
    }
    return true;
  }

  return {
    prisma: {
      user: {
        findUnique: async ({ where }: { where: Record<string, unknown> }) => {
          const found = h.users.find((u) => match(where, u));
          return found ? project(found) : null;
        },
        findMany: async () =>
          [...h.users]
            .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
            .map(project),
        count: async ({ where }: { where: Record<string, unknown> }) =>
          h.users.filter((u) => match(where, u)).length,
        create: async ({ data }: { data: Record<string, unknown> }) => {
          if (h.users.some((u) => u.email === data.email)) {
            throw new Error("Unique constraint failed on the fields: (`email`)");
          }
          const now = new Date();
          const user: FakeUser = {
            id: `usr-${h.users.length + 1}-${Math.random().toString(36).slice(2, 7)}`,
            email: data.email as string,
            name: data.name as string,
            passwordHash: data.passwordHash as string,
            role: (data.role as string) ?? "STAFF",
            status: (data.status as string) ?? "ACTIVE",
            lastLoginAt: null,
            invitedBy: (data.invitedBy as string) ?? null,
            inviteTokenHash: (data.inviteTokenHash as string) ?? null,
            inviteTokenExpiresAt: (data.inviteTokenExpiresAt as Date) ?? null,
            createdAt: now,
            updatedAt: now,
          };
          h.users.push(user);
          return project(user);
        },
        update: async ({
          where,
          data,
        }: {
          where: Record<string, unknown>;
          data: Record<string, unknown>;
        }) => {
          const user = h.users.find((u) => match(where, u));
          if (!user) throw new Error("Record to update not found.");
          Object.assign(user, data, { updatedAt: new Date() });
          return project(user);
        },
      },
      auditLog: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          h.auditLogs.push(data);
          return data;
        },
        findMany: async () => [],
      },
    },
  };
});

import {
  acceptInvitation,
  inviteMember,
  listMembers,
  resendInvitation,
  toggleMemberStatus,
  updateMemberRole,
} from "@/actions/members";

function addUser(overrides: Partial<FakeUser> & { id: string; email: string }): FakeUser {
  const now = new Date();
  const user: FakeUser = {
    name: "Test User",
    passwordHash: "salt:hash",
    role: ROLES.STAFF,
    status: "ACTIVE",
    lastLoginAt: null,
    invitedBy: null,
    inviteTokenHash: null,
    inviteTokenExpiresAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  } as FakeUser;
  h.users.push(user);
  return user;
}

async function signInAs(user: FakeUser) {
  const token = sealSession({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role as CanonicalRole,
  });
  h.cookieStore.set(SESSION_COOKIE_NAME, { name: SESSION_COOKIE_NAME, value: token });
}

// inviteMember() is rate limited per actor id and the limiter store is
// module-scoped, so each test gets a distinct administrator rather than
// sharing one bucket across the file.
let superAdminCounter = 0;
function nextSuperAdminSeed() {
  superAdminCounter += 1;
  return {
    id: `usr-super-${superAdminCounter}`,
    email: "admin@hopeforstrays.org",
    name: "Dr. Sarah Tan",
    role: ROLES.SUPER_ADMIN,
  };
}

describe("Member administration actions", () => {
  let superAdmin: FakeUser;

  beforeEach(() => {
    h.cookieStore.clear();
    h.users.length = 0;
    h.auditLogs.length = 0;
    h.sentInvites.length = 0;
    h.emailShouldFail.value = false;
    superAdmin = addUser(nextSuperAdminSeed());
  });

  /* ---------------------------------------------------------------- */
  /*  Authorization boundary                                          */
  /* ---------------------------------------------------------------- */

  describe("authorization", () => {
    it("returns 401 to an unauthenticated caller", async () => {
      const res = await listMembers();
      expect(res.success).toBe(false);
      expect(res.status).toBe(401);
    });

    it.each([
      ROLES.ANIMAL_MANAGER,
      ROLES.CONTENT_EDITOR,
      ROLES.VOLUNTEER_COORDINATOR,
      ROLES.STAFF,
    ])("returns 403 to a %s for every member action", async (role) => {
      const target = addUser({ id: "usr-target", email: "target@hopeforstrays.org" });
      const actor = addUser({ id: `usr-${role}`, email: `${role}@hopeforstrays.org`, role });
      await signInAs(actor);

      const results = [
        await listMembers(),
        await inviteMember("new@hopeforstrays.org", "New Person", ROLES.STAFF),
        await updateMemberRole(target.id, ROLES.SUPER_ADMIN),
        await toggleMemberStatus(target.id, "SUSPENDED"),
        await resendInvitation(target.id),
      ];

      for (const res of results) {
        expect(res.success).toBe(false);
        expect(res.status).toBe(403);
      }

      // Nothing leaked and nothing changed.
      expect(h.sentInvites).toHaveLength(0);
      expect(target.role).toBe(ROLES.STAFF);
      expect(target.status).toBe("ACTIVE");
    });

    it("admits a SUPER_ADMIN", async () => {
      await signInAs(superAdmin);
      const res = await listMembers();
      expect(res.success).toBe(true);
      expect(res.data?.some((m) => m.email === superAdmin.email)).toBe(true);
    });

    it("admits a pre-migration ADMIN session", async () => {
      const legacy = addUser({
        id: "usr-legacy",
        email: "legacy@hopeforstrays.org",
        role: "ADMIN",
      });
      await signInAs(legacy);

      const res = await listMembers();
      expect(res.success).toBe(true);
    });

    it("rejects a suspended member holding a still-valid session cookie", async () => {
      await signInAs(superAdmin);
      // The cookie stays valid for 24h; the database is the authority.
      superAdmin.status = "SUSPENDED";

      const res = await listMembers();
      expect(res.success).toBe(false);
      expect(res.status).toBe(401);
    });

    it("applies a role downgrade made after the cookie was issued", async () => {
      await signInAs(superAdmin);
      superAdmin.role = ROLES.STAFF;

      const res = await listMembers();
      expect(res.success).toBe(false);
      expect(res.status).toBe(403);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Invitations                                                     */
  /* ---------------------------------------------------------------- */

  describe("inviteMember", () => {
    beforeEach(async () => {
      await signInAs(superAdmin);
    });

    it("creates an INVITED account and emails a token", async () => {
      const res = await inviteMember("nurul@hopeforstrays.org", "Nurul Aina", ROLES.ANIMAL_MANAGER);

      expect(res.success).toBe(true);
      expect(res.status).toBe(201);
      expect(res.data?.status).toBe("INVITED");
      expect(res.data?.role).toBe(ROLES.ANIMAL_MANAGER);
      expect(res.data?.invitedBy).toBe(superAdmin.id);
      expect(res.data?.hasPendingInvite).toBe(true);

      expect(h.sentInvites).toHaveLength(1);
      expect(h.sentInvites[0].email).toBe("nurul@hopeforstrays.org");
      expect(h.sentInvites[0].token.length).toBeGreaterThan(20);
    });

    it("never exposes the raw token through the action result", async () => {
      await inviteMember("nurul@hopeforstrays.org", "Nurul Aina", ROLES.STAFF);
      const created = h.users.find((u) => u.email === "nurul@hopeforstrays.org");

      // Only the hash is persisted, and it is not the token itself.
      expect(created?.inviteTokenHash).toBeTruthy();
      expect(created?.inviteTokenHash).not.toBe(h.sentInvites[0].token);
      expect(JSON.stringify(await listMembers())).not.toContain(h.sentInvites[0].token);
    });

    it("gives the invited account an unusable password until redemption", async () => {
      await inviteMember("nurul@hopeforstrays.org", "Nurul Aina", ROLES.STAFF);
      const created = h.users.find((u) => u.email === "nurul@hopeforstrays.org");
      expect(created?.passwordHash).toBeTruthy();
      expect(created?.status).toBe("INVITED");
    });

    it("normalises the email and rejects a duplicate", async () => {
      await inviteMember("  Nurul@HopeForStrays.org ", "Nurul Aina", ROLES.STAFF);
      expect(h.users.some((u) => u.email === "nurul@hopeforstrays.org")).toBe(true);

      const dupe = await inviteMember("nurul@hopeforstrays.org", "Someone Else", ROLES.STAFF);
      expect(dupe.success).toBe(false);
      expect(dupe.status).toBe(409);
    });

    it("rejects a malformed email and a non-canonical role", async () => {
      const badEmail = await inviteMember("not-an-email", "Nurul Aina", ROLES.STAFF);
      expect(badEmail.success).toBe(false);
      expect(badEmail.status).toBe(400);

      const badRole = await inviteMember(
        "ok@hopeforstrays.org",
        "Nurul Aina",
        "ADMIN" as CanonicalRole
      );
      expect(badRole.success).toBe(false);
      expect(badRole.status).toBe(400);
    });

    it("keeps the account but reports the failure when the email bounces", async () => {
      h.emailShouldFail.value = true;
      const res = await inviteMember("bounce@hopeforstrays.org", "Bounce Test", ROLES.STAFF);

      expect(res.success).toBe(true);
      expect(res.error).toMatch(/failed to send/i);
      expect(h.users.some((u) => u.email === "bounce@hopeforstrays.org")).toBe(true);
    });

    it("writes an audit entry", async () => {
      await inviteMember("audit@hopeforstrays.org", "Audit Target", ROLES.CONTENT_EDITOR);
      const entry = h.auditLogs.find((log) => log.action === "MEMBER_INVITED");
      expect(entry).toBeDefined();
      expect(entry?.actorEmail).toBe(superAdmin.email);
      expect(entry?.targetEntity).toBe("User");
    });
  });

  describe("resendInvitation", () => {
    beforeEach(async () => {
      await signInAs(superAdmin);
    });

    it("invalidates the previous token", async () => {
      await inviteMember("nurul@hopeforstrays.org", "Nurul Aina", ROLES.STAFF);
      const invited = h.users.find((u) => u.email === "nurul@hopeforstrays.org")!;
      const firstToken = h.sentInvites[0].token;
      const firstHash = invited.inviteTokenHash;

      const res = await resendInvitation(invited.id);
      expect(res.success).toBe(true);
      expect(h.sentInvites).toHaveLength(2);
      expect(h.sentInvites[1].token).not.toBe(firstToken);
      expect(invited.inviteTokenHash).not.toBe(firstHash);

      // The superseded link must no longer redeem.
      const stale = await acceptInvitation({
        email: invited.email,
        token: firstToken,
        password: "BrandNewPassword123",
        confirmPassword: "BrandNewPassword123",
      });
      expect(stale.success).toBe(false);
    });

    it("refuses to re-invite an already active member", async () => {
      const active = addUser({ id: "usr-active", email: "active@hopeforstrays.org" });
      const res = await resendInvitation(active.id);
      expect(res.success).toBe(false);
      expect(res.status).toBe(409);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Role changes                                                    */
  /* ---------------------------------------------------------------- */

  describe("updateMemberRole", () => {
    beforeEach(async () => {
      await signInAs(superAdmin);
    });

    it("changes a role and audits the transition", async () => {
      const target = addUser({ id: "usr-t1", email: "t1@hopeforstrays.org" });

      const res = await updateMemberRole(target.id, ROLES.ANIMAL_MANAGER);
      expect(res.success).toBe(true);
      expect(res.data?.role).toBe(ROLES.ANIMAL_MANAGER);

      const entry = h.auditLogs.find((log) => log.action === "MEMBER_ROLE_CHANGED");
      expect(entry).toBeDefined();
    });

    it("blocks a Super Admin from demoting themselves", async () => {
      const res = await updateMemberRole(superAdmin.id, ROLES.STAFF);
      expect(res.success).toBe(false);
      expect(res.status).toBe(409);
      expect(superAdmin.role).toBe(ROLES.SUPER_ADMIN);
    });

    it("blocks demoting the last active Super Admin", async () => {
      const other = addUser({
        id: "usr-super-2",
        email: "super2@hopeforstrays.org",
        role: ROLES.SUPER_ADMIN,
      });
      // Two admins exist, so the second one may be demoted...
      await signInAs(other);
      const first = await updateMemberRole(superAdmin.id, ROLES.STAFF);
      expect(first.success).toBe(true);

      // ...but now `other` is the only one left and cannot demote itself.
      const second = await updateMemberRole(other.id, ROLES.STAFF);
      expect(second.success).toBe(false);
      expect(second.status).toBe(409);
    });

    it("rejects an unknown member and a deprecated role value", async () => {
      const missing = await updateMemberRole("usr-nope", ROLES.STAFF);
      expect(missing.status).toBe(404);

      const target = addUser({ id: "usr-t2", email: "t2@hopeforstrays.org" });
      const legacy = await updateMemberRole(target.id, "COORDINATOR" as CanonicalRole);
      expect(legacy.success).toBe(false);
      expect(legacy.status).toBe(400);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Status changes                                                  */
  /* ---------------------------------------------------------------- */

  describe("toggleMemberStatus", () => {
    beforeEach(async () => {
      await signInAs(superAdmin);
    });

    it("suspends and reactivates a member", async () => {
      const target = addUser({ id: "usr-s1", email: "s1@hopeforstrays.org" });

      const suspended = await toggleMemberStatus(target.id, "SUSPENDED");
      expect(suspended.success).toBe(true);
      expect(suspended.data?.status).toBe("SUSPENDED");
      expect(h.auditLogs.some((l) => l.action === "MEMBER_SUSPENDED")).toBe(true);

      const restored = await toggleMemberStatus(target.id, "ACTIVE");
      expect(restored.success).toBe(true);
      expect(restored.data?.status).toBe("ACTIVE");
      expect(h.auditLogs.some((l) => l.action === "MEMBER_REACTIVATED")).toBe(true);
    });

    it("blocks self-suspension", async () => {
      const res = await toggleMemberStatus(superAdmin.id, "SUSPENDED");
      expect(res.success).toBe(false);
      expect(res.status).toBe(409);
      expect(superAdmin.status).toBe("ACTIVE");
    });

    it("blocks suspending the last active Super Admin", async () => {
      const other = addUser({
        id: "usr-super-3",
        email: "super3@hopeforstrays.org",
        role: ROLES.SUPER_ADMIN,
      });
      await signInAs(other);

      const res = await toggleMemberStatus(superAdmin.id, "SUSPENDED");
      expect(res.success).toBe(true);

      // `other` is now alone, and self-suspension is blocked regardless.
      const selfRes = await toggleMemberStatus(other.id, "SUSPENDED");
      expect(selfRes.success).toBe(false);
    });

    it("clears a pending invitation when suspending an invitee", async () => {
      await inviteMember("pending@hopeforstrays.org", "Pending Person", ROLES.STAFF);
      const invited = h.users.find((u) => u.email === "pending@hopeforstrays.org")!;
      const token = h.sentInvites[0].token;

      await toggleMemberStatus(invited.id, "SUSPENDED");
      expect(invited.inviteTokenHash).toBeNull();

      const redeem = await acceptInvitation({
        email: invited.email,
        token,
        password: "SomePassword123",
        confirmPassword: "SomePassword123",
      });
      expect(redeem.success).toBe(false);
    });

    it("refuses to activate someone who never redeemed their invitation", async () => {
      await inviteMember("never@hopeforstrays.org", "Never Redeemed", ROLES.STAFF);
      const invited = h.users.find((u) => u.email === "never@hopeforstrays.org")!;

      const res = await toggleMemberStatus(invited.id, "ACTIVE");
      expect(res.success).toBe(false);
      expect(res.status).toBe(409);
    });

    it("rejects INVITED as a hand-settable status", async () => {
      const target = addUser({ id: "usr-s2", email: "s2@hopeforstrays.org" });
      const res = await toggleMemberStatus(target.id, "INVITED");
      expect(res.success).toBe(false);
      expect(res.status).toBe(400);
    });
  });

  /* ---------------------------------------------------------------- */
  /*  Redemption                                                      */
  /* ---------------------------------------------------------------- */

  describe("acceptInvitation", () => {
    // acceptInvitation() is rate limited per email address, so each test
    // redeems a distinct invitee rather than sharing one bucket.
    let inviteeCounter = 0;
    async function issueInvite(email = `nurul${(inviteeCounter += 1)}@hopeforstrays.org`) {
      await signInAs(superAdmin);
      await inviteMember(email, "Nurul Aina", ROLES.ANIMAL_MANAGER);
      h.cookieStore.clear();
      const invited = h.users.find((u) => u.email === email)!;
      const sent = h.sentInvites[h.sentInvites.length - 1];
      expect(sent, "invitation email was not dispatched").toBeDefined();
      return { invited, token: sent.token };
    }

    it("activates the account, signs the member in and audits it", async () => {
      const { invited, token } = await issueInvite();

      const res = await acceptInvitation({
        email: invited.email,
        token,
        password: "MyStrongPassword1",
        confirmPassword: "MyStrongPassword1",
      });

      expect(res.success).toBe(true);
      expect(invited.status).toBe("ACTIVE");
      expect(invited.inviteTokenHash).toBeNull();
      expect(invited.lastLoginAt).not.toBeNull();
      expect(h.cookieStore.get(SESSION_COOKIE_NAME)).toBeDefined();
      expect(h.auditLogs.some((l) => l.action === "MEMBER_INVITE_ACCEPTED")).toBe(true);
    });

    it("burns the token so it cannot be redeemed twice", async () => {
      const { invited, token } = await issueInvite();
      await acceptInvitation({
        email: invited.email,
        token,
        password: "MyStrongPassword1",
        confirmPassword: "MyStrongPassword1",
      });

      const replay = await acceptInvitation({
        email: invited.email,
        token,
        password: "AnotherPassword1",
        confirmPassword: "AnotherPassword1",
      });
      expect(replay.success).toBe(false);
    });

    it("rejects a wrong token, an expired token and a mismatched password", async () => {
      const { invited, token } = await issueInvite();

      const wrong = await acceptInvitation({
        email: invited.email,
        token: "definitely-not-the-token",
        password: "MyStrongPassword1",
        confirmPassword: "MyStrongPassword1",
      });
      expect(wrong.success).toBe(false);
      expect(invited.status).toBe("INVITED");

      const mismatch = await acceptInvitation({
        email: invited.email,
        token,
        password: "MyStrongPassword1",
        confirmPassword: "DifferentPassword1",
      });
      expect(mismatch.success).toBe(false);
      expect(mismatch.status).toBe(400);

      invited.inviteTokenExpiresAt = new Date(Date.now() - 1000);
      const expired = await acceptInvitation({
        email: invited.email,
        token,
        password: "MyStrongPassword1",
        confirmPassword: "MyStrongPassword1",
      });
      expect(expired.success).toBe(false);
      expect(expired.error).toMatch(/expired/i);
    });

    it("rejects a password below the minimum length", async () => {
      const { invited, token } = await issueInvite();
      const res = await acceptInvitation({
        email: invited.email,
        token,
        password: "short",
        confirmPassword: "short",
      });
      expect(res.success).toBe(false);
      expect(res.status).toBe(400);
      expect(invited.status).toBe("INVITED");
    });

    it("does not reveal whether an unknown email has an account", async () => {
      const res = await acceptInvitation({
        email: "ghost@hopeforstrays.org",
        token: "some-token",
        password: "MyStrongPassword1",
        confirmPassword: "MyStrongPassword1",
      });
      expect(res.success).toBe(false);
      expect(res.error).toBe("This invitation is no longer valid.");
    });
  });
});
