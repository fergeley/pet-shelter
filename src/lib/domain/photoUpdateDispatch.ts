import crypto from "node:crypto";
import { sendPetPhotoUpdateEmail, absolutizeAssetUrl } from "@/lib/email";
import { recordAuditLog, flushAuditLogWrites } from "@/lib/domain/auditLog";
import {
  SponsorshipRecord,
  listActiveSponsorshipsForPet,
} from "@/lib/server/sponsorshipLedger";
import { partitionByConsent } from "@/lib/server/notificationPreferences";
import { createNotificationToken } from "@/lib/notificationTokens";
import { withIdempotency } from "@/lib/security/idempotency";
import { settleWithConcurrency } from "@/lib/concurrency";
import { appUrl, warnIfAppUrlUnconfigured } from "@/lib/appUrl";
import {
  MAX_PHOTOS_PER_NOTIFICATION,
  MAX_RECIPIENTS_PER_DISPATCH,
  PHOTO_UPDATE_ELIGIBLE_TIERS,
  PhotoUpdateDispatchResult,
} from "@/types/notifications";

/**
 * How many sends may be in flight at once. Email providers rate-limit per
 * account, and a 429 comes back as a delivery failure indistinguishable from a
 * bad address — so a fan-out that ignores the limit manufactures its own
 * failures.
 *
 * The fan-out has a deadline: `after()` work runs inside the route's
 * `maxDuration`, which `src/app/admin/pets/page.tsx` raises for this reason. A
 * full list at this concurrency is ~50 sequential provider round-trips. Beyond
 * that scale this belongs in a real queue.
 */
const EMAIL_DISPATCH_CONCURRENCY = 5;

/**
 * Identifies gallery images that are genuinely new.
 *
 * This is why the feature is safe to attach to the pet form. Gallery photos are
 * edited as part of the whole pet record, so "an admin saved a pet" is *not* the
 * same event as "an admin added a photo" — without this diff, fixing a typo in a
 * description would re-notify every supporter of that animal.
 *
 * Order-insensitive and duplicate-safe: reordering the gallery, or re-saving the
 * same set, yields nothing.
 */
export function diffNewGalleryImages(
  previous: string[] | null | undefined,
  next: string[] | null | undefined
): string[] {
  const before = new Set((previous || []).filter(Boolean));
  const added: string[] = [];
  const seen = new Set<string>();

  for (const url of next || []) {
    if (!url) continue;
    if (before.has(url)) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    added.push(url);
  }

  return added;
}

/**
 * Which supporters hear about new photos.
 *
 * The commitment being ACTIVE already carries most of the weight: on this
 * platform that status is set by a coordinator reconciling the pledge against a
 * bank statement, so it means a human confirmed real money arrived — a far
 * stronger signal than an unverified web form.
 *
 * On top of that, the two highest one-time tiers qualify, as does *any* monthly
 * commitment regardless of tier: an ongoing relationship outranks a single gift.
 */
export function isEligibleForPhotoUpdates(record: SponsorshipRecord): boolean {
  if (record.status !== "ACTIVE") return false;
  if (record.frequency === "monthly") return true;
  return PHOTO_UPDATE_ELIGIBLE_TIERS.includes(record.tierId);
}

export interface PhotoUpdateDispatchInput {
  petId: string;
  petName: string;
  /** Images added by this save, as returned by `diffNewGalleryImages`. */
  newImageUrls: string[];
  caption?: string;
  /** Suppresses the dispatch entirely — the admin's opt-out checkbox. */
  notifySponsors: boolean;
  /** Archived animals never generate supporter mail. */
  petIsArchived?: boolean;
  actorEmail?: string;
}

function emptyResult(reason: string): PhotoUpdateDispatchResult {
  return {
    dispatched: 0,
    skippedOptedOut: 0,
    skippedIneligible: 0,
    skippedUnresolved: 0,
    failed: 0,
    truncated: false,
    skippedReason: reason,
    recipients: [],
  };
}

