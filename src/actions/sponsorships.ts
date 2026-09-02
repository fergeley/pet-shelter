"use server";

import {
  petSponsorshipSchema,
  PetSponsorshipInput,
  isPaymentMethodEnabled,
} from "@/lib/validations/sponsorship";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { findSponsorshipTier } from "@/lib/domain/sponsorshipTiers";
import { currentIssuerIdentity } from "@/lib/domain/shelterIdentity";
import { formatMYR, ringgitFromSen, senFromRinggit } from "@/lib/domain/money";
import {
  PetSponsorshipSummary,
  emptySponsorshipSummary,
  generatePledgeRef,
  reconciliationNotice,
} from "@/lib/domain/petSponsorship";
import {
  SponsorshipWriteError,
  findSponsorshipByPledgeRef,
  recordSponsorshipPledge,
  reconcileSponsorship,
  summarizeSponsorshipsForPet,
} from "@/lib/server/sponsorshipLedger";
import { ReceiptIssuanceError, issueDonationReceipt } from "@/lib/server/donationLedger";
import { sendSponsorshipWelcomeEmail, sendDonationReceiptEmail } from "@/lib/email";
import { getCurrentSession } from "@/lib/security/session";
import { assertAuthorized, ROLES } from "@/lib/security/rbac";

/** What the supporter sees the moment checkout completes. */
export interface SponsorshipPledgeDTO {
  pledgeRef: string;
  petName: string;
  sponsorName: string;
  sponsorEmail: string;
  tierId: string;
  tierName: string;
  amountMYR: number;
  frequency: "one_time" | "monthly";
  paymentMethod: "duitnow_qr" | "online_banking" | "card";
  /** Always PENDING_PAYMENT here; a receipt follows reconciliation. */
  status: string;
  reconciliationNotice: string;
}

export interface CreateSponsorshipResult {
  success: boolean;
  data?: SponsorshipPledgeDTO;
  error?: string;
}

/**
 * Server Action: records a supporter's commitment to fund one animal's care.
 *
 * Ordering mirrors `submitDonationPledgeAction`: validate -> rate-limit ->
 * persist -> audit -> email. A failed write means the audit entry and the email
 * never happen and the supporter is told to retry.
 *
 * The one deliberate difference is what comes out the other end. The donation
 * form issues a receipt because that flow treats submission as the gift; a
 * sponsorship is a standing commitment settled by bank transfer, and at this
 * point nothing has checked a bank statement — the supporter was shown a
 * DuitNow QR and told us they paid. So this returns a pledge reference and a
 * welcome email, and the Section 44(6) receipt waits for
 * `reconcilePetSponsorshipAction`.
 */
