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
  listPendingSponsorships,
  recordSponsorshipPledge,
  rejectPendingSponsorship,
  settleSponsorship,
  summarizeSponsorshipsForPet,
} from "@/lib/server/sponsorshipLedger";
import { ReceiptIssuanceError } from "@/lib/server/donationLedger";
import { sendSponsorshipWelcomeEmail, sendDonationReceiptEmail } from "@/lib/email";
import { getCurrentSession, type SessionUser } from "@/lib/security/session";
import {
  PERMISSIONS,
  ROLES,
  assertAuthorized,
  assertHasPermission,
  isAuthorizationError,
} from "@/lib/security/rbac";

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
      displayOnWall: validated.displayOnWall,
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

/** One row of the coordinator's reconciliation queue. */
export interface PendingSponsorshipDTO {
  pledgeRef: string;
  petName: string;
  sponsorName: string;
  sponsorEmail: string;
  tierName: string;
  /** Preformatted in MYR here so the client never re-derives money from sen. */
  amountDisplay: string;
  frequency: "one_time" | "monthly";
  paymentMethod: "duitnow_qr" | "online_banking" | "card";
  /** ISO-8601 UTC, as stored. Rendered in Asia/Kuala_Lumpur at the edge. */
  createdAt: string;
}

export interface PendingSponsorshipsResult {
  success: boolean;
  data?: PendingSponsorshipDTO[];
  error?: string;
}

/** `PENDING_PAYMENT` → "pending payment", for a sentence a coordinator reads. */
function statusLabel(status: string): string {
  return status.toLowerCase().replace(/_/g, " ");
}

/**
 * Server Action: the commitments awaiting a coordinator's confirmation.
 *
 * The read half of reconciliation. `reconcilePetSponsorshipAction` has existed and
 * been guarded since PR #6 but nothing called it, so every commitment stayed
 * `PENDING_PAYMENT`, no `receiptNumber` was ever assigned, and the portal's
 * account-claim challenge — which requires one — could never be satisfied by
 * anybody. See `tasks/open/sponsor-portal-is-inert-until-reconciliation-is-reachable.md`.
 *
 * Guarded with `RECONCILE_SPONSORSHIPS` rather than a role list because a capability
 * question survives a role being renamed. The permission is granted to exactly the
 * roles `reconcilePetSponsorshipAction`'s own `[ADMIN, COORDINATOR]` guard admits, so
 * this page never shows a button that the mutation behind it would reject.
 *
 * The guard sits inside the `try`, as in `fetchAuditLogsAction`. A production build
 * masks a thrown Server Action error into an opaque digest, so a thrown denial reached
 * the page indistinguishable from an outage; returned, it arrives as the guard's own
 * message and the page can say who may not do this.
 *
 * `taxIdOrIc` is deliberately absent from the DTO: a coordinator confirming that a
 * bank transfer landed does not need the supporter's tax identifier to do it, and
 * projecting it here would put a statutory identifier on a screen for no purpose.
 */
export async function listPendingSponsorshipsAction(): Promise<PendingSponsorshipsResult> {
  try {
    const session = await getCurrentSession();
    assertHasPermission(session, PERMISSIONS.RECONCILE_SPONSORSHIPS);

    const rows = await listPendingSponsorships();
    return {
      success: true,
      data: rows.map((row) => ({
        pledgeRef: row.pledgeRef,
        petName: row.petName,
        sponsorName: row.sponsorName,
        sponsorEmail: row.sponsorEmail,
        tierName: row.tierName,
        amountDisplay: formatMYR(row.amountSen),
        frequency: row.frequency,
        paymentMethod: row.paymentMethod,
        createdAt: row.createdAt,
      })),
    };
  } catch (err) {
    if (isAuthorizationError(err)) return { success: false, error: err.message };

    // Surfaced, never swallowed into an empty list: an empty queue reads as "every
    // supporter has been settled", and a coordinator who believes that stops looking.
    console.error("[Sponsorship Reconciliation] Pending queue read failed:", err);
    return {
      success: false,
      error:
        "We could not load the pending commitments. This is a read failure, not an empty queue — do not treat it as nothing to do.",
    };
  }
}

export interface ReconcileSponsorshipResult {
  success: boolean;
  receiptNumber?: string;
  error?: string;
}

/**
 * Server Action: a coordinator confirms the transfer for a pledge has landed.
 *
 * This is the only path that turns a commitment into a statutory document. The
 * receipt is drawn through `settleSponsorship`, from the same gapless per-month
 * series as every other receipt, *inside the transaction* that moves the pledge to
 * `ACTIVE`. Two coordinators confirming at once therefore produce one receipt, and
 * the one who lost is handed the number that exists. Until 2026-09-14 this action
 * issued first and guarded second, so a lost race left a receipt attached to
 * nothing and a log line asking for an offsetting correction; there is no spare
 * outcome any more.
 *
 * The guard returns its denial for the reason `listPendingSponsorshipsAction`'s
 * does; the rest of the action keeps its own error handling, because "the receipt
 * could not be issued" and "you may not do this" are different sentences.
 */
