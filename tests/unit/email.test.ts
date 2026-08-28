import { describe, it, expect, vi } from "vitest";
import {
  sendApplicationConfirmationEmail,
  sendStaffApplicationAlert,
  sendDonationReceiptEmail,
} from "@/lib/email";
import { AdoptionApplicationRecord } from "@/types/application";
import { DonationReceipt } from "@/types/sponsorship";

describe("Transactional Email Service", () => {
  const sampleApplication: AdoptionApplicationRecord = {
    id: "app-test-999",
    petId: "pet-001",
    petName: "Kopi",
    applicantName: "Tan Ah Kow",
    email: "tahkow@example.com",
    phone: "012-3456789",
    address: "123 Jalan SS2, Petaling Jaya",
    housingType: "landed_terrace",
    hasFencedYard: "yes",
    currentPets: "none",
    householdExperience: "experienced",
    applicantNotes: "Very excited to adopt Kopi!",
    status: "SUBMITTED",
    createdAt: "2026-08-15",
    updatedAt: "2026-08-15",
  };

  it("dispatches adopter confirmation email in simulation mode when RESEND_API_KEY is unset", async () => {
    const result = await sendApplicationConfirmationEmail(sampleApplication);
    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.messageId).toContain("sim-");
  });

  it("dispatches shelter staff alert email in simulation mode when RESEND_API_KEY is unset", async () => {
    const result = await sendStaffApplicationAlert(sampleApplication);
    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.messageId).toContain("sim-");
  });

  it("handles network failure gracefully without crashing or throwing", async () => {
    // Temporarily simulate RESEND_API_KEY present and fetch rejection
    const originalEnv = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "test_key";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network connection reset"));

    const result = await sendApplicationConfirmationEmail(sampleApplication);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Network connection reset");

    fetchSpy.mockRestore();
    if (originalEnv) {
      process.env.RESEND_API_KEY = originalEnv;
    } else {
      delete process.env.RESEND_API_KEY;
    }
  });
});

describe("Sec 44(6) donation receipt — the two halves must agree", () => {
  const baseReceipt: DonationReceipt = {
    receiptNumber: "HFS-DON-202608-4821",
    date: "28 Aug 2026, 10:15 AM",
    donorName: "Siti Nurhaliza",
    donorEmail: "siti@example.com",
    donorPhone: "012-345 6789",
    tierId: "vaccine",
    tierName: "Core Vaccination & Deworming",
    amountMYR: 250,
    frequency: "one_time",
    paymentMethod: "duitnow_qr",
    targetPetName: "Luna",
    taxIdOrIc: "910101-10-1234",
    notes: "In loving memory of Bubbles",
    taxDeductibleRef: "LHDN.01/35/42/51/179-6.9999",
    shelterRegistrationNo: "PPM-001-10-99999999",
  };

  /**
   * The receipt is only observable on the wire: sendDonationReceiptEmail returns a dispatch result,
   * not a body. Drive the live path with a stubbed key and read both halves off the Resend payload.
   */
  async function renderReceipt(
    overrides: Partial<DonationReceipt> = {}
  ): Promise<{ subject: string; text: string; html: string }> {
    const originalEnv = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "test_key";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: "resend-msg-test" }),
    } as unknown as Response);

    try {
      const result = await sendDonationReceiptEmail({ ...baseReceipt, ...overrides });
      expect(result.success).toBe(true);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const init = fetchSpy.mock.calls[0][1];
      return JSON.parse(String(init?.body));
    } finally {
      fetchSpy.mockRestore();
      if (originalEnv) {
        process.env.RESEND_API_KEY = originalEnv;
      } else {
        delete process.env.RESEND_API_KEY;
      }
    }
  }

  const RAIL_CASES: Array<{ method: DonationReceipt["paymentMethod"]; label: string }> = [
    { method: "duitnow_qr", label: "DuitNow QR (PayNet)" },
    { method: "online_banking", label: "Direct Bank Transfer" },
    { method: "card", label: "Credit / Debit Card" },
  ];

  // The defect this closes: a card donation was receipted as "Direct Bank Transfer" in the HTML
  // half while the plain-text half of the same email said "Credit / Debit Card". Asserting the
  // absence of the other two labels is what makes a silent fallback impossible to reintroduce.
  it.each(RAIL_CASES)(
    "receipts a $method donation as \"$label\" in BOTH halves, and as nothing else",
    async ({ method, label }) => {
      const mail = await renderReceipt({ paymentMethod: method });
      const otherLabels = RAIL_CASES.filter((c) => c.method !== method).map((c) => c.label);

      for (const [half, body] of [["text", mail.text], ["html", mail.html]] as const) {
        expect(body, `${half} half should state ${label}`).toContain(label);
        for (const other of otherLabels) {
          expect(body, `${half} half must not state ${other}`).not.toContain(other);
        }
      }
    }
  );

  it("echoes the donor's own message in the HTML half, not only the plain text", async () => {
    const mail = await renderReceipt({ notes: "In memory of Bubbles, our first rescue" });

    expect(mail.text).toContain('- Donor Message: "In memory of Bubbles, our first rescue"');
    expect(mail.html).toContain("Donor Message:");
    expect(mail.html).toContain("In memory of Bubbles, our first rescue");
  });

  it("omits the donor-message row from both halves when no message was left", async () => {
    const mail = await renderReceipt({ notes: undefined });

    expect(mail.text).not.toContain("Donor Message");
    expect(mail.html).not.toContain("Donor Message");
  });

  it("escapes donor-supplied markup before placing it in the HTML body", async () => {
    const mail = await renderReceipt({ notes: '<script>alert("xss")</script> Ali & Sons' });

    expect(mail.html).not.toContain("<script>");
    expect(mail.html).toContain("&lt;script&gt;");
    expect(mail.html).toContain("Ali &amp; Sons");
    // The plain-text half is not markup and is left verbatim.
    expect(mail.text).toContain('<script>alert("xss")</script> Ali & Sons');
  });

  it("renders a fractional amount identically and correctly in both halves", async () => {
    const mail = await renderReceipt({ amountMYR: 250.5 });

    expect(mail.text).toContain("RM 250.50");
    expect(mail.html).toContain("RM 250.50");
    expect(mail.text).not.toContain("250.5.00");
    expect(mail.html).not.toContain("250.5.00");
  });

  it("states the same optional rows in both halves", async () => {
    const mail = await renderReceipt({ targetPetName: "Luna", taxIdOrIc: "910101-10-1234" });

    for (const body of [mail.text, mail.html]) {
      expect(body).toContain("Luna");
      expect(body).toContain("910101-10-1234");
      expect(body).toContain("RM 250.00");
    }
  });
});
