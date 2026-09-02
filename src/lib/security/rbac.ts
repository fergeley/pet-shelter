// Type-only so `session.ts` (and its `next/headers` import) never reaches a
// client bundle that imports a constant from this module.
import type { SessionUser } from "./session";
import {
  normalizeRole,
  permissionsForRole,
  roleHasPermission,
  type Permission,
  type Role,
} from "./permissions";

// Re-exported so the many existing `from "@/lib/security/rbac"` imports keep
// working. `permissions.ts` is the source of truth; do not redefine here.
export {
  ROLES,
  CANONICAL_ROLES,
  PERMISSIONS,
  ROLE_PERMISSIONS,
  ROLE_LABELS,
  ROLE_DESCRIPTIONS,
  USER_STATUSES,
  normalizeRole,
  permissionsForRole,
  roleHasPermission,
  isCanonicalRole,
  isUserStatus,
} from "./permissions";

export type {
  Role,
  CanonicalRole,
  Permission,
  UserStatus,
} from "./permissions";

export class UnauthorizedError extends Error {
  /** HTTP status a route handler should map this to. */
  readonly status = 401;

  constructor(message = "Authentication required. Please sign in.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  /** HTTP status a route handler should map this to. */
  readonly status = 403;

  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/* -------------------------------------------------------------------------- */
/*  Role checks (legacy surface, still used by existing call sites)           */
/* -------------------------------------------------------------------------- */

/**
 * Checks if a session user exists and has one of the allowed roles.
 *
 * Both sides are normalised, so an allow-list written against a deprecated
 * alias (`ROLES.ADMIN`) still matches a session carrying the canonical role
 * (`SUPER_ADMIN`), and vice versa.
 */
export function hasRole(user: SessionUser | null, allowedRoles: Role[]): boolean {
  if (!user) return false;
  const actual = normalizeRole(user.role);
  return allowedRoles.some((allowed) => normalizeRole(allowed) === actual);
}

/**
 * Asserts that the current session user exists and possesses required role permissions.
 * Throws UnauthorizedError or ForbiddenError if check fails.
 */
export function assertAuthorized(
  user: SessionUser | null,
  allowedRoles: Role[]
): asserts user is SessionUser {
  if (!user) {
    throw new UnauthorizedError();
  }
  if (!hasRole(user, allowedRoles)) {
    throw new ForbiddenError(`Role '${user.role}' is not authorized for this operation.`);
  }
}

/* -------------------------------------------------------------------------- */
/*  Permission checks (preferred surface)                                     */
/* -------------------------------------------------------------------------- */

/**
 * True when the session user's role grants `permission`.
 *
 * Prefer this over `hasRole`: a capability question ("may they manage staff?")
 * survives a role being added or renamed, whereas an inline role list does not.
 */
export function hasPermission(user: SessionUser | null, permission: Permission): boolean {
  if (!user) return false;
  return roleHasPermission(user.role, permission);
}

/** True only when the session holds every listed permission. */
export function hasAllPermissions(
  user: SessionUser | null,
  permissions: Permission[]
): boolean {
  if (!user) return false;
  return permissions.every((permission) => hasPermission(user, permission));
}

/** True when the session holds at least one of the listed permissions. */
export function hasAnyPermission(
  user: SessionUser | null,
  permissions: Permission[]
): boolean {
  if (!user) return false;
  return permissions.some((permission) => hasPermission(user, permission));
}

/**
 * Declarative action guard.
 *
 * Throws `UnauthorizedError` (401) when unauthenticated and `ForbiddenError`
 * (403) when authenticated but under-privileged, so callers can map the two
 * cases to distinct responses instead of collapsing both into "denied".
 */
export function assertHasPermission(
  user: SessionUser | null,
  permission: Permission
): asserts user is SessionUser {
  if (!user) {
    throw new UnauthorizedError();
  }
  if (!hasPermission(user, permission)) {
    // Phrasing deliberately keeps "is not authorized for this operation", which
    // `assertAuthorized` has always used and which callers and tests match on;
    // the missing capability is appended rather than replacing it.
    throw new ForbiddenError(
      `Role '${normalizeRole(user.role)}' is not authorized for this operation: ` +
        `it lacks the '${permission}' permission.`
    );
  }
}

/** Guard requiring every listed permission. */
export function assertHasAllPermissions(
  user: SessionUser | null,
  permissions: Permission[]
): asserts user is SessionUser {
  for (const permission of permissions) {
    assertHasPermission(user, permission);
  }
}

/**
 * Maps a thrown guard error to the HTTP status a caller should surface.
 * Anything unrecognised is treated as a 500.
 */
export function statusForError(error: unknown): number {
  if (error instanceof UnauthorizedError) return 401;
  if (error instanceof ForbiddenError) return 403;
  return 500;
}

/** Every permission the session currently holds; useful for UI gating. */
export function permissionsForSession(user: SessionUser | null): readonly Permission[] {
  if (!user) return [];
  return permissionsForRole(user.role);
}
