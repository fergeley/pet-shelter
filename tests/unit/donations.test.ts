import { describe, it, expect } from "vitest";
import { donationPledgeSchema } from "@/lib/validations/donation";
import { submitDonationPledgeAction } from "@/actions/donations";
import { sendDonationReceiptEmail } from "@/lib/email";
import { getAuditLogs } from "@/lib/domain/auditLog";
import { findDonationByReceiptNumber, listDonations } from "@/lib/server/donationLedger";
import {
  LHDN_TAX_DEDUCTIBLE_REF,
  STATUTORY_ROS_REGISTRATION_NO,
} from "@/lib/domain/shelterIdentity";

describe("Donation & Sponsorship Validation Schema", () => {
  it("should validate a standard donation pledge successfully", () => {
    const input = {
      donorName: "Cheryl Tan",
      donorEmail: "cheryl.tan@example.com",
      donorPhone: "012-345 6789",
      tierId: "vaccine" as const,
      amountMYR: 50,
      frequency: "one_time" as const,
      targetPetName: "Milo",
      taxIdOrIc: "920512-10-5432",
      notes: "For Milo's upcoming core vaccination booster.",
    };

    const parsed = donationPledgeSchema.parse(input);
    expect(parsed.donorName).toBe("Cheryl Tan");
    expect(parsed.donorEmail).toBe("cheryl.tan@example.com");
    expect(parsed.amountMYR).toBe(50);
    expect(parsed.frequency).toBe("one_time");
    expect(parsed.tierId).toBe("vaccine");
  });

  it("should coerce string amounts to numbers and enforce minimum RM 5.00", () => {
    const validStringAmount = {
      donorName: "Ahmad Farhan",
      donorEmail: "farhan@example.com",
      tierId: "custom" as const,
      amountMYR: "150" as unknown as number,
    };

    const parsed = donationPledgeSchema.parse(validStringAmount);
    expect(parsed.amountMYR).toBe(150);

    const invalidAmount = {
      donorName: "Ahmad Farhan",
      donorEmail: "farhan@example.com",
      tierId: "custom" as const,
      amountMYR: 3,
    };

    expect(() => donationPledgeSchema.parse(invalidAmount)).toThrow(
      /Minimum donation amount is RM 5.00/
    );
  });

  it("should reject invalid email formats", () => {
    const invalidEmail = {
      donorName: "Invalid Email Donor",
      donorEmail: "not-an-email",
      tierId: "kibble" as const,
      amountMYR: 30,
    };

    expect(() => donationPledgeSchema.parse(invalidEmail)).toThrow(
      /Please provide a valid email address/
    );
  });

  it("should support monthly recurring frequency", () => {
    const monthlyInput = {
      donorName: "Rachel Wong",
      donorEmail: "rachel.wong@example.com",
      tierId: "spay_neuter" as const,
      amountMYR: 120,
      frequency: "monthly" as const,
    };

    const parsed = donationPledgeSchema.parse(monthlyInput);
    expect(parsed.frequency).toBe("monthly");
  });
});

describe("Donation Server Action (submitDonationPledgeAction)", () => {
  it("should process a donation pledge, generate LHDN receipt, and record an audit log", async () => {
    const result = await submitDonationPledgeAction({
      donorName: "Kenneth Lee",
      donorEmail: "kenneth.lee@example.com",
      donorPhone: "+6016-987 6543",
      tierId: "emergency_medical",
      amountMYR: 250,
      frequency: "one_time",
      targetPetName: "Barnaby",
      taxIdOrIc: "880419-14-5567",
      notes: "Wishing Barnaby a speedy recovery!",
      paymentMethod: "duitnow_qr",
    });

    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();

    if (result.data) {
      expect(result.data.receiptNumber).toMatch(/^HFS-DON-\d{6}-\d{4}$/);
      expect(result.data.donorName).toBe("Kenneth Lee");
      expect(result.data.donorEmail).toBe("kenneth.lee@example.com");
      expect(result.data.amountMYR).toBe(250);
      expect(result.data.targetPetName).toBe("Barnaby");
      expect(result.data.taxDeductibleRef).toBe(LHDN_TAX_DEDUCTIBLE_REF);
      expect(result.data.shelterRegistrationNo).toBe(STATUTORY_ROS_REGISTRATION_NO);
      expect(result.data.tierName).toBe("Emergency Medical & Trauma Care");
    }

    // Verify audit log
    const logs = getAuditLogs(10);
    const donationLog = logs.find((l) => l.action === "DONATION_RECEIVED");
    expect(donationLog).toBeDefined();
    expect(donationLog?.actorRole).toBe("DONOR");
    expect(donationLog?.actorEmail).toBe("kenneth.lee@example.com");
  });

  it("should handle custom amounts and default to custom tier name", async () => {
    const result = await submitDonationPledgeAction({
      donorName: "Siti Sarah",
      donorEmail: "siti.sarah@example.com",
      tierId: "custom",
      amountMYR: 75,
      frequency: "one_time",
      paymentMethod: "duitnow_qr",
    });

    expect(result.success).toBe(true);
    expect(result.data?.amountMYR).toBe(75);
    expect(result.data?.tierName).toBe("Custom Rescue Donation");
  });

  it("should return an error result for invalid input without throwing", async () => {
    const result = await submitDonationPledgeAction({
      donorName: "A", // too short (< 2 chars)
      donorEmail: "bad-email",
      tierId: "kibble",
      amountMYR: 1, // too small (< RM 5)
      frequency: "one_time",
      paymentMethod: "duitnow_qr",
    });

    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
  });
});