function preferencesUrl(email: string): string {
  const token = createNotificationToken(email, "manage");
  return appUrl(`account/notifications?token=${encodeURIComponent(token)}`);
}

function oneClickUnsubscribeUrl(email: string): string {
  const token = createNotificationToken(email, "unsubscribe");
  return appUrl(`api/notifications/unsubscribe?token=${encodeURIComponent(token)}&list=photo`);
}

/**
 * The audience for one animal: eligible supporters, one entry per address, so a
 * donor who committed twice receives one email rather than two.
 */
function buildAudience(records: SponsorshipRecord[]): {
  eligible: SponsorshipRecord[];
  ineligibleCount: number;
} {
  const eligible: SponsorshipRecord[] = [];
  const seen = new Set<string>();
  let ineligibleCount = 0;

  for (const record of records) {
    if (!isEligibleForPhotoUpdates(record)) {
      ineligibleCount += 1;
      continue;
    }
    const email = record.sponsorEmail.trim().toLowerCase();
    if (seen.has(email)) continue;
    seen.add(email);
    eligible.push(record);
  }

  return { eligible, ineligibleCount };
}

/**
 * Fans a new-photo notification out to a pet's eligible, consenting supporters.
 *
 * Every send is isolated: one malformed address or one provider failure must not
 * abort delivery to the rest of the list, so failures are counted and audited
 * rather than thrown. The function never rejects — callers schedule it with
 * `after()` and have no way to handle an error by then.
 */
export async function dispatchPetPhotoUpdate(
  input: PhotoUpdateDispatchInput
): Promise<PhotoUpdateDispatchResult> {
  if (!input.notifySponsors) return emptyResult("notification_disabled_by_admin");
  if (input.petIsArchived) return emptyResult("pet_archived");

  const newImages = (input.newImageUrls || []).filter(Boolean);
  if (newImages.length === 0) return emptyResult("no_new_images");

  // A stable key over "this pet, these exact photos" so an accidental double-save
  // inside the idempotency window does not mail the list twice.
  const fingerprint = crypto
    .createHash("sha256")
    .update(`${input.petId}|${[...newImages].sort().join("|")}`)
    .digest("hex")
    .slice(0, 24);

  return withIdempotency(`photo-update:${fingerprint}`, () =>
    runDispatch(input, newImages, fingerprint)
  );
}

