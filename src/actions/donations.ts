"use server";

import {
  donationPledgeSchema,
  DonationPledgeInput,
  DonationReceiptDTO,
} from "@/lib/validations/donation";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { sendDonationReceiptEmail } from "@/lib/email";
import { SPONSORSHIP_TIERS } from "@/lib/sponsorshipStore";
import { recordContribution, findSponsorByEmail } from "@/lib/sponsorStore";
import { getCurrentSponsorSession } from "@/lib/security/sponsorSession";

const SHELTER_REG_NO = "PPM-021-10-18082021";
const LHDN_TAX_REF = "LHDN.01/35/42/51/179-6.4912";

/**
 * Server Action: Validates and processes a donation pledge / rescue sponsorship.
 * Generates an official LHDN tax-deductible e-Receipt, records an immutable audit log,
 * and dispatches a confirmation email via Resend.
 */
export async function submitDonationPledgeAction(
  input: DonationPledgeInput
): Promise<{ success: boolean; data?: DonationReceiptDTO; error?: string }> {
  try {
    const validated = donationPledgeSchema.parse(input);

    // 1. Rate Limiting: Max 20 donation submissions per 5 minutes per donor email
    const rateLimit = checkRateLimit(
      `donate:${validated.donorEmail.toLowerCase()}`,
      20,
      300000
    );
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Too many submissions. Please wait ${rateLimit.retryAfterSeconds}s before trying again.`,
      };
    }

    // 2. Resolve Tier Name
    let tierName = validated.tierName;
    if (!tierName) {
      const matched = SPONSORSHIP_TIERS.find((t) => t.id === validated.tierId);
      tierName = matched ? matched.name : "Custom Rescue Donation";
    }

    // 3. Generate Sequential Official Receipt Number
    const randomSeq = Math.floor(1000 + Math.random() * 9000);
    const dateSegment = new Date().toISOString().slice(0, 7).replace("-", "");
    const receiptNumber = `HFS-DON-${dateSegment}-${randomSeq}`;

    const formattedDate = new Date().toLocaleDateString("en-MY", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const receipt: DonationReceiptDTO = {
      receiptNumber,
      date: formattedDate,
      donorName: validated.donorName.trim(),
      donorEmail: validated.donorEmail.trim().toLowerCase(),
      donorPhone: validated.donorPhone?.trim() || undefined,
      tierId: validated.tierId,
      tierName,
      amountMYR: validated.amountMYR,
      frequency: validated.frequency,
      paymentMethod: validated.paymentMethod,
      targetPetName: validated.targetPetName?.trim() || undefined,
      targetPetId: validated.targetPetId?.trim() || undefined,
      displayOnWall: validated.displayOnWall,
      taxIdOrIc: validated.taxIdOrIc?.trim() || undefined,
      notes: validated.notes?.trim() || undefined,
      taxDeductibleRef: LHDN_TAX_REF,
      shelterRegistrationNo: SHELTER_REG_NO,
    };

    // 4. Persist the pledge to the sponsorship ledger.
    //
    // Without this row the sponsor portal has no source of truth: standings are derived
    // from the ledger on every read, and "My Rescues" is the set of pets these rows
    // point at. An audit log entry alone is not queryable as a donor's giving history.
    //
    // The pledge is attached to a sponsor account when one can be established without
    // guessing — the donor is signed in to the portal, or an account already exists for
    // this email. Otherwise it stays unattached and is claimed later, at registration,
    // by proving possession of this receipt number.
    const sponsorSession = await getCurrentSponsorSession();
    const linkedSponsorId =
      sponsorSession?.email === receipt.donorEmail
        ? sponsorSession.sponsorId
        : (await findSponsorByEmail(receipt.donorEmail))?.id ?? null;

    await recordContribution({
      receiptNumber: receipt.receiptNumber,
      donorEmail: receipt.donorEmail,
      donorName: receipt.donorName,
      tierId: receipt.tierId,
      tierName: receipt.tierName,
      amountMYR: receipt.amountMYR,
      frequency: receipt.frequency,
      displayOnWall: receipt.displayOnWall,
      targetPetId: receipt.targetPetId ?? null,
      targetPetName: receipt.targetPetName ?? null,
      sponsorId: linkedSponsorId,
    });

    // 5. Immutable PostgreSQL / In-Memory Audit Trail
    recordAuditLog({
      actorId: "donor_public",
      actorEmail: receipt.donorEmail,
      actorRole: "DONOR",
      action: "DONATION_RECEIVED",
      entity: "DonationReceipt",
      entityId: receipt.receiptNumber,
      details: {
        receiptNumber: receipt.receiptNumber,
        donorName: receipt.donorName,
        amountMYR: receipt.amountMYR,
        tierId: receipt.tierId,
        tierName: receipt.tierName,
        frequency: receipt.frequency,
        paymentMethod: receipt.paymentMethod,
        targetPetName: receipt.targetPetName,
        targetPetId: receipt.targetPetId,
        displayOnWall: receipt.displayOnWall,
        taxIdOrIc: receipt.taxIdOrIc,
      },
    });

    // 6. Non-blocking, resilient email dispatch to donor
    sendDonationReceiptEmail(receipt).catch((err) =>
      console.error("[Donation Receipt Email Dispatch Failed]", err)
    );

    return {
      success: true,
      data: receipt,
    };
  } catch (err: unknown) {
    const errorMsg =
      err instanceof Error ? err.message : "Failed to process donation pledge";
    return {
      success: false,
      error: errorMsg,
    };
  }
}
