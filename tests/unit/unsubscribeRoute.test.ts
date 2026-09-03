import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { GET, POST } from "@/app/api/notifications/unsubscribe/route";
import { createNotificationToken } from "@/lib/notificationTokens";
import {
  getNotificationPreference,
  setNotificationPreference,
} from "@/lib/server/notificationPreferences";

const ORIGIN = "https://hopeforstrays.org";

function url(token: string, list?: string): string {
  const target = new URL("/api/notifications/unsubscribe", ORIGIN);
  target.searchParams.set("token", token);
  if (list) target.searchParams.set("list", list);
  return target.toString();
}

describe("RFC 8058 one-click unsubscribe endpoint", () => {

  it("unsubscribes from photo updates on POST", async () => {
    const token = createNotificationToken("bye@example.com", "unsubscribe");
    const response = await POST(new NextRequest(url(token, "photo"), { method: "POST" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ success: true });

    const preference = await getNotificationPreference("bye@example.com");
    expect(preference.photoUpdates).toBe(false);
    expect(preference.newsletter).toBe(true);
  });

  it("defaults to the photo list when none is named", async () => {
    const token = createNotificationToken("default@example.com", "unsubscribe");
    await POST(new NextRequest(url(token), { method: "POST" }));

    const preference = await getNotificationPreference("default@example.com");
    expect(preference.photoUpdates).toBe(false);
  });

  it("can unsubscribe from everything at once", async () => {
    const token = createNotificationToken("silence@example.com", "unsubscribe");
    await POST(new NextRequest(url(token, "all"), { method: "POST" }));

    const preference = await getNotificationPreference("silence@example.com");
    expect(preference.photoUpdates).toBe(false);
    expect(preference.newsletter).toBe(false);
    expect(preference.unsubscribedAllAt).toBeTruthy();
  });

  it("is idempotent — a second POST returns 200 and changes nothing further", async () => {
    const token = createNotificationToken("twice@example.com", "unsubscribe");

    await POST(new NextRequest(url(token, "photo"), { method: "POST" }));
    const before = await getNotificationPreference("twice@example.com");

    const second = await POST(new NextRequest(url(token, "photo"), { method: "POST" }));
    const after = await getNotificationPreference("twice@example.com");

    expect(second.status).toBe(200);
    expect(after).toEqual(before);
  });

  it("rejects an invalid token with 400 and mutates nothing", async () => {
    await setNotificationPreference("untouched@example.com", { photoUpdates: true });

    const response = await POST(
      new NextRequest(url("not-a-real-token"), { method: "POST" })
    );

    expect(response.status).toBe(400);
    const preference = await getNotificationPreference("untouched@example.com");
    expect(preference.photoUpdates).toBe(true);
  });

  it("rejects a manage-purpose token — an unsubscribe token is required", async () => {
    const manageToken = createNotificationToken("scoped@example.com", "manage");
    const response = await POST(new NextRequest(url(manageToken), { method: "POST" }));

    expect(response.status).toBe(400);
    const preference = await getNotificationPreference("scoped@example.com");
    expect(preference.photoUpdates).toBe(true);
  });

  /**
   * The property that matters most. Inbox providers and link scanners issue GET
   * requests against every URL in a message. If GET unsubscribed, donors would be
   * removed from the list without ever clicking anything.
   */
  it("does NOT unsubscribe on GET — a scanner prefetching the link changes nothing", async () => {
    const token = createNotificationToken("scanner@example.com", "unsubscribe");
    const response = await GET(new NextRequest(url(token, "photo"), { method: "GET" }));

    const preference = await getNotificationPreference("scanner@example.com");
    expect(preference.photoUpdates).toBe(true);
    expect(preference.newsletter).toBe(true);

    // It redirects a human to the preference page instead.
    expect([302, 307]).toContain(response.status);
    const location = response.headers.get("location") || "";
    expect(location).toContain("/account/notifications");
    expect(location).toContain("token=");
  });

  it("redirects an invalid GET to the preference page without leaking why", async () => {
    const response = await GET(new NextRequest(url("garbage"), { method: "GET" }));

    expect([302, 307]).toContain(response.status);
    expect(response.headers.get("location") || "").toContain("/account/notifications");
  });
});
