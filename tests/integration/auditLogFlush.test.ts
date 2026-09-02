import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { getPrismaDouble, resetPrismaDouble, type PrismaDouble } from "./support/prismaDouble";

/**
 * Tier 3a — the audit trail's fire-and-forget write, under `STRICT_PERSISTENCE=true`.
 *
 * `recordAuditLog` is synchronous by design: a privileged mutation must not wait
 * on its audit row. Its Prisma write is therefore a floating promise, and a
 * floating promise that rethrows would raise an unhandled rejection and tear
 * down the process rather than fail a test. `flushAuditLogWrites()` is the seam
 * that converts a swallowed failure into an observable one, and this file is
 * what proves that seam works — without it, "the audit log is written" is a
 * claim no assertion in the codebase can reach.
 */

vi.mock("@/lib/server/prisma", async () => {
  const { createPrismaDouble } = await import("./support/prismaDouble");
  const double = createPrismaDouble();
  return { prisma: double, default: double, disconnectPrisma: vi.fn().mockResolvedValue(undefined) };
});

let prismaDouble: PrismaDouble;

beforeAll(async () => {
  prismaDouble = await getPrismaDouble();
});

const ENTRY = {
  actorId: "usr-admin-01",
  actorEmail: "admin@hopeforstrays.org",
  actorRole: "ADMIN",
  action: "PET_ARCHIVED",
  entity: "Pet",
  entityId: "itest-pet-1",
  details: { petName: "Bella", isArchived: true },
};

beforeEach(() => {
  resetPrismaDouble(prismaDouble);
});

