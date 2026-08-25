import { prisma } from "@/lib/prisma";
import { handlePersistenceError, isStrictPersistence } from "@/lib/persistenceMode";

interface DbAuditLogRecord {
  id: string;
  actorId: string | null;
  actorEmail: string;
  actorRole: string;
  action: string;
  targetEntity: string;
  targetId: string | null;
  metadata?: unknown;
  createdAt: Date | string;
}

export interface AuditEntry {
  id: string;
  actorId: string;
  actorEmail: string;
  actorRole: string;
  action: string; // e.g. "APPLICATION_APPROVED", "PET_CREATED", "STATUS_UPDATED"
  entity: string; // "AdoptionApplication" | "Pet" | "ShelterSettings" | "Auth"
  entityId: string;
  details?: Record<string, unknown>;
  createdAt: string;
}

// In-memory persistent array for demonstration, testing, and offline fallback
const auditLogsStore: AuditEntry[] = [];

/**
 * Writes issued by `recordAuditLog` that have not settled yet.
 *
 * `recordAuditLog` is synchronous by design — a privileged mutation should not
 * wait on the audit row — so its Prisma call is a floating promise. That is
 * fine when failures are swallowed, but strict persistence has to surface them
 * somehow, and rethrowing inside a floating `.catch()` would raise an
 * *unhandled rejection* that tears down the Node process instead of failing a
 * test. So the write is parked here and its error captured, and
 * `flushAuditLogWrites()` is what converts it into a throw the caller can see.
 */
const pendingAuditWrites = new Set<Promise<void>>();
let lastAuditWriteError: unknown = null;

/**
 * Awaits every audit write issued so far.
 *
 * Under `STRICT_PERSISTENCE=true` this rethrows the first failure, giving the
 * fire-and-forget write path a deterministic assertion point:
 *
 * ```ts
 * recordAuditLog(entry);
 * await expect(flushAuditLogWrites()).rejects.toThrow();
 * ```
 *
 * Outside strict mode it simply drains, which is also what an integration test
 * wants before asserting on persisted rows.
 */
export async function flushAuditLogWrites(): Promise<void> {
  // Looped: settling one batch can enqueue another if a caller logged again
  // while we were awaiting. Entries evict themselves, so the set drains.
  while (pendingAuditWrites.size > 0) {
    await Promise.all(pendingAuditWrites);
  }
  if (isStrictPersistence() && lastAuditWriteError !== null) {
    const err = lastAuditWriteError;
    lastAuditWriteError = null;
    throw err;
  }
}

/**
 * Clears the in-memory audit trail and any recorded write failure.
 *
 * Test-only. Wired into the global `beforeEach` in `tests/setup/nextMocks.ts`
 * so entries logged by one test cannot be counted by the next.
 */
export function resetAuditLogs(): void {
  auditLogsStore.length = 0;
  pendingAuditWrites.clear();
  lastAuditWriteError = null;
}

/**
 * Records an immutable audit log entry in memory and persists to PostgreSQL via Prisma.
 */
export function recordAuditLog(entry: Omit<AuditEntry, "id" | "createdAt">): AuditEntry {
  const newEntry: AuditEntry = {
    ...entry,
    id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    createdAt: new Date().toISOString(),
  };

  auditLogsStore.unshift(newEntry);

  // Keep last 1,000 entries in memory
  if (auditLogsStore.length > 1000) {
    auditLogsStore.pop();
  }

  // Asynchronously persist to PostgreSQL without blocking execution. The catch
  // never rethrows — see `pendingAuditWrites` — it records, and
  // `flushAuditLogWrites()` decides whether that record becomes a throw.
  const write: Promise<void> = prisma.auditLog
    .create({
      data: {
        action: entry.action,
        actorId: entry.actorId,
        actorEmail: entry.actorEmail,
        actorRole: entry.actorRole,
        targetEntity: entry.entity,
        targetId: entry.entityId,
        details: JSON.stringify(entry.details || {}),
        metadata: entry.details ? (entry.details as object) : undefined,
      },
    })
    .then(
      () => undefined,
      (err: unknown) => {
        lastAuditWriteError = err;
        if (!isStrictPersistence() && process.env.NODE_ENV === "development") {
          console.warn(
            "[Database Store] Audit log write fallback notice:",
            err instanceof Error ? err.message : err
          );
        }
      }
    )
    .finally(() => {
      // Self-eviction keeps the set bounded in a long-lived server process,
      // where nothing ever calls `flushAuditLogWrites()`.
      pendingAuditWrites.delete(write);
    });

  pendingAuditWrites.add(write);

  return newEntry;
}

/**
 * Retrieves latest audit log entries from Prisma or memory fallback.
 */
export async function getAuditLogsAsync(limit = 50): Promise<AuditEntry[]> {
  try {
    const dbLogs = await prisma.auditLog.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
    });

    if (dbLogs && dbLogs.length > 0) {
      return (dbLogs as unknown as DbAuditLogRecord[]).map((log: DbAuditLogRecord) => ({
        id: log.id,
        actorId: log.actorId || "",
        actorEmail: log.actorEmail,
        actorRole: log.actorRole,
        action: log.action,
        entity: log.targetEntity,
        entityId: log.targetId || "",
        details: log.metadata ? (log.metadata as Record<string, unknown>) : undefined,
        createdAt: typeof log.createdAt === "string" ? log.createdAt : new Date(log.createdAt).toISOString(),
      }));
    }
  } catch (err) {
    handlePersistenceError("Prisma audit log query", err, "read");
  }

  return auditLogsStore.slice(0, limit);
}

/**
 * Synchronous in-memory lookup.
 */
export function getAuditLogs(limit = 50): AuditEntry[] {
  return auditLogsStore.slice(0, limit);
}
