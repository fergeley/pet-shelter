"use server";

import { headers } from "next/headers";
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
 * The caller's address, as far as this deployment can be trusted to know it.
 *
 * Header order is a security decision, not a convenience. `x-forwarded-for` is
 * *appended to* by each hop, so when the client sends one of its own the
 * leftmost entry is a value the attacker chose — reading it first would let
 * them mint a fresh rate-limit bucket per request and turn the limiter below
 * into decoration. `x-vercel-forwarded-for` and `x-real-ip` are written by the
 * edge and overwrite anything the client sent, so they are consulted first.
 *
 * ceiling: behind a proxy that sets neither, this falls back to the leftmost
 * `x-forwarded-for` entry and is therefore only as trustworthy as that proxy.
 * Anything stronger needs a configured trusted-proxy hop count, which this
 * deployment has no way to express yet.
 */
async function getClientIp(): Promise<string> {
  try {
    const requestHeaders = await headers();

    const platformIp = requestHeaders.get("x-vercel-forwarded-for") ?? requestHeaders.get("x-real-ip");
    if (platformIp?.trim()) return platformIp.trim();

    const forwarded = requestHeaders.get("x-forwarded-for")?.split(",")[0]?.trim();
    if (forwarded) return forwarded;
  } catch {
    // No request scope (a direct unit-test call). Falls through.
  }

  // One shared bucket rather than no bucket: an unattributable caller is
  // limited alongside every other unattributable caller, never exempted.
  return "unknown";
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
  //
  // Per address as well as per account. Keying on the email alone bounds how
  // fast one account can be attacked and does nothing about the attack that
  // actually works against a staff directory: one common password tried once
  // against every address in turn, which never spends a second attempt on any
  // single key. Same defect as the registration limiter below, same fix, and
  // fixed here too because leaving one of two identical holes open is how the
  // next reader concludes the shape is acceptable.
  const loginAddressLimit = checkRateLimit(`login:ip:${await getClientIp()}`, 20, 60000);
  if (!loginAddressLimit.success) {
    return {
      success: false,
      error: `Too many login attempts. Please wait ${loginAddressLimit.retryAfterSeconds} seconds before trying again.`,
      retryAfterSeconds: loginAddressLimit.retryAfterSeconds,
    };
  }

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
  /**
   * Required. Compared against `STAFF_INVITE_SECRET` in constant time; without
   * a match no account is created, whatever else the payload says.
   *
   * This was documented as `@deprecated Ignored` while step 2 below enforced
   * it — a stale note on the only gate standing in front of applicant PII, and
   * exactly the sort of thing a reader trusts instead of the code.
   */
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
  //
  // Two *independent* budgets, and deliberately not one composite key. The
  // address budget is what makes the invite guard below non-enumerable, and it
  // only works because the email is absent from its key.
  //
  // `register:${email}` alone was the defect — `src/lib/security/secrets.ts`
  // names it at getStaffInviteSecret(): the email is attacker-supplied, so a
  // caller walking the invite code just varies the address and draws a fresh
  // 5-per-minute budget on every single request. Folding the IP *into* that key
  // as `register:${ip}:${email}` does not fix it and is strictly worse: a
  // composite key is a narrower key, so every distinct email still opens a
  // fresh bucket, and a distributed caller now gets one per (ip, email) pair.
  // Widening a key never narrows what it limits.
  //
  // ceiling: `checkRateLimit` is a per-process Map, so on a serverless host
  // each warm instance counts separately and a botnet is not bounded by either
  // budget. Bounding those needs shared state (Redis, or Postgres) — out of
  // scope here, and not a reason to leave the single-host case open.
  const ip = await getClientIp();

  const addressLimit = checkRateLimit(`register:ip:${ip}`, 10, 60000);
  if (!addressLimit.success) {
    return {
      success: false,
      error: `Too many registration attempts. Please wait ${addressLimit.retryAfterSeconds} seconds before trying again.`,
      retryAfterSeconds: addressLimit.retryAfterSeconds,
    };
  }

  const rateLimit = checkRateLimit(`register:email:${email || "anon"}`, 5, 60000);
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
