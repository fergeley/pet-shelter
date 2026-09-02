import { NextRequest, NextResponse } from "next/server";
import { setNotificationPreference } from "@/lib/server/notificationPreferences";
import { verifyNotificationToken } from "@/lib/notificationTokens";
import { recordAuditLog } from "@/lib/domain/auditLog";

/**
 * RFC 8058 one-click unsubscribe.
 *
 * Gmail and Yahoo's bulk sender requirements expect `List-Unsubscribe-Post:
 * List-Unsubscribe=One-Click` paired with an endpoint that acts on **POST**.
 *
 * The distinction is not pedantry. Inbox providers, link scanners and
 * prefetchers routinely issue GET requests against every URL in a message body.
 * If unsubscribing happened on GET, donors would silently vanish from the list
 * without ever clicking anything. So: POST mutates, GET only redirects to the
 * preference page where a human can choose.
 */

type UnsubscribeList = "photo" | "newsletter" | "all";

function parseList(value: string | null): UnsubscribeList {
  if (value === "newsletter") return "newsletter";
  if (value === "all") return "all";
  return "photo";
}

function patchForList(list: UnsubscribeList) {
  switch (list) {
    case "newsletter":
      return { newsletter: false };
    case "all":
      return { photoUpdates: false, newsletter: false };
    case "photo":
    default:
      return { photoUpdates: false };
  }
}

export async function POST(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");
  const list = parseList(searchParams.get("list"));

  const verification = verifyNotificationToken(token, "unsubscribe");

  if (!verification.valid) {
    // A deliberately terse body: this endpoint is called by mail providers, and
    // the reason for rejection is not something to advertise.
    return NextResponse.json(
      { success: false, error: "Invalid or expired unsubscribe link." },
      { status: 400 }
    );
  }

  // Idempotent by construction — unsubscribing an already-unsubscribed address
  // writes the same values and returns the same 200.
  const updated = await setNotificationPreference(verification.email, patchForList(list));

  recordAuditLog({
    actorId: "donor_self_service",
    actorEmail: verification.email,
    actorRole: "DONOR",
    action: "NOTIFICATION_UNSUBSCRIBED",
    entity: "NotificationPreference",
    entityId: verification.email,
    details: {
      list,
      photoUpdates: updated.photoUpdates,
      newsletter: updated.newsletter,
      via: "one_click_rfc8058",
    },
  });

  return NextResponse.json(
    { success: true, message: "You have been unsubscribed." },
    { status: 200 }
  );
}

/**
 * A human (or a scanner) following the link with a plain GET. Deliberately makes
 * no change; hands the visitor a preference page instead.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token = searchParams.get("token");
  const list = parseList(searchParams.get("list"));

  const verification = verifyNotificationToken(token, "unsubscribe");

  if (!verification.valid) {
    return NextResponse.redirect(new URL("/account/notifications?error=invalid", origin));
  }

  // Pass the *same* token through rather than minting a manage token from it.
  // This URL travels in the `List-Unsubscribe` header, where mail providers, link
  // scanners and anyone the message is forwarded to can read it. Upgrading it here
  // would hand that weaker credential the power to switch a donor's notifications
  // back on — exactly what the purpose check in `src/actions/notifications.ts`
  // exists to prevent.
  const destination = new URL("/account/notifications", origin);
  destination.searchParams.set("token", token as string);
  destination.searchParams.set("unsubscribe", list);

  return NextResponse.redirect(destination);
}
