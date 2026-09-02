import { describe, it, expect } from "vitest";
import { donationPledgeSchema } from "@/lib/validations/donation";
import { submitDonationPledgeAction } from "@/actions/donations";
import { sendDonationReceiptEmail } from "@/lib/email";
import { getAuditLogs } from "@/lib/domain/auditLog";
import { RECEIPT_NUMBER_PATTERN } from "@/lib/domain/receiptNumber";

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
      // Asserted against the generator's own pattern so the two cannot drift apart.
      expect(result.data.receiptNumber).toMatch(RECEIPT_NUMBER_PATTERN);
      expect(result.data.donorName).toBe("Kenneth Lee");
      expect(result.data.donorEmail).toBe("kenneth.lee@example.com");
      expect(result.data.amountMYR).toBe(250);
      expect(result.data.targetPetName).toBe("Barnaby");
      expect(result.data.taxDeductibleRef).toBe("LHDN.01/35/42/51/179-6.4912");
      expect(result.data.shelterRegistrationNo).toBe("PPM-021-10-18082021");
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
      taxDeductibleRef: "LHDN.01/35/42/51/179-6.4912",
      shelterRegistrationNo: "PPM-021-10-18082021",
    };

    const emailResult = await sendDonationReceiptEmail(mockReceipt);
    expect(emailResult.success).toBe(true);
    expect(emailResult.simulated).toBe(true);
  });
});
