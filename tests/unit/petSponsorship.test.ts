import { describe, it, expect } from "vitest";
import { senFromInteger, senFromRinggit } from "@/lib/domain/money";
import {
  DEFAULT_SPONSORSHIP_GOAL_SEN,
  MIN_SPONSORSHIP_SEN,
  SponsorshipAggregateRow,
  countsTowardFunding,
  emptySponsorshipSummary,
  generatePledgeRef,
  reconciliationNotice,
  shouldShowSocialProof,
  summarizePetSponsorships,
} from "@/lib/domain/petSponsorship";
import { petSponsorshipSchema, isPaymentMethodEnabled } from "@/lib/validations/sponsorship";
import {
  findSponsorshipByPledgeRef,
  recordSponsorshipPledge,
  reconcileSponsorship,
  summarizeSponsorshipsForPet,
} from "@/lib/server/sponsorshipLedger";
import {
  createPetSponsorshipAction,
  getPetSponsorshipSummaryAction,
} from "@/actions/sponsorships";
import { findDonationByReceiptNumber } from "@/lib/server/donationLedger";

const rows = (...items: [string, number, string][]): SponsorshipAggregateRow[] =>
  items.map(([sponsorEmail, sen, status]) => ({
    sponsorEmail,
    amountSen: senFromInteger(sen),
    status: status as SponsorshipAggregateRow["status"],
  }));

describe("sponsorship summary: only reconciled money is funding", () => {
  it("ignores pending, cancelled and expired commitments", () => {
    const summary = summarizePetSponsorships(
      "pet-001",
      rows(
        ["a@example.com", 10000, "ACTIVE"],
        ["b@example.com", 50000, "PENDING_PAYMENT"],
        ["c@example.com", 50000, "CANCELLED"],
        ["d@example.com", 50000, "EXPIRED"]
      ),
      senFromInteger(100000)
    );

    expect(summary.supporterCount).toBe(1);
    expect(summary.fundedSen).toBe(10000);
    expect(summary.isFullyFunded).toBe(false);
  });

  it("counts distinct supporters, not distinct gifts", () => {
    const summary = summarizePetSponsorships(
      "pet-001",
      rows(
        ["repeat@example.com", 3000, "ACTIVE"],
        ["repeat@example.com", 3000, "ACTIVE"],
        ["REPEAT@Example.com ", 3000, "ACTIVE"],
        ["other@example.com", 3000, "ACTIVE"]
      ),
      senFromInteger(100000)
    );

    expect(summary.supporterCount).toBe(2);
    expect(summary.fundedSen).toBe(12000);
  });

  it("marks an animal funded once the target is met, and clamps past it", () => {
    const met = summarizePetSponsorships(
      "pet-002",
      rows(["a@example.com", 150000, "ACTIVE"]),
      senFromInteger(150000)
    );
    expect(met.isFullyFunded).toBe(true);
    expect(met.progressPercent).toBe(100);

    const over = summarizePetSponsorships(
      "pet-003",
      rows(["a@example.com", 500000, "ACTIVE"]),
      senFromInteger(150000)
    );
    expect(over.progressPercent).toBe(100);
    expect(over.fundedSen).toBe(500000);
  });

  it("never treats a zero target as instantly funded", () => {
    const summary = summarizePetSponsorships("pet-004", [], senFromInteger(0));
    expect(summary.goalSen).toBe(DEFAULT_SPONSORSHIP_GOAL_SEN);
    expect(summary.isFullyFunded).toBe(false);
  });

  it("hides social proof until someone is actually counted", () => {
    expect(shouldShowSocialProof(emptySponsorshipSummary("pet-005"))).toBe(false);
    expect(
      shouldShowSocialProof(
        summarizePetSponsorships("pet-005", rows(["a@example.com", 10000, "PENDING_PAYMENT"]))
      )
    ).toBe(false);
    expect(
      shouldShowSocialProof(
        summarizePetSponsorships("pet-005", rows(["a@example.com", 10000, "ACTIVE"]))
      )
    ).toBe(true);
  });

  it("only counts ACTIVE toward funding", () => {
    expect(countsTowardFunding("ACTIVE")).toBe(true);
    expect(countsTowardFunding("PENDING_PAYMENT")).toBe(false);
    expect(countsTowardFunding("CANCELLED")).toBe(false);
    expect(countsTowardFunding("EXPIRED")).toBe(false);
  });
});

