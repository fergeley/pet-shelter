import { beforeEach, describe, expect, it, vi } from "vitest";

type DeferredWork = () => Promise<unknown>;

const doubles = vi.hoisted(() => ({
  // Explicit test doubles for the two durable-write boundaries.
  recordSponsorshipPledge: vi.fn(),
  issueDonationReceipt: vi.fn(),
  // Explicit test doubles for the external email boundary.
  sendSponsorshipWelcomeEmail: vi.fn(),
  sendDonationReceiptEmail: vi.fn(),
  // This spy captures lifecycle-owned work without running it during the action.
  scheduleAfterResponse: vi.fn(),
  scheduledWork: [] as DeferredWork[],
}));

vi.mock("@/lib/server/sponsorshipLedger", () => {
  class SponsorshipWriteError extends Error {
    readonly cause?: unknown;

    constructor(message: string, cause?: unknown) {
      super(message);
      this.name = "SponsorshipWriteError";
      this.cause = cause;
    }
  }

  return {
    SponsorshipWriteError,
    recordSponsorshipPledge: doubles.recordSponsorshipPledge,
    listPendingSponsorships: vi.fn(),
    rejectPendingSponsorship: vi.fn(),
    settleSponsorship: vi.fn(),
    summarizeSponsorshipsForPet: vi.fn(),
    listSponsorshipsByUserId: vi.fn(),
    reconcileSponsorship: vi.fn(),
    memorySponsorshipCount: vi.fn(() => 0),
    resetSponsorshipLedger: vi.fn(),
  };
});

vi.mock("@/lib/server/donationLedger", () => {
  class ReceiptIssuanceError extends Error {
    readonly cause?: unknown;

    constructor(message: string, cause?: unknown) {
      super(message);
      this.name = "ReceiptIssuanceError";
      this.cause = cause;
    }
  }

  return {
    ReceiptIssuanceError,
    issueDonationReceipt: doubles.issueDonationReceipt,
    listDonationsOrThrow: vi.fn(),
    isLedgerPersistent: vi.fn(() => false),
    formatReceiptNumber: vi.fn(),
    receiptScopeFor: vi.fn(),
    resetDonationLedger: vi.fn(),
  };
});

vi.mock("@/lib/email", () => ({
  sendSponsorshipWelcomeEmail: doubles.sendSponsorshipWelcomeEmail,
  sendDonationReceiptEmail: doubles.sendDonationReceiptEmail,
}));

vi.mock("@/lib/scheduleAfterResponse", () => ({
  scheduleAfterResponse: doubles.scheduleAfterResponse,
}));

vi.mock("@/lib/security/sponsorSession", () => ({
  getCurrentSponsorSession: vi.fn(async () => null),
}));

vi.mock("@/lib/server/petRepository", () => ({
  findServerPetByIdAsync: vi.fn(async (id: string) => ({
    id,
    name: "Submitted Bella",
  })),
  resetPets: vi.fn(),
}));

const sponsorshipInput = {
  petId: "pet-bella",
  petName: "Submitted Bella",
  sponsorName: "Submitted Sponsor",
  sponsorEmail: "submitted@example.com",
  tierId: "vaccine" as const,
  amountMYR: 50,
  frequency: "one_time" as const,
  paymentMethod: "duitnow_qr" as const,
};

const persistedSponsorship = {
  id: "spn-persisted-1",
  petId: "pet-bella",
  petName: "Persisted Bella",
  sponsorName: "Persisted Sponsor",
  sponsorEmail: "persisted@example.com",
  userId: null,
  displayOnWall: false,
  tierId: "vaccine",
  tierName: "Persisted Vaccination Tier",
  frequency: "one_time" as const,
  amountSen: 12_345,
  paymentMethod: "duitnow_qr" as const,
  status: "PENDING_PAYMENT" as const,
  pledgeRef: "HFS-PLG-20260914-123456",
  receiptNumber: null,
  createdAt: "2026-09-14T12:00:00.000Z",
};

const donationInput = {
  donorName: "Submitted Donor",
  donorEmail: "submitted.donor@example.com",
  tierId: "kibble" as const,
  amountMYR: 30,
  frequency: "one_time" as const,
  paymentMethod: "duitnow_qr" as const,
};

const persistedDonation = {
  id: "don-persisted-1",
  receiptNumber: "HFS-DON-202609-0042",
  sequenceScope: "HFS-DON-202609",
  sequenceValue: 42,
  donorName: "Persisted Donor",
  donorEmail: "persisted.donor@example.com",
  tierId: "kibble" as const,
  tierName: "Persisted Nutrition Tier",
  amountSen: 4_321,
  currency: "MYR",
  frequency: "one_time" as const,
  paymentMethod: "duitnow_qr" as const,
  taxDeductibleRef: "persisted-tax-reference",
  shelterRegistrationNo: "persisted-registration",
  issuedAt: "2026-09-14T12:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  doubles.scheduledWork.length = 0;
  doubles.scheduleAfterResponse.mockImplementation((work: DeferredWork) => {
    doubles.scheduledWork.push(work);
  });
  doubles.recordSponsorshipPledge.mockResolvedValue(persistedSponsorship);
  doubles.issueDonationReceipt.mockResolvedValue(persistedDonation);
  doubles.sendSponsorshipWelcomeEmail.mockResolvedValue({ success: true });
  doubles.sendDonationReceiptEmail.mockResolvedValue({ success: true });
});

