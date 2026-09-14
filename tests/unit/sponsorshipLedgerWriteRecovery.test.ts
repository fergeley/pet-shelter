import { beforeEach, describe, expect, it, vi } from "vitest";
import { senFromRinggit } from "@/lib/domain/money";

const doubles = vi.hoisted(() => ({
  create: vi.fn(),
  findPet: vi.fn(),
  findSponsor: vi.fn(),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    petSponsorship: { create: doubles.create },
    pet: { findUnique: doubles.findPet },
    sponsor: { findUnique: doubles.findSponsor },
  },
}));

vi.mock("@/lib/server/donationLedger", () => ({
  ReceiptIssuanceError: class ReceiptIssuanceError extends Error {},
  drawAndInsert: vi.fn(),
  isLedgerPersistent: vi.fn(() => true),
  issueReceiptInMemory: vi.fn(),
  resetDonationLedger: vi.fn(),
  withReceiptTransaction: vi.fn(),
}));

const draft = {
  petId: "pet-live",
  petName: "Milo",
  sponsorName: "Aisyah Rahman",
  sponsorEmail: "aisyah@example.com",
  userId: "sponsor-deleted",
  displayOnWall: true,
  tierId: "vaccine",
  tierName: "Core Vaccination & Deworming",
  frequency: "one_time" as const,
  amountSen: senFromRinggit(50),
  paymentMethod: "duitnow_qr" as const,
  pledgeRef: "HFS-PLG-RECOVERY",
};

const storedRow = {
  id: "pledge-1",
  ...draft,
  userId: null,
  status: "PENDING_PAYMENT",
  receiptNumber: null,
  sponsorPhone: null,
  taxIdOrIc: null,
  notes: null,
  createdAt: new Date("2026-09-14T12:00:00.000Z"),
};

function foreignKeyViolation(): Error & { code: string } {
  return Object.assign(new Error("Foreign key constraint failed"), { code: "P2003" });
}

describe("persistent sponsorship write recovery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("drops only a sponsor link deleted between identity lookup and insert", async () => {
    doubles.create.mockRejectedValueOnce(foreignKeyViolation()).mockResolvedValueOnce(storedRow);
    doubles.findPet.mockResolvedValueOnce({ id: draft.petId });
    doubles.findSponsor.mockResolvedValueOnce(null);

    const { recordSponsorshipPledge } = await import("@/lib/server/sponsorshipLedger");
    const record = await recordSponsorshipPledge(draft);

    expect(doubles.create).toHaveBeenCalledTimes(2);
    expect(doubles.create.mock.calls[1][0].data).toMatchObject({
      petId: draft.petId,
      userId: null,
    });
    expect(record.petId).toBe(draft.petId);
    expect(record.userId).toBeNull();
  });

  it("wraps a second foreign-key race in the ledger's declared error", async () => {
    doubles.create.mockRejectedValueOnce(foreignKeyViolation()).mockRejectedValueOnce(
      foreignKeyViolation()
    );
    doubles.findPet.mockResolvedValueOnce({ id: draft.petId });
    doubles.findSponsor.mockResolvedValueOnce(null);

    const { recordSponsorshipPledge, SponsorshipWriteError } = await import(
      "@/lib/server/sponsorshipLedger"
    );

    await expect(recordSponsorshipPledge(draft)).rejects.toBeInstanceOf(SponsorshipWriteError);
  });
});