describe("a pledge reference is not a receipt number", () => {
  it("uses a prefix a coordinator can tell apart at a glance", () => {
    const ref = generatePledgeRef();
    expect(ref).toMatch(/^HFS-PLG-\d{8}-\d{6}$/);
    expect(ref.startsWith("HFS-DON")).toBe(false);
  });

  it("tells the supporter the receipt follows reconciliation", () => {
    expect(reconciliationNotice("one_time", "duitnow_qr")).toMatch(/Section 44\(6\)/);
    expect(reconciliationNotice("monthly", "duitnow_qr")).toMatch(/standing instruction/);
    expect(reconciliationNotice("one_time", "card")).toMatch(/not enabled/);
  });
});

describe("sponsorship validation", () => {
  const base = {
    petId: "pet-001",
    petName: "Milo",
    sponsorName: "Aisyah Rahman",
    sponsorEmail: "aisyah@example.com",
    tierId: "vaccine" as const,
    frequency: "monthly" as const,
    amountMYR: 80,
    paymentMethod: "duitnow_qr" as const,
  };

  it("accepts a well-formed commitment", () => {
    const parsed = petSponsorshipSchema.parse(base);
    expect(parsed.amountMYR).toBe(80);
    expect(parsed.frequency).toBe("monthly");
  });

  it("enforces the RM 10.00 floor", () => {
    expect(() => petSponsorshipSchema.parse({ ...base, amountMYR: 9 })).toThrow(/RM 10\.00/);
    expect(petSponsorshipSchema.parse({ ...base, amountMYR: 10 }).amountMYR).toBe(10);
    expect(MIN_SPONSORSHIP_SEN).toBe(1000);
  });

  it("requires an animal, and tolerates one with no database row", () => {
    expect(() => petSponsorshipSchema.parse({ ...base, petName: "" })).toThrow();
    expect(petSponsorshipSchema.parse({ ...base, petId: undefined }).petId).toBeUndefined();
  });

  it("enables only the rails the shelter can settle", () => {
    expect(isPaymentMethodEnabled("duitnow_qr")).toBe(true);
    expect(isPaymentMethodEnabled("online_banking")).toBe(true);
    expect(isPaymentMethodEnabled("card")).toBe(false);
  });
});

describe("the ledger: a commitment starts unpaid", () => {
  const draft = (over: Record<string, unknown> = {}) => ({
    petId: "pet-100",
    petName: "Milo",
    sponsorName: "Aisyah Rahman",
    sponsorEmail: "aisyah@example.com",
    tierId: "vaccine",
    tierName: "Core Vaccination & Deworming",
    frequency: "one_time" as const,
    amountSen: senFromRinggit(50),
    paymentMethod: "duitnow_qr" as const,
    pledgeRef: generatePledgeRef(),
    ...over,
  });

  it("records it as PENDING_PAYMENT with no receipt number", async () => {
    const record = await recordSponsorshipPledge(draft());

    expect(record.status).toBe("PENDING_PAYMENT");
    expect(record.receiptNumber).toBeNull();
    expect(record.pledgeRef).toMatch(/^HFS-PLG-/);
  });

  it("keeps it out of the animal's figures until reconciled", async () => {
    const record = await recordSponsorshipPledge(draft());

    const before = await summarizeSponsorshipsForPet("pet-100");
    expect(before.supporterCount).toBe(0);
    expect(before.fundedSen).toBe(0);

    await reconcileSponsorship(record.pledgeRef, "HFS-DON-202609-0001", "coordinator@example.com");

    const after = await summarizeSponsorshipsForPet("pet-100");
    expect(after.supporterCount).toBe(1);
    expect(after.fundedSen).toBe(5000);
  });

  it("refuses to attach a second receipt to the same money", async () => {
    const record = await recordSponsorshipPledge(draft());

    const first = await reconcileSponsorship(record.pledgeRef, "HFS-DON-202609-0002", "a@b.c");
    const second = await reconcileSponsorship(record.pledgeRef, "HFS-DON-202609-0003", "a@b.c");

    expect(first.status).toBe("reconciled");
    expect(second.status).toBe("already_reconciled");
    if (second.status === "already_reconciled") {
      expect(second.receiptNumber).toBe("HFS-DON-202609-0002");
    }
  });

  it("reports an unknown pledge rather than inventing one", async () => {
    const outcome = await reconcileSponsorship("HFS-PLG-20260101-000000", "HFS-DON-202609-0004", "a@b.c");
    expect(outcome.status).toBe("not_found");
  });
});