export async function createPetSponsorshipAction(
  input: PetSponsorshipInput
): Promise<CreateSponsorshipResult> {
  let validated;
  try {
    validated = petSponsorshipSchema.parse(input);
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Please check the sponsorship details",
    };
  }

  if (!isPaymentMethodEnabled(validated.paymentMethod)) {
    return {
      success: false,
      error:
        "Card payments are not available yet. Please choose DuitNow QR or a direct bank transfer.",
    };
  }

  const sponsorEmail = validated.sponsorEmail.trim().toLowerCase();

  const rateLimit = checkRateLimit(`sponsor:${sponsorEmail}`, 10, 300000);
  if (!rateLimit.success) {
    return {
      success: false,
      error: `Too many sponsorship submissions. Please wait ${rateLimit.retryAfterSeconds}s before trying again.`,
    };
  }

  const tier = findSponsorshipTier(validated.tierId);
  const tierName = validated.tierName?.trim() || tier?.name || "Custom Sponsorship";
  const amountSen = senFromRinggit(validated.amountMYR);
  const pledgeRef = generatePledgeRef();

  let record;
  try {
    record = await recordSponsorshipPledge({
      petId: validated.petId?.trim() || null,
      petName: validated.petName.trim(),
      sponsorName: validated.sponsorName.trim(),
      sponsorEmail,
      sponsorPhone: validated.sponsorPhone?.trim() || undefined,
      userId: validated.userId?.trim() || null,
      tierId: validated.tierId,
      tierName,
      frequency: validated.frequency,
      amountSen,
      paymentMethod: validated.paymentMethod,
      pledgeRef,
      taxIdOrIc: validated.taxIdOrIc?.trim() || undefined,
      notes: validated.notes?.trim() || undefined,
    });
  } catch (err) {
    if (err instanceof SponsorshipWriteError) {
      return {
        success: false,
        error:
          "We could not record your sponsorship just now. Nothing has been charged — please try again in a moment.",
      };
    }
    throw err;
  }

  recordAuditLog({
    actorId: "sponsor_public",
    actorEmail: sponsorEmail,
    actorRole: "DONOR",
    action: "SPONSORSHIP_PLEDGED",
    entity: "PetSponsorship",
    entityId: record.pledgeRef,
    details: {
      pledgeRef: record.pledgeRef,
      petId: record.petId,
      petName: record.petName,
      sponsorName: record.sponsorName,
      tierId: record.tierId,
      tierName: record.tierName,
      frequency: record.frequency,
      amountSen: record.amountSen as number,
      amountDisplay: formatMYR(record.amountSen),
      paymentMethod: record.paymentMethod,
      status: record.status,
    },
  });

  const dto: SponsorshipPledgeDTO = {
    pledgeRef: record.pledgeRef,
    petName: record.petName,
    sponsorName: record.sponsorName,
    sponsorEmail: record.sponsorEmail,
    tierId: record.tierId,
    tierName: record.tierName,
    amountMYR: ringgitFromSen(record.amountSen),
    frequency: record.frequency,
    paymentMethod: record.paymentMethod,
    status: record.status,
    reconciliationNotice: reconciliationNotice(record.frequency, record.paymentMethod),
  };

  // Fire-and-forget, as the donation receipt is: a mail outage must not cost the
  // supporter their commitment.
  sendSponsorshipWelcomeEmail(dto).catch((err) =>
    console.error("[Sponsorship Welcome Email Dispatch Failed]", err)
  );

  return { success: true, data: dto };
}

export interface ReconcileSponsorshipResult {
  success: boolean;
  receiptNumber?: string;
  error?: string;
}

/**
 * Server Action: a coordinator confirms the transfer for a pledge has landed.
 *
 * This is the only path that turns a commitment into a statutory document. It
 * allocates the receipt number through `issueDonationReceipt`, so a sponsorship
 * receipt is drawn from the same gapless per-month series as every other
 * receipt and appears in the LHDN export like any other.
 *
 * Order is: confirm the pledge is still pending -> issue the `Donation` ->
 * attach its number to the commitment. Losing the final conditional update to a
 * concurrent coordinator would leave an issued receipt with no commitment
 * attached; that is logged as needing an offsetting correction rather than
 * papered over, because `Donation` is append-only by design and a receipt
 * cannot be withdrawn.
 */