describe("audit log write flushing", () => {
  it("runs with the fallback disabled", async () => {
    const { isStrictPersistence } = await import("@/lib/persistenceMode");

    expect(isStrictPersistence()).toBe(true);
  });

  describe("the happy path", () => {
    it("persists the actor, the action and the target", async () => {
      const { recordAuditLog, flushAuditLogWrites } = await import("@/lib/domain/auditLog");

      recordAuditLog(ENTRY);
      await flushAuditLogWrites();

      expect(prismaDouble.auditLog.create).toHaveBeenCalledTimes(1);
      // The column names differ from the domain field names
      // (`entity` -> `targetEntity`), so this pins the mapping, not just the call.
      expect(prismaDouble.auditLog.create.mock.calls[0][0].data).toMatchObject({
        actorId: ENTRY.actorId,
        actorEmail: ENTRY.actorEmail,
        actorRole: ENTRY.actorRole,
        action: "PET_ARCHIVED",
        targetEntity: "Pet",
        targetId: "itest-pet-1",
      });
    });

    it("returns the entry synchronously, before the write settles", async () => {
      const { recordAuditLog, flushAuditLogWrites } = await import("@/lib/domain/auditLog");
      let settle!: () => void;
      prismaDouble.auditLog.create.mockReturnValue(
        new Promise<void>((resolve) => {
          settle = resolve;
        })
      );

      const entry = recordAuditLog(ENTRY);

      // The whole reason the write floats: the mutation that triggered it must
      // not block on the audit row.
      expect(entry.id).toMatch(/^audit-/);
      expect(entry.createdAt).toBeTruthy();

      settle();
      await flushAuditLogWrites();
    });

    it("drains every write issued, not just the last", async () => {
      const { recordAuditLog, flushAuditLogWrites } = await import("@/lib/domain/auditLog");

      recordAuditLog({ ...ENTRY, entityId: "itest-pet-1" });
      recordAuditLog({ ...ENTRY, entityId: "itest-pet-2" });
      recordAuditLog({ ...ENTRY, entityId: "itest-pet-3" });
      await flushAuditLogWrites();

      expect(prismaDouble.auditLog.create).toHaveBeenCalledTimes(3);
    });

    it("resolves when nothing has been logged", async () => {
      const { flushAuditLogWrites } = await import("@/lib/domain/auditLog");

      await expect(flushAuditLogWrites()).resolves.toBeUndefined();
    });
  });

  describe("when the write fails under strict persistence", () => {
    beforeEach(() => {
      prismaDouble.auditLog.create.mockRejectedValue(new Error("audit_logs table is missing"));
    });

    it("does not throw at the call site", async () => {
      const { recordAuditLog, flushAuditLogWrites } = await import("@/lib/domain/auditLog");

      // A privileged mutation must still complete. Throwing here would make a
      // broken audit table roll back the pet archive that triggered it.
      expect(() => recordAuditLog(ENTRY)).not.toThrow();

      await flushAuditLogWrites().catch(() => undefined);
    });

    it("surfaces the failure at the flush instead", async () => {
      const { recordAuditLog, flushAuditLogWrites } = await import("@/lib/domain/auditLog");

      recordAuditLog(ENTRY);

      await expect(flushAuditLogWrites()).rejects.toThrow(/audit_logs table is missing/);
    });

    it("keeps the in-memory trail readable even though the row was lost", async () => {
      const { recordAuditLog, flushAuditLogWrites, getAuditLogs } = await import(
        "@/lib/domain/auditLog"
      );

      recordAuditLog(ENTRY);
      await flushAuditLogWrites().catch(() => undefined);

      // The fallback is what keeps `/admin/audit` populated during an outage.
      expect(getAuditLogs(10)[0]).toMatchObject({ action: "PET_ARCHIVED", entityId: "itest-pet-1" });
    });

    it("clears the recorded failure so the next flush is not a false alarm", async () => {
      const { recordAuditLog, flushAuditLogWrites } = await import("@/lib/domain/auditLog");
      recordAuditLog(ENTRY);
      await expect(flushAuditLogWrites()).rejects.toThrow();

      prismaDouble.auditLog.create.mockResolvedValue({});
      recordAuditLog(ENTRY);

      // A sticky error would make every later assertion in a suite fail with a
      // failure that belongs to an earlier test.
      await expect(flushAuditLogWrites()).resolves.toBeUndefined();
    });
  });

  describe("as a privileged mutation actually uses it", () => {
    it("records an actor for an archive, and the flush proves the row was written", async () => {
      const { resetAuditLogs, flushAuditLogWrites } = await import("@/lib/domain/auditLog");
      const { archiveServerPet } = await import("@/lib/server/petRepository");
      resetAuditLogs();

      // `pet-001` is a committed fixture, so the cache lookup inside the
      // repository resolves without needing a database.
      await archiveServerPet("pet-001", true, {
        id: "usr-admin-01",
        email: "admin@hopeforstrays.org",
        name: "Dr. Sarah Tan",
        role: "ADMIN",
        expiresAt: Date.now() + 60_000,
      });
      await flushAuditLogWrites();

      const written = prismaDouble.auditLog.create.mock.calls.map((call) => call[0].data);
      expect(written).toContainEqual(
        expect.objectContaining({
          action: "PET_ARCHIVED",
          targetEntity: "Pet",
          targetId: "pet-001",
          actorId: "usr-admin-01",
        })
      );
    });

    it("fails the flush when that mutation's audit row cannot be stored", async () => {
      const { flushAuditLogWrites } = await import("@/lib/domain/auditLog");
      const { archiveServerPet } = await import("@/lib/server/petRepository");
      prismaDouble.auditLog.create.mockRejectedValue(new Error("audit insert refused"));

      await archiveServerPet("pet-002", true, {
        id: "usr-admin-01",
        email: "admin@hopeforstrays.org",
        name: "Dr. Sarah Tan",
        role: "ADMIN",
        expiresAt: Date.now() + 60_000,
      });

      // The archive itself still succeeded; only the flush reports the loss.
      await expect(flushAuditLogWrites()).rejects.toThrow(/audit insert refused/);
    });
  });
});
