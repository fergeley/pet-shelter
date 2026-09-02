/**
 * Permission catalogue and role -> permission matrix.
 *
 * Deliberately free of `next/*` and `node:*` imports so client components
 * (e.g. the admin navigation) can evaluate permissions without pulling the
 * server-only session module into the browser bundle.
 */

export const ROLES = {
  // Canonical roles
  SUPER_ADMIN: "SUPER_ADMIN",
  ANIMAL_MANAGER: "ANIMAL_MANAGER",
  CONTENT_EDITOR: "CONTENT_EDITOR",
  VOLUNTEER_COORDINATOR: "VOLUNTEER_COORDINATOR",
  STAFF: "STAFF",

  // Deprecated aliases. Retained because existing `users.role` rows and
  // already-issued session cookies still carry them. Never assign these to a
  // new record; `normalizeRole` folds them into the canonical set on read.
  ADMIN: "ADMIN",
  COORDINATOR: "COORDINATOR",
  VOLUNTEER: "VOLUNTEER",
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** The five roles a member may actually be assigned. */
export const CANONICAL_ROLES = [
  ROLES.SUPER_ADMIN,
  ROLES.ANIMAL_MANAGER,
  ROLES.CONTENT_EDITOR,
  ROLES.VOLUNTEER_COORDINATOR,
  ROLES.STAFF,
] as const;

export type CanonicalRole = (typeof CANONICAL_ROLES)[number];

const LEGACY_ROLE_MAP: Record<string, CanonicalRole> = {
  ADMIN: ROLES.SUPER_ADMIN,
  COORDINATOR: ROLES.VOLUNTEER_COORDINATOR,
  VOLUNTEER: ROLES.STAFF,
};

/**
 * Folds a stored or session-carried role into the canonical set.
 *
 * Anything unrecognised degrades to STAFF (the least-privileged role) rather
 * than throwing, so a malformed cookie cannot escalate and cannot hard-fail a
 * render.
 */
export function normalizeRole(role: string | null | undefined): CanonicalRole {
  if (!role) return ROLES.STAFF;
  const upper = role.toUpperCase();
  if ((CANONICAL_ROLES as readonly string[]).includes(upper)) {
    return upper as CanonicalRole;
  }
  return LEGACY_ROLE_MAP[upper] ?? ROLES.STAFF;
}

export const USER_STATUSES = {
  ACTIVE: "ACTIVE",
  INVITED: "INVITED",
  SUSPENDED: "SUSPENDED",
} as const;

export type UserStatus = (typeof USER_STATUSES)[keyof typeof USER_STATUSES];

export const PERMISSIONS = {
  /** Invite staff, change their role, suspend or reactivate them. */
  MANAGE_MEMBERS: "MANAGE_MEMBERS",
  /** See the staff roster without being able to change it. */
  VIEW_MEMBERS: "VIEW_MEMBERS",
  /** Create, edit, archive pet profiles. */
  MANAGE_PETS: "MANAGE_PETS",
  /** Gallery photos, uploads, QR codes. */
  MANAGE_PET_MEDIA: "MANAGE_PET_MEDIA",
  /** Read adoption / volunteer applications. */
  VIEW_APPLICATIONS: "VIEW_APPLICATIONS",
  /** Advance application state, add review notes, send correspondence. */
  REVIEW_APPLICATIONS: "REVIEW_APPLICATIONS",
  /** Permanently remove an application record. */
  DELETE_APPLICATIONS: "DELETE_APPLICATIONS",
  /** FAQs, transparency figures, community bulletins. */
  MANAGE_CONTENT: "MANAGE_CONTENT",
  /** Shelter-wide settings. */
  MANAGE_SETTINGS: "MANAGE_SETTINGS",
  /** Read the immutable audit trail. */
  VIEW_AUDIT_LOG: "VIEW_AUDIT_LOG",
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = Object.values(PERMISSIONS) as Permission[];

/**
 * The single source of truth for what each role may do.
 *
 * SUPER_ADMIN is derived from the catalogue rather than enumerated, so a newly
 * added permission is granted to it automatically and cannot be silently
 * orphaned.
 */
export const ROLE_PERMISSIONS: Record<CanonicalRole, readonly Permission[]> = {
  [ROLES.SUPER_ADMIN]: ALL_PERMISSIONS,

  [ROLES.ANIMAL_MANAGER]: [
    PERMISSIONS.MANAGE_PETS,
    PERMISSIONS.MANAGE_PET_MEDIA,
    PERMISSIONS.VIEW_APPLICATIONS,
  ],

  [ROLES.CONTENT_EDITOR]: [PERMISSIONS.MANAGE_CONTENT],

  [ROLES.VOLUNTEER_COORDINATOR]: [
    PERMISSIONS.VIEW_APPLICATIONS,
    PERMISSIONS.REVIEW_APPLICATIONS,
    PERMISSIONS.MANAGE_SETTINGS,
    PERMISSIONS.VIEW_AUDIT_LOG,
  ],

  [ROLES.STAFF]: [PERMISSIONS.VIEW_APPLICATIONS],
};

/** Human-readable labels for the admin UI. */
export const ROLE_LABELS: Record<CanonicalRole, string> = {
  [ROLES.SUPER_ADMIN]: "Super Admin",
  [ROLES.ANIMAL_MANAGER]: "Animal Manager",
  [ROLES.CONTENT_EDITOR]: "Content Editor",
  [ROLES.VOLUNTEER_COORDINATOR]: "Volunteer Coordinator",
  [ROLES.STAFF]: "Staff",
};

export const ROLE_DESCRIPTIONS: Record<CanonicalRole, string> = {
  [ROLES.SUPER_ADMIN]: "Unrestricted platform access, including staff management.",
  [ROLES.ANIMAL_MANAGER]: "Manage pet profiles, gallery photos, and QR codes.",
  [ROLES.CONTENT_EDITOR]: "Manage FAQs, transparency data, and community bulletins.",
  [ROLES.VOLUNTEER_COORDINATOR]: "Manage volunteer applications and shelter settings.",
  [ROLES.STAFF]: "Standard read-only operational access.",
};

/** Returns the canonical permission list for a role (legacy names accepted). */
export function permissionsForRole(role: string | null | undefined): readonly Permission[] {
  return ROLE_PERMISSIONS[normalizeRole(role)];
}

/**
 * Pure permission check against a bare role string.
 *
 * Use `hasPermission` / `assertHasPermission` from `rbac.ts` when a session
 * object is available; those additionally reject a missing session.
 */
export function roleHasPermission(
  role: string | null | undefined,
  permission: Permission
): boolean {
  return permissionsForRole(role).includes(permission);
}

/** True when `role` is one of the five assignable roles (aliases excluded). */
export function isCanonicalRole(role: unknown): role is CanonicalRole {
  return typeof role === "string" && (CANONICAL_ROLES as readonly string[]).includes(role);
}

/** True when `status` is a valid `UserStatus`. */
export function isUserStatus(status: unknown): status is UserStatus {
  return typeof status === "string" && status in USER_STATUSES;
}
