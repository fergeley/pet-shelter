import { prisma } from "@/lib/prisma";
import type { AuditLog as PrismaAuditLog } from "@prisma/client";

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

  // Asynchronously persist to PostgreSQL without blocking execution
  prisma.auditLog
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
    .catch(() => {
      // Ignored if DB offline; memory store maintains continuity
    });

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
      return (dbLogs as PrismaAuditLog[]).map((log: PrismaAuditLog) => ({
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
  } catch {
    // Fallback
  }

  return auditLogsStore.slice(0, limit);
}

/**
 * Synchronous in-memory lookup.
 */
export function getAuditLogs(limit = 50): AuditEntry[] {
  return auditLogsStore.slice(0, limit);
}