describe("Donation Receipt Transactional Email Dispatcher", () => {
  it("should simulate and record email dispatch for donation receipts", async () => {
    const mockReceipt = {
      receiptNumber: "HFS-DON-202608-9999",
      date: "16 Aug 2026, 12:30 AM",
      donorName: "David Teoh",
      donorEmail: "david.teoh@example.com",
      donorPhone: "019-876 5432",
      tierId: "vaccine" as const,
      tierName: "Core Vaccination & Deworming",
      amountMYR: 50,
      frequency: "one_time" as const,
      paymentMethod: "duitnow_qr" as const,
      targetPetName: "Luna",
      taxIdOrIc: "910101-10-1234",
      notes: "Thanks for taking care of Luna!",
      taxDeductibleRef: LHDN_TAX_DEDUCTIBLE_REF,
      shelterRegistrationNo: STATUTORY_ROS_REGISTRATION_NO,
    };

    const emailResult = await sendDonationReceiptEmail(mockReceipt);
    expect(emailResult.success).toBe(true);
    expect(emailResult.simulated).toBe(true);
  });
});

describe("Donation persistence (the ledger is the system of record)", () => {
  const basePledge = {
    donorName: "Nurul Aisyah",
    donorEmail: "nurul.aisyah@example.com",
    tierId: "kibble" as const,
    amountMYR: 30,
    frequency: "one_time" as const,
    paymentMethod: "duitnow_qr" as const,
  };

  it("writes a retrievable receipt rather than only emailing one", async () => {
    // The defect this closes: the action previously minted a receipt number,
    // emailed it, and stored nothing. The number existed only in the donor's
    // inbox and an audit-log string, so it could not back an LHDN claim.
    const result = await submitDonationPledgeAction(basePledge);
    expect(result.success).toBe(true);

    const stored = await findDonationByReceiptNumber(result.data!.receiptNumber);
    expect(stored).not.toBeNull();
    expect(stored?.donorName).toBe("Nurul Aisyah");
    expect(stored?.tierName).toBe("1-Week Nutrition & Kibble Fund");
  });

  it("issues gapless, contiguous receipt numbers across donations", async () => {
    const first = await submitDonationPledgeAction(basePledge);
    const second = await submitDonationPledgeAction({
      ...basePledge,
      donorEmail: "second.donor@example.com",
    });
    const third = await submitDonationPledgeAction({
      ...basePledge,
      donorEmail: "third.donor@example.com",
    });

    const serials = [first, second, third].map(
      (r) => Number(r.data!.receiptNumber.split("-").pop())
    );
    expect(serials).toEqual([1, 2, 3]);

    const ledger = await listDonations();
    expect(ledger).toHaveLength(3);
  });

  it("keeps the receipt-number format the email template and CSV export expect", async () => {
    const result = await submitDonationPledgeAction(basePledge);
    expect(result.data!.receiptNumber).toMatch(/^HFS-DON-\d{6}-\d{4}$/);
  });

  it("stores the amount as exact sen while the DTO still exposes ringgit", async () => {
    const result = await submitDonationPledgeAction({ ...basePledge, amountMYR: 19.9 });

    expect(result.success).toBe(true);
    expect(result.data!.amountMYR).toBe(19.9);

    const stored = await findDonationByReceiptNumber(result.data!.receiptNumber);
    expect(stored?.amountSen).toBe(1990);
  });

  it("rejects a sub-sen amount instead of rounding it onto a tax document", async () => {
    const result = await submitDonationPledgeAction({ ...basePledge, amountMYR: 30.005 });

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/two decimal places/);
    expect(await listDonations()).toHaveLength(0);
  });

  it("snapshots the issuer identity onto the row, not just the emailed DTO", async () => {
    const result = await submitDonationPledgeAction(basePledge);
    const stored = await findDonationByReceiptNumber(result.data!.receiptNumber);

    // Correcting the ROS number later (P2) must not retroactively rewrite
    // receipts already filed with LHDN, so each row carries its own copy.
    expect(stored?.shelterRegistrationNo).toBe(STATUTORY_ROS_REGISTRATION_NO);
    expect(stored?.taxDeductibleRef).toBe("LHDN.01/35/42/51/179-6.4912");
  });

  it("links the audit entry to the ledger row it describes", async () => {
    const result = await submitDonationPledgeAction(basePledge);

    const donationLog = getAuditLogs(10).find((l) => l.action === "DONATION_RECEIVED");
    const stored = await findDonationByReceiptNumber(result.data!.receiptNumber);

    expect(donationLog?.entity).toBe("Donation");
    expect(donationLog?.entityId).toBe(result.data!.receiptNumber);
    expect((donationLog?.details as Record<string, unknown>).donationId).toBe(stored?.id);
  });

  it("records nothing at all when validation fails", async () => {
    const result = await submitDonationPledgeAction({
      ...basePledge,
      amountMYR: 1, // below the RM 5 minimum
    });

    expect(result.success).toBe(false);
    expect(await listDonations()).toHaveLength(0);
  });
});
