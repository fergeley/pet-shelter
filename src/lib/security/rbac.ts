import { SessionUser } from "./session";

export const ROLES = {
  ADMIN: "ADMIN",
  COORDINATOR: "COORDINATOR",
  STAFF: "STAFF",
  VOLUNTEER: "VOLUNTEER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export class UnauthorizedError extends Error {
  constructor(message = "Authentication required. Please sign in.") {
    super(message);
    this.name = "UnauthorizedError";
  }
}

export class ForbiddenError extends Error {
  constructor(message = "You do not have permission to perform this action.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

/**
 * Checks if a session user exists and has one of the allowed roles.
 */
export function hasRole(user: SessionUser | null, allowedRoles: Role[]): boolean {
  if (!user) return false;
  return allowedRoles.includes(user.role);
}

/**
 * Asserts that the current session user exists and possesses required role permissions.
 * Throws UnauthorizedError or ForbiddenError if check fails.
 */
export function assertAuthorized(user: SessionUser | null, allowedRoles: Role[]): asserts user is SessionUser {
  if (!user) {
    throw new UnauthorizedError();
  }
  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(`Role '${user.role}' is not authorized for this operation.`);
  }
}

/**
 * Roles permitted to edit public financial-transparency content.
 *
 * The transparency specification names these roles `SUPER_ADMIN` and
 * `CONTENT_EDITOR`. This deployment's `Role` enum (prisma/schema.prisma) has
 * carried four values since the schema was written, and every session token in
 * circulation is signed against that union, so the two spec roles are mapped
 * onto their existing equivalents rather than migrated:
 *
 *   SUPER_ADMIN   -> ADMIN        (full shelter administration)
 *   CONTENT_EDITOR -> COORDINATOR (publishes public-facing content)
 *
 * Keeping the mapping in one named constant means renaming the enum later is a
 * single-line change here plus a migration, not a hunt through call sites.
 */
export const TRANSPARENCY_EDITOR_ROLES: Role[] = [ROLES.ADMIN, ROLES.COORDINATOR];