describe("contribution email lifecycle", () => {
  it("registers the persisted sponsorship DTO and dispatches it only through scheduled work", async () => {
    // Dynamic by harness contract: all repository mocks are registered before the
    // Server Action instantiates its imports.
    const { createPetSponsorshipAction } = await import("@/actions/sponsorships");

    const result = await createPetSponsorshipAction(sponsorshipInput);

    expect(result).toMatchObject({
      success: true,
      data: {
        pledgeRef: persistedSponsorship.pledgeRef,
        petName: persistedSponsorship.petName,
        sponsorName: persistedSponsorship.sponsorName,
        sponsorEmail: persistedSponsorship.sponsorEmail,
        tierName: persistedSponsorship.tierName,
        amountMYR: 123.45,
      },
    });
    expect(doubles.scheduleAfterResponse).toHaveBeenCalledTimes(1);
    expect(doubles.sendSponsorshipWelcomeEmail).not.toHaveBeenCalled();

    await doubles.scheduledWork[0]();

    expect(doubles.sendSponsorshipWelcomeEmail).toHaveBeenCalledOnce();
    expect(doubles.sendSponsorshipWelcomeEmail).toHaveBeenCalledWith(result.data);
  });

  it("registers the persisted donation DTO and dispatches it only through scheduled work", async () => {
    const { submitDonationPledgeAction } = await import("@/actions/donations");

    const result = await submitDonationPledgeAction(donationInput);

    expect(result).toMatchObject({
      success: true,
      data: {
        receiptNumber: persistedDonation.receiptNumber,
        donorName: persistedDonation.donorName,
        donorEmail: persistedDonation.donorEmail,
        tierName: persistedDonation.tierName,
        amountMYR: 43.21,
      },
    });
    expect(doubles.scheduleAfterResponse).toHaveBeenCalledTimes(1);
    expect(doubles.sendDonationReceiptEmail).not.toHaveBeenCalled();

    await doubles.scheduledWork[0]();

    expect(doubles.sendDonationReceiptEmail).toHaveBeenCalledOnce();
    expect(doubles.sendDonationReceiptEmail).toHaveBeenCalledWith(result.data);
  });

  it("does not register sponsorship email work when persistence fails", async () => {
    const { SponsorshipWriteError } = await import("@/lib/server/sponsorshipLedger");
    doubles.recordSponsorshipPledge.mockRejectedValueOnce(
      new SponsorshipWriteError("database did not confirm the pledge")
    );
    const { createPetSponsorshipAction } = await import("@/actions/sponsorships");

    const result = await createPetSponsorshipAction(sponsorshipInput);

    expect(result.success).toBe(false);
    expect(doubles.scheduleAfterResponse).not.toHaveBeenCalled();
    expect(doubles.sendSponsorshipWelcomeEmail).not.toHaveBeenCalled();
  });

  it("does not register donation email work when persistence fails", async () => {
    const { ReceiptIssuanceError } = await import("@/lib/server/donationLedger");
    doubles.issueDonationReceipt.mockRejectedValueOnce(
      new ReceiptIssuanceError("database did not confirm the receipt")
    );
    const { submitDonationPledgeAction } = await import("@/actions/donations");

    const result = await submitDonationPledgeAction(donationInput);

    expect(result.success).toBe(false);
    expect(doubles.scheduleAfterResponse).not.toHaveBeenCalled();
    expect(doubles.sendDonationReceiptEmail).not.toHaveBeenCalled();
  });

  it("keeps a successful sponsorship result settled when deferred email rejects", async () => {
    doubles.sendSponsorshipWelcomeEmail.mockRejectedValueOnce(new Error("mailer unavailable"));
    const { createPetSponsorshipAction } = await import("@/actions/sponsorships");

    const result = await createPetSponsorshipAction(sponsorshipInput);
    expect(result.success).toBe(true);

    await expect(doubles.scheduledWork[0]()).rejects.toThrow("mailer unavailable");
    expect(result).toMatchObject({
      success: true,
      data: { pledgeRef: persistedSponsorship.pledgeRef },
    });
  });

  it("keeps a successful donation result settled when deferred email rejects", async () => {
    doubles.sendDonationReceiptEmail.mockRejectedValueOnce(new Error("mailer unavailable"));
    const { submitDonationPledgeAction } = await import("@/actions/donations");

    const result = await submitDonationPledgeAction(donationInput);
    expect(result.success).toBe(true);

    await expect(doubles.scheduledWork[0]()).rejects.toThrow("mailer unavailable");
    expect(result).toMatchObject({
      success: true,
      data: { receiptNumber: persistedDonation.receiptNumber },
    });
  });
});