async function runDispatch(
  input: PhotoUpdateDispatchInput,
  newImages: string[],
  fingerprint: string
): Promise<PhotoUpdateDispatchResult> {
  warnIfAppUrlUnconfigured("sponsor photo update links");

  // Resolve the images before deciding to send. `absolutizeAssetUrl` drops any
  // non-http(s) scheme, so a gallery of `data:` or `javascript:` entries leaves
  // nothing renderable — and an email announcing a photo with no photo in it is
  // worse than no email.
  const renderableImages = newImages
    .slice(0, MAX_PHOTOS_PER_NOTIFICATION)
    .filter((url) => absolutizeAssetUrl(url) !== "");

  if (renderableImages.length === 0) {
    const result = emptyResult("no_renderable_images");
    await auditDispatch(input, newImages, fingerprint, result);
    return result;
  }

  const { eligible, ineligibleCount } = buildAudience(
    await listActiveSponsorshipsForPet(input.petId)
  );

  if (eligible.length === 0) {
    const result = emptyResult("no_eligible_sponsors");
    result.skippedIneligible = ineligibleCount;
    await auditDispatch(input, newImages, fingerprint, result);
    return result;
  }

  const { allowed, blocked, unresolved } = await partitionByConsent(
    eligible.map((s) => s.sponsorEmail),
    "photoUpdates"
  );

  const allowedSet = new Set(allowed);
  let audience = eligible.filter((s) =>
    allowedSet.has(s.sponsorEmail.trim().toLowerCase())
  );

  if (audience.length === 0) {
    const result = emptyResult(
      unresolved.length > 0 ? "consent_unresolved" : "all_sponsors_opted_out"
    );
    result.skippedOptedOut = blocked.length;
    result.skippedUnresolved = unresolved.length;
    result.skippedIneligible = ineligibleCount;
    await auditDispatch(input, newImages, fingerprint, result);
    return result;
  }

  const truncated = audience.length > MAX_RECIPIENTS_PER_DISPATCH;
  if (truncated) audience = audience.slice(0, MAX_RECIPIENTS_PER_DISPATCH);

  // Written *before* the fan-out. If the platform kills the invocation partway,
  // this is the only evidence the mailing happened at all.
  recordAuditLog({
    actorId: "system_mailer",
    actorEmail: input.actorEmail || "mailer@hopeforstrays.org",
    actorRole: "SYSTEM",
    action: "SPONSOR_PHOTO_UPDATE_STARTED",
    entity: "SponsorNotification",
    entityId: input.petId,
    details: {
      petName: input.petName,
      fingerprint,
      intendedRecipients: audience.length,
      newImageCount: renderableImages.length,
      truncated,
    },
  });
  // Drained here rather than left floating: this row is the only evidence the
  // mailing started, and the platform may freeze the invocation the moment the
  // deferred work settles.
  await flushAuditLogWrites();

  // Bounded fan-out, not `Promise.allSettled` over the whole list: results still
  // come back in input order, but only a handful of requests are ever in flight.
  const outcomes = await settleWithConcurrency(
    audience,
    EMAIL_DISPATCH_CONCURRENCY,
    (sponsor) =>
      sendPetPhotoUpdateEmail({
        petId: input.petId,
        petName: input.petName,
        sponsorName: sponsor.sponsorName,
        sponsorEmail: sponsor.sponsorEmail,
        imageUrls: renderableImages,
        caption: input.caption,
        preferencesUrl: preferencesUrl(sponsor.sponsorEmail),
        oneClickUnsubscribeUrl: oneClickUnsubscribeUrl(sponsor.sponsorEmail),
      })
  );

  let dispatched = 0;
  let failed = 0;
  const recipients: string[] = [];

  outcomes.forEach((outcome, index) => {
    const email = audience[index].sponsorEmail;
    if (outcome.status === "fulfilled" && outcome.value.success) {
      dispatched += 1;
      recipients.push(email);
    } else {
      failed += 1;
      const reason =
        outcome.status === "rejected" ? outcome.reason : outcome.value.error || "unknown";
      console.error(`[Photo Update] Delivery failed for ${email}:`, reason);
    }
  });

  const result: PhotoUpdateDispatchResult = {
    dispatched,
    skippedOptedOut: blocked.length,
    skippedIneligible: ineligibleCount,
    skippedUnresolved: unresolved.length,
    failed,
    truncated,
    recipients,
  };

  await auditDispatch(input, newImages, fingerprint, result);
  return result;
}

async function auditDispatch(
  input: PhotoUpdateDispatchInput,
  newImages: string[],
  fingerprint: string,
  result: PhotoUpdateDispatchResult
): Promise<void> {
  // Awaited: this row is the durable record of a consent-based mailing, written
  // at the tail of deferred work the platform may freeze immediately after.
  recordAuditLog({
    actorId: "system_mailer",
    actorEmail: input.actorEmail || "mailer@hopeforstrays.org",
    actorRole: "SYSTEM",
    action: "SPONSOR_PHOTO_UPDATE_DISPATCHED",
    entity: "SponsorNotification",
    entityId: input.petId,
    details: {
      petName: input.petName,
      fingerprint,
      newImageCount: newImages.length,
      hasCaption: Boolean(input.caption?.trim()),
      dispatched: result.dispatched,
      skippedOptedOut: result.skippedOptedOut,
      skippedIneligible: result.skippedIneligible,
      skippedUnresolved: result.skippedUnresolved,
      failed: result.failed,
      truncated: result.truncated,
      skippedReason: result.skippedReason,
    },
  });
  await flushAuditLogWrites();
}
