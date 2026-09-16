import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSponsorshipRejectionFakeDb,
  REJECTION_AUDIT_CONTEXT,
  REJECTION_PLEDGE_REF,
} from "../support/sponsorshipRejectionFakeDb";

const REJECTION_INSTANT = new Date("2999-01-16T04:00:00.000Z");

let fakeDb: ReturnType<typeof createSponsorshipRejectionFakeDb>;

/** Load only after the per-test Prisma double is registered. */
async function loadSubject() {
  return import("@/lib/server/sponsorshipLedger");
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("DATABASE_URL", "postgresql://probe:probe@localhost:5432/probe");
  fakeDb = createSponsorshipRejectionFakeDb();
  vi.doMock("@/lib/server/prisma", () => ({
    prisma: fakeDb.prisma,
    default: fakeDb.prisma,
  }));
});

afterEach(() => {
  vi.doUnmock("@/lib/server/prisma");
  vi.unstubAllEnvs();
});

describe("rejectPendingSponsorship transaction boundary", () => {
  it("returns the winning update row and inserts its actor/reason audit in that transaction", async () => {
    const { rejectPendingSponsorship } = await loadSubject();

    const outcome = await rejectPendingSponsorship(REJECTION_PLEDGE_REF, {
      ...REJECTION_AUDIT_CONTEXT,
      now: REJECTION_INSTANT,
    });

    expect(outcome).toMatchObject({
      status: "rejected",
      record: { pledgeRef: REJECTION_PLEDGE_REF, status: "CANCELLED" },
    });
    expect(fakeDb.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(fakeDb.transactionClient.petSponsorship.updateManyAndReturn).toHaveBeenCalledWith({
      where: { pledgeRef: REJECTION_PLEDGE_REF, status: "PENDING_PAYMENT" },
      data: { status: "CANCELLED", cancelledAt: REJECTION_INSTANT },
    });

    // The winning UPDATE already returned the row. Reading it back creates a race
    // window and is unnecessary; neither the transaction nor root delegate may do it.
    expect(fakeDb.transactionClient.petSponsorship.findUnique).not.toHaveBeenCalled();
    expect(fakeDb.prisma.petSponsorship.findUnique).not.toHaveBeenCalled();

    expect(fakeDb.transactionClient.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: "SPONSORSHIP_REJECTED",
        actorId: REJECTION_AUDIT_CONTEXT.actorId,
        actorEmail: REJECTION_AUDIT_CONTEXT.actorEmail,
        actorRole: REJECTION_AUDIT_CONTEXT.actorRole,
        targetEntity: "PetSponsorship",
        targetId: REJECTION_PLEDGE_REF,
        metadata: expect.objectContaining({
          pledgeRef: REJECTION_PLEDGE_REF,
          reason: REJECTION_AUDIT_CONTEXT.reason,
        }),
      }),
    });
    expect(fakeDb.prisma.auditLog.create).not.toHaveBeenCalled();
    expect(fakeDb.currentSponsorship()).toMatchObject({
      status: "CANCELLED",
      cancelledAt: REJECTION_INSTANT,
    });
    expect(fakeDb.auditRows()).toHaveLength(1);
  });

  it("rejects and rolls the cancellation back when the audit insert rejects", async () => {
    const { rejectPendingSponsorship } = await loadSubject();
    fakeDb.failNextAuditInsert();

    await expect(
      rejectPendingSponsorship(REJECTION_PLEDGE_REF, {
        ...REJECTION_AUDIT_CONTEXT,
        now: REJECTION_INSTANT,
      })
    ).rejects.toThrow("audit insert refused");

    expect(fakeDb.prisma.$transaction).toHaveBeenCalledTimes(1);
    expect(fakeDb.transactionClient.auditLog.create).toHaveBeenCalledTimes(1);
    expect(fakeDb.currentSponsorship()).toMatchObject({
      status: "PENDING_PAYMENT",
      cancelledAt: null,
    });
    expect(fakeDb.auditRows()).toEqual([]);
  });

  it("classifies a zero-row guard without inserting an audit entry", async () => {
    const { rejectPendingSponsorship } = await loadSubject();
    fakeDb.setSponsorship({
      status: "ACTIVE",
      receiptNumber: "HFS-DON-299901-0001",
    });

    await expect(
      rejectPendingSponsorship(REJECTION_PLEDGE_REF, {
        ...REJECTION_AUDIT_CONTEXT,
        now: REJECTION_INSTANT,
      })
    ).resolves.toEqual({
      status: "already_reconciled",
      receiptNumber: "HFS-DON-299901-0001",
    });

    expect(fakeDb.transactionClient.petSponsorship.updateManyAndReturn).toHaveBeenCalledTimes(1);
    expect(fakeDb.transactionClient.petSponsorship.findUnique).toHaveBeenCalledTimes(1);
    expect(fakeDb.transactionClient.auditLog.create).not.toHaveBeenCalled();
    expect(fakeDb.auditRows()).toEqual([]);
  });
});