export async function reconcilePetSponsorshipAction(
  pledgeRef: string
): Promise<ReconcileSponsorshipResult> {
  let session: SessionUser;
  try {
    const current = await getCurrentSession();
    assertAuthorized(current, [ROLES.ADMIN, ROLES.COORDINATOR]);
    session = current;
  } catch (err) {
    if (isAuthorizationError(err)) return { success: false, error: err.message };
    throw err;
  }

  let outcome;
  try {
    outcome = await settleSponsorship(pledgeRef, currentIssuerIdentity(), session.email);
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

  if (outcome.status === "not_found") {
    return { success: false, error: `No sponsorship found for pledge ${pledgeRef}` };
  }
  if (outcome.status === "not_pending") {
    return {
      success: false,
      error: `Pledge ${pledgeRef} is ${statusLabel(outcome.currentStatus)} and cannot be reconciled`,
    };
  }
  if (outcome.status === "already_reconciled") {
    // Settled already, by this coordinator a moment ago or by another. Return the
    // number that exists rather than minting another for the same money.
    return { success: true, receiptNumber: outcome.receiptNumber };
  }

  const { record, donation } = outcome;

  recordAuditLog({
    actorId: session.id,
    actorEmail: session.email,
    actorRole: session.role,
    action: "SPONSORSHIP_RECONCILED",
    entity: "PetSponsorship",
    entityId: pledgeRef,
    details: {
      pledgeRef,
      receiptNumber: donation.receiptNumber,
      petName: record.petName,
      sponsorEmail: record.sponsorEmail,
      amountSen: record.amountSen as number,
      amountDisplay: formatMYR(record.amountSen),
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

export interface RejectSponsorshipResult {
  success: boolean;
  error?: string;
}

/** Longest reason the audit row keeps: a coordinator's note, not an essay. */
const REJECTION_REASON_MAX = 500;

/**
 * Server Action: a coordinator dismisses a pledge no transfer ever backed.
 *
 * The other exit from the queue. Without it an unpaid or bogus claim sat in
 * `PENDING_PAYMENT` forever, in front of every coordinator, every day. Nothing is
 * issued and nothing is emailed: a dismissed claim is not a gift and earns no
 * receipt. The actor and the reason go to the audit log, which is the record of
 * *why* a pledge left the queue; the row itself records only that it did.
 *
 * `reason` is normalised before the write. A Server Action's arguments arrive
 * deserialised and unchecked, and a reason that is not a string must be rejected
 * *before* the row flips — a TypeError after it would leave the pledge cancelled
 * with no audit row and a message saying it is still pending.
 */
export async function rejectPetSponsorshipAction(
  pledgeRef: string,
  reason?: string
): Promise<RejectSponsorshipResult> {
  try {
    const session = await getCurrentSession();
    assertHasPermission(session, PERMISSIONS.RECONCILE_SPONSORSHIPS);

    const note =
      typeof reason === "string" ? reason.trim().slice(0, REJECTION_REASON_MAX) || null : null;

    const outcome = await rejectPendingSponsorship(pledgeRef);
    if (outcome.status === "not_found") {
      return { success: false, error: `No sponsorship found for pledge ${pledgeRef}` };
    }
    if (outcome.status === "already_reconciled") {
      return {
        success: false,
        error: `Pledge ${pledgeRef} has already been reconciled as receipt ${outcome.receiptNumber} and cannot be dismissed`,
      };
    }
    if (outcome.status === "not_pending") {
      return {
        success: false,
        error: `Pledge ${pledgeRef} is already ${statusLabel(outcome.currentStatus)}`,
      };
    }

    const { record } = outcome;
    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "SPONSORSHIP_REJECTED",
      entity: "PetSponsorship",
      entityId: pledgeRef,
      details: {
        pledgeRef,
        reason: note,
        petName: record.petName,
        sponsorEmail: record.sponsorEmail,
        amountSen: record.amountSen as number,
        amountDisplay: formatMYR(record.amountSen),
      },
    });

    return { success: true };
  } catch (err) {
    if (isAuthorizationError(err)) return { success: false, error: err.message };

    console.error("[Sponsorship Reconciliation] Dismiss failed:", err);
    return {
      success: false,
      error:
        "We could not dismiss that pledge, so it is still pending. Please reload and try again.",
    };
  }
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
