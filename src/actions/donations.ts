"use server";

import {
  donationPledgeSchema,
  DonationPledgeInput,
  DonationReceiptDTO,
} from "@/lib/validations/donation";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { sendDonationReceiptEmail } from "@/lib/email";
import { findSponsorshipTier } from "@/lib/domain/sponsorshipTiers";
import { currentIssuerIdentity } from "@/lib/domain/shelterIdentity";
import { ringgitFromSen, senFromRinggit } from "@/lib/domain/money";
import {
  DonationRecord,
  ReceiptIssuanceError,
  issueDonationReceipt,
  listDonationsOrThrow,
} from "@/lib/server/donationLedger";
import { getCurrentSession } from "@/lib/security/session";
import { assertAuthorized, ROLES } from "@/lib/security/rbac";

/**
 * Renders an issued receipt for the donor-facing confirmation and the emailed PDF.
 *
 * Converts the ledger's exact integer sen back to a ringgit `number` at this
 * boundary — and only here — so the existing `DonationReceiptDTO` contract, the
 * email template, and the CSV export keep working unchanged while the stored value
 * stays exact. See `src/lib/domain/money.ts` for why the two representations differ.
 */
function toReceiptDTO(record: DonationRecord): DonationReceiptDTO {
  return {
    receiptNumber: record.receiptNumber,
    date: new Date(record.issuedAt).toLocaleDateString("en-MY", {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    donorName: record.donorName,
    donorEmail: record.donorEmail,
    donorPhone: record.donorPhone,
    tierId: record.tierId,
    tierName: record.tierName,
    amountMYR: ringgitFromSen(record.amountSen),
    frequency: record.frequency,
    paymentMethod: record.paymentMethod,
    targetPetName: record.targetPetName,
    taxIdOrIc: record.taxIdOrIc,
    notes: record.notes,
    taxDeductibleRef: record.taxDeductibleRef,
    shelterRegistrationNo: record.shelterRegistrationNo,
  };
}

/** Normalises an optional free-text field: trimmed, or absent if empty. */
function optionalText(value: string | undefined): string | undefined {
  const trimmed = value?.trim();
  return trimmed ? trimmed : undefined;
}

/**
 * Server Action: validates a donation pledge and issues an official LHDN
 * Section 44(6) tax-deductible e-receipt.
 *
 * ## Ordering is load-bearing
 *
 * The receipt is **persisted before** anything observable leaves the system. A
 * donor holding a receipt number that was never recorded cannot claim the relief
 * and the shelter cannot reconcile its ROS annual return, so the write is the gate:
 *
 *   1. validate → 2. rate-limit → 3. persist + allocate number → 4. audit → 5. email
 *
 * Step 3 throwing means steps 4 and 5 never run and the donor is told to retry,
 * which is the correct outcome. This is a deliberate departure from the
 * fire-and-forget style used elsewhere in `src/actions` — see the module comment in
 * `src/lib/server/donationLedger.ts` for why donation records do not get the dual-layer
 * store's forgiving fallback.
 */
export async function submitDonationPledgeAction(
  input: DonationPledgeInput
): Promise<{ success: boolean; data?: DonationReceiptDTO; error?: string }> {
  try {
    const validated = donationPledgeSchema.parse(input);

    // 1. Rate limiting: max 20 donation submissions per 5 minutes per donor email.
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

    // 2. Resolve the tier name, snapshotting it onto the receipt so a later rename
    //    of the sponsorship catalog cannot alter an already-issued document.
    const matchedTier = findSponsorshipTier(validated.tierId);
    const tierName =
      optionalText(validated.tierName) ?? matchedTier?.name ?? "Custom Rescue Donation";

    // 3. Issue and persist. `senFromRinggit` rejects sub-sen precision outright
    //    rather than rounding an amount that will appear on a tax document.
    const issuer = currentIssuerIdentity();
    const record = await issueDonationReceipt({
      donorName: validated.donorName.trim(),
      donorEmail: validated.donorEmail.trim().toLowerCase(),
      donorPhone: optionalText(validated.donorPhone),
      taxIdOrIc: optionalText(validated.taxIdOrIc),
      tierId: validated.tierId,
      tierName,
      amountSen: senFromRinggit(validated.amountMYR),
      currency: "MYR",
      frequency: validated.frequency,
      paymentMethod: validated.paymentMethod,
      targetPetName: optionalText(validated.targetPetName),
      notes: optionalText(validated.notes),
      taxDeductibleRef: issuer.taxDeductibleRef,
      shelterRegistrationNo: issuer.shelterRegistrationNo,
    });

    const receipt = toReceiptDTO(record);

    // 4. Audit trail. Now that the ledger is the system of record, this captures
    //    *that* a receipt was issued and by whom, not the receipt's contents —
    //    `donationId` is the join back to the authoritative row.
    recordAuditLog({
      actorId: "donor_public",
      actorEmail: record.donorEmail,
      actorRole: "DONOR",
      action: "DONATION_RECEIVED",
      entity: "Donation",
      entityId: record.receiptNumber,
      details: {
        donationId: record.id,
        receiptNumber: record.receiptNumber,
        donorName: record.donorName,
        amountMYR: receipt.amountMYR,
        amountSen: record.amountSen,
        tierId: record.tierId,
        tierName: record.tierName,
        frequency: record.frequency,
        paymentMethod: record.paymentMethod,
        targetPetName: record.targetPetName,
        taxIdOrIc: record.taxIdOrIc,
      },
    });

    // 5. Email dispatch stays non-blocking: the receipt is already durable, so a
    //    Resend outage must not fail a donation that genuinely succeeded.
    sendDonationReceiptEmail(receipt).catch((err) =>
      console.error("[Donation Receipt Email Dispatch Failed]", err)
    );

    return { success: true, data: receipt };
  } catch (err: unknown) {
    if (err instanceof ReceiptIssuanceError) {
      console.error("[Donation Ledger] Receipt issuance failed:", err.cause ?? err);
      return {
        success: false,
        error:
          "We could not record your donation just now, so no receipt was issued. " +
          "Nothing has been charged — please try again in a moment.",
      };
    }

    const errorMsg =
      err instanceof Error ? err.message : "Failed to process donation pledge";
    return { success: false, error: errorMsg };
  }
}

/**
 * Upper bound on one export. Not a page size — the export is a single statutory
 * document and paging it would put the truncation back where nobody sees it.
 */
const RECEIPT_EXPORT_LIMIT = 1000;

/**
 * The LHDN receipts export, served from the donation ledger.
 *
 * ## Why this exists
 *
 * The export used to be assembled in the browser from `fetchAuditLogsAction(250)` —
 * the 250 most recent audit rows *of any kind*. Pet edits, logins and application
 * approvals consume that budget, so on a shelter with ordinary admin traffic older
 * receipts fell off the annual return while the UI reported success. The export
 * engine predates the ledger: it landed 2026-08-16, `donationLedger.ts` on
 * 2026-08-27, the `Donation` model on 2026-08-29. It read the audit trail because
 * that was the only source of donation data at the time.
 *
 * ## An outage must not read as "no donations"
 *
 * The read goes through `listDonationsOrThrow`, not `listDonations`. The latter
 * returns `[]` on any read failure, so a Neon outage would arrive here as a
 * successful, empty statutory return — indistinguishable from a shelter that took
 * no donations, and wrong in a way nobody downstream can detect.
 *
 * ## Truncation is observed, not inferred
 *
 * We ask the ledger for one row more than we will return. `records.length > bounded`
 * is then a fact about the data rather than a guess from `length === limit`, which
 * cannot tell a full page from an exact fit. The caller is expected to surface
 * `truncated` — a receipt missing from a tax filing is the defect this replaces,
 * and moving the cap without reporting it would only change the number at which
 * the same silence begins.
 *
 * Returns `DonationReceiptDTO`, mapped by the same `toReceiptDTO` the donor-facing
 * confirmation and the receipt email use, so the three cannot disagree about what a
 * receipt says. The exact integer sen becomes ringgit at that one boundary.
 */
export async function fetchDonationReceiptsAction(
  limit = RECEIPT_EXPORT_LIMIT
): Promise<{
  success: boolean;
  data?: DonationReceiptDTO[];
  truncated?: boolean;
  error?: string;
}> {
  try {
    const session = await getCurrentSession();
    assertAuthorized(session, [ROLES.ADMIN, ROLES.COORDINATOR]);

    // A non-finite limit crosses the RPC boundary as easily as a good one, and
    // NaN propagates silently all the way to `{success: true, data: []}` — a clean
    // "no donations" answer to a malformed request, on a tax export.
    const bounded = Number.isFinite(limit)
      ? Math.min(Math.max(1, Math.floor(limit)), RECEIPT_EXPORT_LIMIT)
      : RECEIPT_EXPORT_LIMIT;
    const records = await listDonationsOrThrow(bounded + 1);

    return {
      success: true,
      data: records.slice(0, bounded).map(toReceiptDTO),
      truncated: records.length > bounded,
    };
  } catch (err: unknown) {
    const msg =
      err instanceof Error ? err.message : "Failed to read the donation ledger";
    return { success: false, error: msg };
  }
}
