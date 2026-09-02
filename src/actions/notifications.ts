"use server";

import { revalidatePath } from "next/cache";
import {
  getNotificationPreference,
  setNotificationPreference,
} from "@/lib/server/notificationPreferences";
import { verifyNotificationToken } from "@/lib/notificationTokens";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { recordAuditLog } from "@/lib/domain/auditLog";
import { NotificationPreferenceRecord } from "@/types/notifications";

export interface PreferenceLookupResult {
  success: boolean;
  /**
   * False when the caller presented an unsubscribe token, which may only turn
   * notifications OFF. Lets the page hide controls that would be rejected.
   */
  canEnable?: boolean;
  /** Masked for display — the full address is never echoed back to the browser. */
  maskedEmail?: string;
  preferences?: Pick<NotificationPreferenceRecord, "photoUpdates" | "newsletter">;
  error?: string;
}

/**
 * Masks an address for display on the preference page. The token holder almost
 * certainly owns the mailbox, but echoing the full address back turns a leaked
 * link into a confirmed-address disclosure for no benefit.
 */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "your address";
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${"*".repeat(Math.max(local.length - visible.length, 1))}@${domain}`;
}

function describeTokenFailure(reason: string): string {
  switch (reason) {
    case "expired":
      return "This preference link has expired. Please contact the shelter and we will send you a fresh one.";
    case "bad_signature":
    case "malformed":
    case "wrong_purpose":
    default:
      return "This preference link is not valid. Please use the link from a recent email.";
  }
}

/**
 * Two token purposes reach this page, with different powers.
 *
 * A `manage` token comes from the footer of an email the donor received and can
 * change anything. An `unsubscribe` token comes from the `List-Unsubscribe`
 * header, which mail providers, link scanners and anyone the message was
 * forwarded to can read — so it may only turn things OFF. Both may read, because
 * showing someone their own settings from a link mailed to them is not the
 * escalation that matters; switching notifications back on is.
 */
export async function getNotificationPreferencesAction(
  token: string
): Promise<PreferenceLookupResult> {
  const verification = verifyNotificationToken(token);
  if (!verification.valid) {
    return { success: false, error: describeTokenFailure(verification.reason) };
  }

  const preferences = await getNotificationPreference(verification.email);

  return {
    success: true,
    canEnable: verification.purpose === "manage",
    maskedEmail: maskEmail(verification.email),
    preferences: {
      photoUpdates: preferences.photoUpdates,
      newsletter: preferences.newsletter,
    },
  };
}

export async function updateNotificationPreferencesAction(
  token: string,
  patch: { photoUpdates?: boolean; newsletter?: boolean }
): Promise<PreferenceLookupResult> {
  const verification = verifyNotificationToken(token);
  if (!verification.valid) {
    return { success: false, error: describeTokenFailure(verification.reason) };
  }

  const canEnable = verification.purpose === "manage";
  const wantsToEnable = patch.photoUpdates === true || patch.newsletter === true;

  if (!canEnable && wantsToEnable) {
    return {
      success: false,
      canEnable: false,
      error:
        "This link can only turn notifications off. To switch them back on, use the " +
        "\u201cManage email preferences\u201d link in the footer of a recent email.",
    };
  }

  // Throttled per address, so a leaked or guessed token cannot be used to
  // flap someone's preferences or hammer the database.
  const rateLimit = checkRateLimit(`prefs:${verification.email}`, 30, 300000);
  if (!rateLimit.success) {
    return {
      success: false,
      error: `Too many changes. Please wait ${rateLimit.retryAfterSeconds}s and try again.`,
    };
  }

  const sanitized: { photoUpdates?: boolean; newsletter?: boolean } = {};
  if (typeof patch.photoUpdates === "boolean") sanitized.photoUpdates = patch.photoUpdates;
  if (typeof patch.newsletter === "boolean") sanitized.newsletter = patch.newsletter;

  const updated = await setNotificationPreference(verification.email, sanitized);

  recordAuditLog({
    actorId: "donor_self_service",
    actorEmail: verification.email,
    actorRole: "DONOR",
    action: "NOTIFICATION_PREFERENCES_UPDATED",
    entity: "NotificationPreference",
    entityId: verification.email,
    details: {
      photoUpdates: updated.photoUpdates,
      newsletter: updated.newsletter,
      via: "preference_page",
    },
  });

  revalidatePath("/account/notifications");

  return {
    success: true,
    canEnable,
    maskedEmail: maskEmail(verification.email),
    preferences: {
      photoUpdates: updated.photoUpdates,
      newsletter: updated.newsletter,
    },
  };
}