describe("createPetSponsorshipAction", () => {
  const input = (over: Record<string, unknown> = {}) => ({
    petId: "pet-200",
    petName: "Bella",
    sponsorName: "Aisyah Rahman",
    sponsorEmail: `sponsor.${Math.random().toString(36).slice(2, 9)}@example.com`,
    tierId: "vaccine" as const,
    frequency: "one_time" as const,
    amountMYR: 50,
    paymentMethod: "duitnow_qr" as const,
    ...over,
  });

  it("returns a pledge reference and never a receipt number", async () => {
    const result = await createPetSponsorshipAction(input());

    expect(result.success).toBe(true);
    expect(result.data?.pledgeRef).toMatch(/^HFS-PLG-/);
    expect(result.data?.status).toBe("PENDING_PAYMENT");
    // The whole point of the pledge stage: nothing here may read as a receipt.
    expect(result.data).not.toHaveProperty("receiptNumber");
    expect(result.data).not.toHaveProperty("taxDeductibleRef");
    expect(JSON.stringify(result.data)).not.toContain("HFS-DON");
  });

  it("refuses card payments, which have no processor behind them", async () => {
    const result = await createPetSponsorshipAction(input({ paymentMethod: "card" }));
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not available yet/i);
  });

  it("refuses a commitment below the floor", async () => {
    const result = await createPetSponsorshipAction(input({ amountMYR: 5 }));
    expect(result.success).toBe(false);
  });

  it("stores the animal's name even when it has no database row", async () => {
    const result = await createPetSponsorshipAction(
      input({ petId: "pet-does-not-exist", petName: "Tuah" })
    );
    expect(result.success).toBe(true);

    const stored = await findSponsorshipByPledgeRef(result.data!.pledgeRef);
    expect(stored?.petName).toBe("Tuah");
  });

  it("leaves the animal's public figures unmoved", async () => {
    await createPetSponsorshipAction(input());

    // A stranger's unverified claim on a public form must not raise a counter
    // that other donors read as social proof.
    const summary = await getPetSponsorshipSummaryAction("pet-200");
    expect(summary.supporterCount).toBe(0);
    expect(summary.fundedSen).toBe(0);
  });
});

describe("reconciliation draws its receipt from the shared gapless series", () => {
  it("issues a real Donation rather than a number of its own", async () => {
    const pledge = await recordSponsorshipPledge({
      petId: "pet-300",
      petName: "Milo",
      sponsorName: "Aisyah Rahman",
      sponsorEmail: "aisyah@example.com",
      tierId: "vaccine",
      tierName: "Core Vaccination & Deworming",
      frequency: "one_time",
      amountSen: senFromRinggit(50),
      paymentMethod: "duitnow_qr",
      pledgeRef: generatePledgeRef(),
    });

    // Stand in for what reconcilePetSponsorshipAction does, without the RBAC
    // session that a unit test has no way to hold.
    const { issueDonationReceipt } = await import("@/lib/server/donationLedger");
    const donation = await issueDonationReceipt({
      donorName: pledge.sponsorName,
      donorEmail: pledge.sponsorEmail,
      tierId: "vaccine",
      tierName: pledge.tierName,
      amountSen: pledge.amountSen,
      currency: "MYR",
      frequency: "one_time",
      paymentMethod: "duitnow_qr",
      targetPetName: pledge.petName,
      taxDeductibleRef: "LHDN.01/35/42/51/179-6.4912",
      shelterRegistrationNo: "PPM-021-10-18082021",
    });

    await reconcileSponsorship(pledge.pledgeRef, donation.receiptNumber, "coordinator@example.com");

    // The receipt is a first-class row in the donation ledger, so it reaches the
    // LHDN export like every other receipt rather than living only on the
    // sponsorship.
    expect(donation.receiptNumber).toMatch(/^HFS-DON-\d{6}-\d{4}$/);
    expect(await findDonationByReceiptNumber(donation.receiptNumber)).not.toBeNull();

    const stored = await findSponsorshipByPledgeRef(pledge.pledgeRef);
    expect(stored?.status).toBe("ACTIVE");
    expect(stored?.receiptNumber).toBe(donation.receiptNumber);
  });
});
