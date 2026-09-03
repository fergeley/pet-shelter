import { prisma } from "@/lib/server/prisma";
import { generateSecureToken, hashPassword, verifyPassword } from "@/lib/security/crypto";
import {
  USER_STATUSES,
  normalizeRole,
  type CanonicalRole,
  type UserStatus,
} from "@/lib/security/permissions";
import {
  INVITE_TTL_HOURS,
  type MemberAuthState,
  type MemberRecord,
} from "@/lib/domain/member";

// Re-exported so callers already importing these from the store keep working;
// the shapes themselves live in the domain layer so client components can use
// them without importing the repository (LAYERS.md §L-B2).
export { INVITE_TTL_HOURS };
export type { MemberRecord };

/**
 * Data access for staff member administration.
 *
 * Kept separate from `userStore.ts`, which serves the authentication path and
 * carries an in-memory demo fallback. Member administration is a real
 * privileged operation, so it talks to Postgres only and surfaces failures
 * instead of silently succeeding against a process-local map.
 */

interface RawMember {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  lastLoginAt: Date | null;
  invitedBy: string | null;
  inviteTokenHash: string | null;
  inviteTokenExpiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const MEMBER_SELECT = {
  id: true,
  email: true,
  name: true,
  role: true,
  status: true,
  lastLoginAt: true,
  invitedBy: true,
  inviteTokenHash: true,
  inviteTokenExpiresAt: true,
  createdAt: true,
  updatedAt: true,
} as const;

function toIso(value: Date | null): string | null {
  return value ? value.toISOString() : null;
}

/** Projects a database row to the shape the admin UI consumes. */
function toMemberRecord(row: RawMember): MemberRecord {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: normalizeRole(row.role),
    status: (row.status as UserStatus) ?? USER_STATUSES.ACTIVE,
    lastLoginAt: toIso(row.lastLoginAt),
    invitedBy: row.invitedBy,
    // The hash itself never leaves this module.
    hasPendingInvite: Boolean(row.inviteTokenHash),
    inviteExpiresAt: toIso(row.inviteTokenExpiresAt),
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * The live role and status of one account, or null when no row exists.
 *
 * Exists so `security/dal.ts` can refresh a session without importing Prisma:
 * only the repository layer may reach the client (LAYERS.md §L-B2), and the
 * DAL is policy, not access.
 */
export async function findMemberAuthStateById(id: string): Promise<MemberAuthState | null> {
  return prisma.user.findUnique({
    where: { id },
    select: { role: true, status: true, name: true, email: true },
  });
}

/** All staff accounts, newest first. */
export async function listMemberRecords(): Promise<MemberRecord[]> {
  const rows = await prisma.user.findMany({
    select: MEMBER_SELECT,
    orderBy: { createdAt: "desc" },
  });
  return (rows as unknown as RawMember[]).map(toMemberRecord);
}

export async function findMemberById(id: string): Promise<MemberRecord | null> {
  const row = await prisma.user.findUnique({ where: { id }, select: MEMBER_SELECT });
  return row ? toMemberRecord(row as unknown as RawMember) : null;
}

export async function findMemberByEmail(email: string): Promise<MemberRecord | null> {
  const row = await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: MEMBER_SELECT,
  });
  return row ? toMemberRecord(row as unknown as RawMember) : null;
}

/** Number of ACTIVE super admins; used to block the last-admin lockout. */
export async function countActiveSuperAdmins(): Promise<number> {
  return prisma.user.count({
    where: {
      status: USER_STATUSES.ACTIVE,
      // Legacy ADMIN rows normalise to SUPER_ADMIN, so both must count.
      role: { in: ["SUPER_ADMIN", "ADMIN"] },
    },
  });
}

export interface IssuedInvite {
  member: MemberRecord;
  /** Raw token. Emailed once, never persisted, never logged. */
  token: string;
  expiresAt: Date;
}

/**
 * Creates an INVITED member holding a hashed, expiring invitation token.
 *
 * The account is given an unusable random password hash so that the row cannot
 * be authenticated against until the invitation is redeemed.
 */
export async function createInvitedMember(input: {
  email: string;
  name: string;
  role: CanonicalRole;
  invitedBy: string;
}): Promise<IssuedInvite> {
  const token = generateSecureToken();
  const inviteTokenHash = await hashPassword(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);
  const unusablePassword = await hashPassword(generateSecureToken(48));

  const row = await prisma.user.create({
    data: {
      email: input.email.trim().toLowerCase(),
      name: input.name.trim(),
      role: input.role,
      status: USER_STATUSES.INVITED,
      invitedBy: input.invitedBy,
      passwordHash: unusablePassword,
      inviteTokenHash,
      inviteTokenExpiresAt: expiresAt,
    },
    select: MEMBER_SELECT,
  });

  return { member: toMemberRecord(row as unknown as RawMember), token, expiresAt };
}

