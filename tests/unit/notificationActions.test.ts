import { describe, it, expect } from "vitest";

import {
  getNotificationPreferencesAction,
  updateNotificationPreferencesAction,
} from "@/actions/notifications";
import { createNotificationToken } from "@/lib/notificationTokens";
import { getNotificationPreference } from "@/lib/server/notificationPreferences";

describe("Preference actions — token scoping", () => {

  it("accepts a manage token and masks the address it reports back", async () => {
    const token = createNotificationToken("longdonor@example.com", "manage");
    const result = await getNotificationPreferencesAction(token);

    expect(result.success).toBe(true);
    expect(result.preferences).toEqual({ photoUpdates: true, newsletter: true });
    // The token holder almost certainly owns the mailbox, but a leaked link
    // should not become a confirmed-address disclosure.
    expect(result.maskedEmail).toBe("lo*******@example.com");
    expect(result.maskedEmail).not.toContain("longdonor");
  });

  /**
   * An unsubscribe token rides in the `List-Unsubscribe` header, where mail
   * providers and anyone the message is forwarded to can read it. It may read,
   * and it may turn notifications OFF — but never back on.
   */
  it("lets an unsubscribe token read, but flags that it cannot re-enable", async () => {
    const token = createNotificationToken("donor@example.com", "unsubscribe");
    const result = await getNotificationPreferencesAction(token);

    expect(result.success).toBe(true);
    expect(result.canEnable).toBe(false);
  });

  it("lets an unsubscribe token turn notifications off", async () => {
    const token = createNotificationToken("leaving@example.com", "unsubscribe");
    const result = await updateNotificationPreferencesAction(token, { photoUpdates: false });

    expect(result.success).toBe(true);
    const preference = await getNotificationPreference("leaving@example.com");
    expect(preference.photoUpdates).toBe(false);
  });

  it("refuses to let an unsubscribe token switch notifications back ON", async () => {
    await updateNotificationPreferencesAction(
      createNotificationToken("resub@example.com", "manage"),
      { photoUpdates: false }
    );

    const weakToken = createNotificationToken("resub@example.com", "unsubscribe");
    const result = await updateNotificationPreferencesAction(weakToken, { photoUpdates: true });

    expect(result.success).toBe(false);
    const preference = await getNotificationPreference("resub@example.com");
    expect(preference.photoUpdates).toBe(false);
  });

  it("saves a change made with a manage token", async () => {
    const token = createNotificationToken("switcher@example.com", "manage");
    const result = await updateNotificationPreferencesAction(token, { photoUpdates: false });

    expect(result.success).toBe(true);
    expect(result.preferences).toEqual({ photoUpdates: false, newsletter: true });

    const stored = await getNotificationPreference("switcher@example.com");
    expect(stored.photoUpdates).toBe(false);
  });

  it("ignores non-boolean values rather than writing them through", async () => {
    const token = createNotificationToken("sanitised@example.com", "manage");
    const result = await updateNotificationPreferencesAction(token, {
      photoUpdates: "no" as unknown as boolean,
    });

    expect(result.success).toBe(true);
    expect(result.preferences?.photoUpdates).toBe(true);
  });

  it("explains an expired link instead of failing silently", async () => {
    const token = createNotificationToken("stale@example.com", "manage", -1000);
    const result = await getNotificationPreferencesAction(token);

    expect(result.success).toBe(false);
    expect(result.error).toContain("expired");
  });
});
