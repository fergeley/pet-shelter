"use server";

import { checkRateLimit } from "@/lib/security/rateLimit";
import { hashPassword, verifyPassword, timingSafeCompare } from "@/lib/security/crypto";
import {
  setSessionCookie,
  clearSessionCookie,
  getCurrentSession,
  SessionUser,
} from "@/lib/security/session";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { findUserByEmail, createUser, UserRecord } from "@/lib/server/userStore";
import { Role, ROLES, normalizeRole } from "@/lib/security/rbac";
import { getStaffInviteSecret } from "@/lib/security/secrets";
import { recordLogin } from "@/lib/server/memberStore";
import { USER_STATUSES } from "@/lib/security/permissions";

export interface AuthResponse {
  success: boolean;
  user?: SessionUser;
  error?: string;
  retryAfterSeconds?: number;
}

/**
 * Internal helper to seal session and issue signed cookie.
 */
async function establishSession(user: Pick<UserRecord, "id" | "email" | "name" | "role">): Promise<SessionUser> {
  return setSessionCookie({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
}

/**
 * Validates and authenticates existing staff or volunteers.
 */
export async function loginAction(credentials: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  const emailKey = (credentials.email || "").trim().toLowerCase();

  if (!emailKey || !credentials.password) {
    return { success: false, error: "Email and password are required." };
  }

  // 1. Sliding Window Rate Limiting (5 attempts / min)
  const rateLimit = checkRateLimit(`login:${emailKey}`, 5, 60000);
  if (!rateLimit.success) {
    return {
      success: false,
      error: `Too many login attempts. Please wait ${rateLimit.retryAfterSeconds} seconds before trying again.`,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  // 2. Fetch User & Verify Password
  const user = await findUserByEmail(emailKey);
  // master removed the universal "1234" fallback outright rather than gating it
  // to non-production, which is the stricter of the two fixes. Kept as-is.
  const isValidPassword = user ? await verifyPassword(credentials.password, user.passwordHash) : false;

  if (!user || !isValidPassword) {
    recordAuditLog({
      actorId: "anonymous",
      actorEmail: emailKey,
      actorRole: "UNKNOWN",
      action: "AUTH_LOGIN_FAILED",
      entity: "Auth",
      entityId: emailKey,
      details: { reason: "Invalid email or password" },
    });

    return {
      success: false,
      error: "Invalid staff email or password. Please check your credentials.",
    };
  }

  // 3. Account Status Gate
  // A suspended member must not be able to obtain a fresh 24-hour session, and
  // an invitee's password hash is unusable until they redeem their link.
  //
  // `status` rides along on the same userStore row that supplied the password
  // hash, so this costs no extra query. In-memory demo accounts report ACTIVE.
  if (user.status !== USER_STATUSES.ACTIVE) {
    recordAuditLog({
      actorId: user.id,
      actorEmail: user.email,
      actorRole: normalizeRole(user.role),
      action: "AUTH_LOGIN_BLOCKED",
      entity: "Auth",
      entityId: user.id,
      details: { reason: `Account status is ${user.status}` },
    });

    return {
      success: false,
      error:
        user.status === USER_STATUSES.SUSPENDED
          ? "This staff account has been suspended. Contact a shelter administrator."
          : "This account has not been activated yet. Please use the invitation link sent to your email.",
    };
  }

  // 4. Establish Session & Record Audit Log
  // Normalised so a row still carrying a deprecated alias issues a canonical
  // session; a role changed in /admin/members applies from the next sign-in.
  const effectiveRole = normalizeRole(user.role);
  const session = await establishSession({ ...user, role: effectiveRole });

  // Awaited deliberately. Serverless hosts suspend execution once the response
  // is sent, so a fire-and-forget write here can simply be dropped — and this
  // is one indexed UPDATE by primary key.
  await recordLogin(user.id);

  recordAuditLog({
    actorId: user.id,
    actorEmail: user.email,
    actorRole: effectiveRole,
    action: "AUTH_LOGIN_SUCCESS",
    entity: "Auth",
    entityId: user.id,
  });

  return { success: true, user: session };
}

/**
 * Registers a new staff or volunteer account with scrypt password hashing.
 */
export async function registerAction(data: {
  name: string;
  email: string;
  password: string;
  /**
   * @deprecated Ignored. Self-registration always yields STAFF; elevated roles
   * are granted only through an administrator's invitation.
   */
  role?: Role;
  /** @deprecated Ignored. Retained so existing callers still compile. */
  staffInviteCode?: string;
}): Promise<AuthResponse> {
  const name = (data.name || "").trim();
  const email = (data.email || "").trim().toLowerCase();
  const password = data.password || "";

  // Self-service registration is capped at the least-privileged role. The
  // previous shared invite PIN let anyone mint themselves an ADMIN account,
  // which defeated the entire permission matrix. Privileged access now comes
  // exclusively from inviteMember() in src/actions/members.ts.
  const role: Role = ROLES.STAFF;

  if (name.length < 2) {
    return { success: false, error: "Please enter a valid full name (at least 2 characters)." };
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { success: false, error: "Please enter a valid email address." };
  }

  if (password.length < 8) {
    return { success: false, error: "Password must be at least 8 characters in length." };
  }

  // 1. Rate Limiting on Registrations
  const rateLimit = checkRateLimit(`register:${email || "anon"}`, 5, 60000);
  if (!rateLimit.success) {
    return {
      success: false,
      error: `Too many registration attempts. Please wait ${rateLimit.retryAfterSeconds} seconds before trying again.`,
      retryAfterSeconds: rateLimit.retryAfterSeconds,
    };
  }

  // 2. Invite Guard — required for EVERY role.
  // A shelter has no anonymous-staff use case, and the default STAFF role is
  // authorized for getApplications(), which returns applicant PII (PDPA 2010).
  const inviteCode = (data.staffInviteCode || "").trim();
  if (!inviteCode || !timingSafeCompare(inviteCode, getStaffInviteSecret())) {
    return {
      success: false,
      error: "A valid staff invite code is required to register an account. Please contact a shelter administrator.",
    };
  }

  // 3. Duplicate Check
  const existingUser = await findUserByEmail(email);
  if (existingUser) {
    return {
      success: false,
      error: "An account with this email address already exists. Please sign in instead.",
    };
  }

  // 4. Hash Password & Persist
  const passwordHash = await hashPassword(password);
  const newUser = await createUser({ name, email, passwordHash, role });

  // 5. Establish Session & Record Audit Log
  const session = await establishSession(newUser);
  recordAuditLog({
    actorId: newUser.id,
    actorEmail: newUser.email,
    actorRole: newUser.role,
    action: "AUTH_REGISTER_SUCCESS",
    entity: "Auth",
    entityId: newUser.id,
    details: { assignedRole: newUser.role },
  });

  return { success: true, user: session };
}

/**
 * Clears session and logs logout audit trail.
 */
export async function logoutAction(): Promise<{ success: boolean }> {
  const currentSession = await getCurrentSession();

  if (currentSession) {
    recordAuditLog({
      actorId: currentSession.id,
      actorEmail: currentSession.email,
      actorRole: currentSession.role,
      action: "AUTH_LOGOUT",
      entity: "Auth",
      entityId: currentSession.id,
    });
  }

  await clearSessionCookie();
  return { success: true };
}

/**
 * Retrieves the currently authenticated session user.
 */
export async function getCurrentUserAction(): Promise<{ user: SessionUser | null }> {
  const user = await getCurrentSession();
  return { user };
}
