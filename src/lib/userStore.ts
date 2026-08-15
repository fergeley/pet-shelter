import { hashPassword } from "@/lib/security/crypto";
import { Role, ROLES } from "@/lib/security/rbac";
import { prisma } from "@/lib/prisma";

export interface UserRecord {
  id: string;
  email: string;
  name: string;
  passwordHash: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

// Initial pre-seeded demo staff accounts
const INITIAL_STAFF_USERS: Array<Omit<UserRecord, "passwordHash"> & { initialPassword: string }> = [
  {
    id: "usr-admin-01",
    email: "admin@hopeforstrays.org",
    name: "Dr. Sarah Tan",
    role: ROLES.ADMIN,
    initialPassword: "admin123",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
  },
  {
    id: "usr-coord-01",
    email: "coordinator@hopeforstrays.org",
    name: "Priya Devi",
    role: ROLES.COORDINATOR,
    initialPassword: "coord123",
    createdAt: "2026-01-02T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  },
  {
    id: "usr-staff-01",
    email: "staff@hopeforstrays.org",
    name: "Ahmad Razak",
    role: ROLES.STAFF,
    initialPassword: "staff123",
    createdAt: "2026-01-03T00:00:00.000Z",
    updatedAt: "2026-01-03T00:00:00.000Z",
  },
  {
    id: "usr-vol-01",
    email: "volunteer@hopeforstrays.org",
    name: "Mei Ling",
    role: ROLES.VOLUNTEER,
    initialPassword: "vol123",
    createdAt: "2026-01-04T00:00:00.000Z",
    updatedAt: "2026-01-04T00:00:00.000Z",
  },
];

// In-memory fallback user store
const usersStore: Map<string, UserRecord> = new Map();
let isInitialized = false;
let initPromise: Promise<void> | null = null;

function ensureInitialized(): Promise<void> {
  if (isInitialized) return Promise.resolve();
  if (!initPromise) {
    initPromise = (async () => {
      for (const staff of INITIAL_STAFF_USERS) {
        const passwordHash = await hashPassword(staff.initialPassword);
        usersStore.set(staff.email.toLowerCase(), {
          id: staff.id,
          email: staff.email.toLowerCase(),
          name: staff.name,
          passwordHash,
          role: staff.role,
          createdAt: staff.createdAt,
          updatedAt: staff.updatedAt,
        });
      }
      isInitialized = true;
    })();
  }
  return initPromise;
}

/**
 * Finds a user by email (case-insensitive) from Prisma with memory fallback.
 */
export async function findUserByEmail(email: string): Promise<UserRecord | null> {
  const normalized = email.trim().toLowerCase();
  try {
    const dbUser = await prisma.user.findUnique({
      where: { email: normalized },
    });
    if (dbUser) {
      return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        passwordHash: dbUser.passwordHash,
        role: dbUser.role as Role,
        createdAt: dbUser.createdAt.toISOString(),
        updatedAt: dbUser.updatedAt.toISOString(),
      };
    }
  } catch {
    // Fallback to in-memory store if DB is offline or mock mode
  }

  await ensureInitialized();
  return usersStore.get(normalized) || null;
}

/**
 * Finds a user by unique ID.
 */
export async function findUserById(id: string): Promise<UserRecord | null> {
  try {
    const dbUser = await prisma.user.findUnique({
      where: { id },
    });
    if (dbUser) {
      return {
        id: dbUser.id,
        email: dbUser.email,
        name: dbUser.name,
        passwordHash: dbUser.passwordHash,
        role: dbUser.role as Role,
        createdAt: dbUser.createdAt.toISOString(),
        updatedAt: dbUser.updatedAt.toISOString(),
      };
    }
  } catch {
    // Fallback
  }

  await ensureInitialized();
  for (const user of usersStore.values()) {
    if (user.id === id) return user;
  }
  return null;
}

/**
 * Creates and registers a new user in Prisma and memory store.
 */
export async function createUser(data: {
  name: string;
  email: string;
  passwordHash: string;
  role: Role;
}): Promise<UserRecord> {
  const normalizedEmail = data.email.trim().toLowerCase();
  await ensureInitialized();

  if (usersStore.has(normalizedEmail)) {
    throw new Error(`A user with email '${normalizedEmail}' already exists.`);
  }

  const now = new Date().toISOString();
  let createdUser: UserRecord = {
    id: `usr-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    email: normalizedEmail,
    name: data.name.trim(),
    passwordHash: data.passwordHash,
    role: data.role,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const dbCreated = await prisma.user.create({
      data: {
        email: normalizedEmail,
        name: data.name.trim(),
        passwordHash: data.passwordHash,
        role: data.role,
      },
    });
    createdUser = {
      id: dbCreated.id,
      email: dbCreated.email,
      name: dbCreated.name,
      passwordHash: dbCreated.passwordHash,
      role: dbCreated.role as Role,
      createdAt: dbCreated.createdAt.toISOString(),
      updatedAt: dbCreated.updatedAt.toISOString(),
    };
  } catch {
    // Retain in-memory copy
  }

  usersStore.set(normalizedEmail, createdUser);
  return createdUser;
}

/**
 * Returns a list of all registered users (excluding sensitive password hashes).
 */
export async function listUsers(): Promise<Omit<UserRecord, "passwordHash">[]> {
  try {
    const dbUsers = await prisma.user.findMany({
      orderBy: { createdAt: "asc" },
    });
    if (dbUsers && dbUsers.length > 0) {
      return dbUsers.map((u) => ({
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role as Role,
        createdAt: u.createdAt.toISOString(),
        updatedAt: u.updatedAt.toISOString(),
      }));
    }
  } catch {
    // Fallback
  }

  await ensureInitialized();
  return Array.from(usersStore.values()).map((user) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  }));
}

/**
 * Resets the in-memory store back to initial seed state (primarily for automated testing).
 */
export async function resetUserStore(): Promise<void> {
  usersStore.clear();
  isInitialized = false;
  initPromise = null;
  await ensureInitialized();
}