/** Mints a fresh token for an existing INVITED member, invalidating the old one. */
export async function reissueInvite(userId: string): Promise<IssuedInvite> {
  const token = generateSecureToken();
  const inviteTokenHash = await hashPassword(token);
  const expiresAt = new Date(Date.now() + INVITE_TTL_HOURS * 60 * 60 * 1000);

  const row = await prisma.user.update({
    where: { id: userId },
    data: { inviteTokenHash, inviteTokenExpiresAt: expiresAt },
    select: MEMBER_SELECT,
  });

  return { member: toMemberRecord(row as unknown as RawMember), token, expiresAt };
}

export async function updateMemberRoleRecord(
  userId: string,
  role: CanonicalRole
): Promise<MemberRecord> {
  const row = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: MEMBER_SELECT,
  });
  return toMemberRecord(row as unknown as RawMember);
}

/**
 * Sets a member's status.
 *
 * Suspending clears any outstanding invitation token so a suspended invitee
 * cannot redeem a link that was already in their inbox.
 */
export async function updateMemberStatusRecord(
  userId: string,
  status: UserStatus
): Promise<MemberRecord> {
  const row = await prisma.user.update({
    where: { id: userId },
    data:
      status === USER_STATUSES.SUSPENDED
        ? { status, inviteTokenHash: null, inviteTokenExpiresAt: null }
        : { status },
    select: MEMBER_SELECT,
  });
  return toMemberRecord(row as unknown as RawMember);
}

/** Stamps a successful sign-in. Best-effort: never blocks the login itself. */
export async function recordLogin(userId: string): Promise<void> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: { lastLoginAt: new Date() },
    });
  } catch {
    // Demo/in-memory accounts have no row, and a login must not fail because
    // the telemetry write did.
  }
}

/**
/**
 * The single message shown for every failed redemption.
 *
 * `acceptInvitation` is unauthenticated, so distinct per-cause messages would
 * let anyone probe an email address and learn from the wording whether it has
 * a staff account, whether that account is still pending, and whether its
 * invitation is live. The specific `reason` below is for the audit log only —
 * never return it to the caller.
 */
export const INVITE_REDEMPTION_FAILED_MESSAGE =
  "This invitation link is not valid. It may have expired, already been used, " +
  "or been replaced by a newer one. Ask an administrator to send a new invitation.";

/**
 * Verifies a raw invitation token against the named account.
 *
 * Scoped by email rather than searched by token, because only the scrypt hash
 * is stored and hashes are not reversible or indexable.
 *
 * `reason` is diagnostic and MUST NOT be surfaced to an unauthenticated
 * caller; see INVITE_REDEMPTION_FAILED_MESSAGE.
 */
export async function verifyInviteToken(
  email: string,
  token: string
): Promise<{ ok: true; member: MemberRecord } | { ok: false; reason: string }> {
  const row = (await prisma.user.findUnique({
    where: { email: email.trim().toLowerCase() },
    select: MEMBER_SELECT,
  })) as unknown as RawMember | null;

  if (!row || !row.inviteTokenHash || !row.inviteTokenExpiresAt) {
    return { ok: false, reason: "No pending invitation for this address." };
  }
  if (row.status !== USER_STATUSES.INVITED) {
    return { ok: false, reason: `Account status is ${row.status}, not INVITED.` };
  }
  if (row.inviteTokenExpiresAt.getTime() < Date.now()) {
    return { ok: false, reason: "Invitation token expired." };
  }
  if (!(await verifyPassword(token, row.inviteTokenHash))) {
    return { ok: false, reason: "Invitation token did not match the stored hash." };
  }

  return { ok: true, member: toMemberRecord(row) };
}

/** Redeems an invitation: sets the chosen password, activates, burns the token. */
export async function activateInvitedMember(
  userId: string,
  passwordHash: string
): Promise<MemberRecord> {
  const row = await prisma.user.update({
    where: { id: userId },
    data: {
      passwordHash,
      status: USER_STATUSES.ACTIVE,
      inviteTokenHash: null,
      inviteTokenExpiresAt: null,
      lastLoginAt: new Date(),
    },
    select: MEMBER_SELECT,
  });
  return toMemberRecord(row as unknown as RawMember);
}
