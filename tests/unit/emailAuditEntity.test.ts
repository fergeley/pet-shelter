import { describe, it, expect, afterEach, vi } from "vitest";
import {
  sendApplicationConfirmationEmail,
  sendCaretakerQuestionEmail,
  sendDonationReceiptEmail,
  sendSponsorshipWelcomeEmail,
} from "@/lib/email";
import { getAuditLogs } from "@/lib/domain/auditLog";
import type { AdoptionApplicationRecord } from "@/types/application";
import type { DonationReceipt } from "@/types/sponsorship";

/**
 * Every email's audit row names the record it was about.
 *
 * `sendRawEmail` used to default `entity` to "AdoptionApplication", and three senders never
 * overrode it. The audit viewer (`useAuditLogController`) sorts by entity, so donation receipts
 * landed in its Adoptions tab instead of Receipts — including the eleven EMAIL_FAILED rows local
 * e2e wrote to production on 2026-09-14. See
 * `tasks/decisions/2026-09-18-every-email-names-its-audit-entity.md`.
 */

const receipt: DonationReceipt = {
  receiptNumber: "HFS-DON-202609-9001",
  date: "18 Sep 2026, 10:15 AM",
  donorName: "Test Donor",
  donorEmail: "donor@example.test",
  tierId: "vaccine",
  tierName: "Core Vaccination & Deworming",
  amountMYR: 30,
  frequency: "one_time",
  paymentMethod: "duitnow_qr",
  taxDeductibleRef: "LHDN.01/35/42/51/179-6.9999",
  shelterRegistrationNo: "PPM-001-10-99999999",
};

const emailRow = (template: string) =>
  getAuditLogs(50).find(
    (row) =>
      (row.action === "EMAIL_SENT" || row.action === "EMAIL_FAILED") &&
      (row.details as { template?: string } | undefined)?.template === template
  );

describe("email audit rows name their own entity", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("files a donation receipt under DonationReceipt, the entity the Receipts tab shows", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await sendDonationReceiptEmail(receipt);

    expect(emailRow("DONATION_RECEIPT")).toMatchObject({ action: "EMAIL_SENT", entity: "DonationReceipt" });
  });

  it("files a failed donation receipt the same way", async () => {
    vi.stubEnv("RESEND_API_KEY", "re_test_key_not_real");
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network connection reset"));

    await sendDonationReceiptEmail(receipt);

    expect(emailRow("DONATION_RECEIPT")).toMatchObject({ action: "EMAIL_FAILED", entity: "DonationReceipt" });
  });

  it("files a sponsorship welcome under PetSponsorship", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await sendSponsorshipWelcomeEmail({
      pledgeRef: "PLG-TEST-0001",
      petName: "Bella",
      sponsorName: "Test Sponsor",
      sponsorEmail: "sponsor@example.test",
      tierName: "Kibble",
      amountMYR: 30,
      frequency: "monthly",
      paymentMethod: "duitnow_qr",
      reconciliationNotice: "Pending reconciliation.",
    });

    expect(emailRow("SPONSORSHIP_WELCOME")).toMatchObject({ entity: "PetSponsorship" });
  });

  it("files a caretaker question under Sponsor", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await sendCaretakerQuestionEmail({
      sponsorName: "Test Sponsor",
      sponsorEmail: "sponsor@example.test",
      tier: "Gold",
      message: "How is Bella settling in?",
    });

    expect(emailRow("CARETAKER_QUESTION")).toMatchObject({ entity: "Sponsor" });
  });

  it("still files an application email under AdoptionApplication", async () => {
    vi.stubEnv("RESEND_API_KEY", "");

    await sendApplicationConfirmationEmail({
      id: "app-test-1",
      petId: "pet-001",
      petName: "Kopi",
      applicantName: "Test Applicant",
      email: "applicant@example.test",
      phone: "012-3456789",
      address: "1 Jalan Test",
      housingType: "landed_terrace",
      hasFencedYard: "yes",
      currentPets: "none",
      householdExperience: "experienced",
      status: "SUBMITTED",
      createdAt: "2026-09-18",
      updatedAt: "2026-09-18",
    } as AdoptionApplicationRecord);

    expect(emailRow("APPLICATION_CONFIRMATION")).toMatchObject({ entity: "AdoptionApplication" });
  });
});