export async function reconcilePetSponsorshipAction(
  pledgeRef: string
): Promise<ReconcileSponsorshipResult> {
  const session = await getCurrentSession();
  assertAuthorized(session, [ROLES.ADMIN, ROLES.COORDINATOR]);
  const actorEmail = session?.email ?? "coordinator@hopeforstrays.org";

  const existing = await findSponsorshipByPledgeRef(pledgeRef);
  if (!existing) {
    return { success: false, error: `No sponsorship found for pledge ${pledgeRef}` };
  }
  if (existing.status === "ACTIVE" && existing.receiptNumber) {
    // Already settled. Return the number that exists rather than minting another
    // for the same money.
    return { success: true, receiptNumber: existing.receiptNumber };
  }

  const issuer = currentIssuerIdentity();

  let donation;
  try {
    donation = await issueDonationReceipt({
      donorName: existing.sponsorName,
      donorEmail: existing.sponsorEmail,
      donorPhone: existing.sponsorPhone,
      taxIdOrIc: existing.taxIdOrIc,
      tierId: existing.tierId as Parameters<typeof issueDonationReceipt>[0]["tierId"],
      tierName: existing.tierName,
      amountSen: existing.amountSen,
      currency: "MYR",
      frequency: existing.frequency,
      paymentMethod: existing.paymentMethod,
      targetPetName: existing.petName,
      notes: existing.notes,
      taxDeductibleRef: issuer.taxDeductibleRef,
      shelterRegistrationNo: issuer.shelterRegistrationNo,
    });
  } catch (err) {
    if (err instanceof ReceiptIssuanceError) {
      return {
        success: false,
        error:
          "We could not issue the receipt just now, so the sponsorship is still pending. Please try again in a moment.",
      };
    }
    throw err;
  }

  const outcome = await reconcileSponsorship(pledgeRef, donation.receiptNumber, actorEmail);

  if (outcome.status === "already_reconciled") {
    console.error(
      `[Sponsorship Reconciliation] Lost a race on ${pledgeRef}: receipt ${donation.receiptNumber} was issued but ${outcome.receiptNumber} is already attached. The spare needs an offsetting correction.`
    );
    return { success: true, receiptNumber: outcome.receiptNumber };
  }

  if (outcome.status === "not_found") {
    console.error(
      `[Sponsorship Reconciliation] ${pledgeRef} vanished after receipt ${donation.receiptNumber} was issued.`
    );
    return { success: false, error: `No sponsorship found for pledge ${pledgeRef}` };
  }

  recordAuditLog({
    actorId: session?.id ?? "coordinator",
    actorEmail,
    actorRole: session?.role ?? ROLES.COORDINATOR,
    action: "SPONSORSHIP_RECONCILED",
    entity: "PetSponsorship",
    entityId: pledgeRef,
    details: {
      pledgeRef,
      receiptNumber: donation.receiptNumber,
      petName: outcome.record.petName,
      sponsorEmail: outcome.record.sponsorEmail,
      amountSen: outcome.record.amountSen as number,
      amountDisplay: formatMYR(outcome.record.amountSen),
    },
  });

  sendDonationReceiptEmail({
    receiptNumber: donation.receiptNumber,
    date: new Date(donation.issuedAt).toLocaleDateString("en-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    donorName: donation.donorName,
    donorEmail: donation.donorEmail,
    donorPhone: donation.donorPhone,
    tierId: donation.tierId,
    tierName: donation.tierName,
    amountMYR: ringgitFromSen(donation.amountSen),
    frequency: donation.frequency,
    paymentMethod: donation.paymentMethod,
    targetPetName: donation.targetPetName,
    taxIdOrIc: donation.taxIdOrIc,
    notes: donation.notes,
    taxDeductibleRef: donation.taxDeductibleRef,
    shelterRegistrationNo: donation.shelterRegistrationNo,
  }).catch((err) => console.error("[Sponsorship Receipt Email Dispatch Failed]", err));

  return { success: true, receiptNumber: donation.receiptNumber };
}

/**
 * Server Action: public sponsorship figures for one animal.
 *
 * Read from the client after mount, because `/pets/[id]` is prerendered through
 * `generateStaticParams` — a value read during render would be frozen at build
 * time and would never show a new supporter.
 */
export async function getPetSponsorshipSummaryAction(
  petId: string
): Promise<PetSponsorshipSummary> {
  if (!petId) return emptySponsorshipSummary(petId);

  try {
    return await summarizeSponsorshipsForPet(petId);
  } catch (err) {
    // A figures lookup must never take the profile down with it. Zeroed reads as
    // "no supporters yet", which is the honest degraded answer.
    console.warn(
      "[Sponsorship Summary] Falling back to an empty summary:",
      err instanceof Error ? err.message : err
    );
    return emptySponsorshipSummary(petId);
  }
}
