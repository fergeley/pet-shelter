import type { CanonicalRole, UserStatus } from "@/lib/security/permissions";

/**
 * The staff-member shape the admin console renders.
 *
 * Lives in the domain layer, not beside the repository that produces it,
 * because `src/lib/server/` is barred from the browser bundle
 * (docs/architecture/LAYERS.md §L-B2) and the members table is a `"use client"`
 * component. A type-only import would be erased at build time, but the layer
 * guard reads the import graph as text and cannot tell the difference — and
 * neither can a reader skimming the file. Lifting the shape here is the
 * remedy the guard itself recommends.
 *
 * Deliberately excludes `inviteTokenHash`: the projection carries whether an
 * invitation is outstanding, never the credential that would redeem it.
 */
export interface MemberRecord {
  id: string;
  email: string;
  name: string;
  role: CanonicalRole;
  status: UserStatus;
  lastLoginAt: string | null;
  invitedBy: string | null;
  hasPendingInvite: boolean;
  inviteExpiresAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** How long a staff invitation remains redeemable. */
export const INVITE_TTL_HOURS = 72;

/**
 * The live authorization state of an account, as the database currently has it.
 *
 * Read on every guarded request so a role change or suspension applies at once
 * rather than whenever the 24-hour session cookie happens to expire.
 */
export interface MemberAuthState {
  role: string;
  status: string;
  name: string;
  email: string;
}
