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
