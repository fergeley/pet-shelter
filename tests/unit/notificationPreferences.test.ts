import { describe, it, expect } from "vitest";
import {
  createNotificationToken,
  verifyNotificationToken,
  normalizeEmail,
} from "@/lib/notificationTokens";
import {
  getNotificationPreference,
  setNotificationPreference,
  partitionByConsent,
} from "@/lib/server/notificationPreferences";

describe("Notification preference tokens", () => {
  it("round-trips an address through a signed token", () => {
    const result = verifyNotificationToken(
      createNotificationToken("Donor@Example.com", "manage"),
      "manage"
    );

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.email).toBe("donor@example.com");
      expect(result.purpose).toBe("manage");
    }
  });

  it("rejects a token whose payload has been tampered with", () => {
    const [, signature] = createNotificationToken("victim@example.com", "manage").split(".");

    const forged = Buffer.from(
      JSON.stringify({ e: "attacker@example.com", p: "manage", x: Date.now() + 60000 }),
      "utf8"
    )
      .toString("base64")
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");

    const result = verifyNotificationToken(`${forged}.${signature}`, "manage");
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("bad_signature");
  });

  it("rejects an expired token", () => {
    const result = verifyNotificationToken(
      createNotificationToken("lapsed@example.com", "manage", -1000),
      "manage"
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("expired");
  });

  it("refuses an unsubscribe token where a manage token is required", () => {
    const result = verifyNotificationToken(
      createNotificationToken("donor@example.com", "unsubscribe"),
      "manage"
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("wrong_purpose");
  });

  it("rejects malformed and empty inputs without throwing", () => {
    expect(verifyNotificationToken(null).valid).toBe(false);
    expect(verifyNotificationToken("").valid).toBe(false);
    expect(verifyNotificationToken("no-separator").valid).toBe(false);
    expect(verifyNotificationToken(".").valid).toBe(false);
    expect(verifyNotificationToken("abc.").valid).toBe(false);
  });

  it("normalises addresses so casing cannot fork a preference record", () => {
    expect(normalizeEmail("  Donor@Example.COM ")).toBe("donor@example.com");
  });
});

describe("Donor notification preferences", () => {
  it("treats an address that has never expressed a choice as opted in", async () => {
    const preference = await getNotificationPreference("newcomer@example.com");

    expect(preference.photoUpdates).toBe(true);
    expect(preference.newsletter).toBe(true);
    expect(preference.unsubscribedAllAt).toBeNull();
  });

  it("persists an opt-out without touching the other channel", async () => {
    await setNotificationPreference("quiet@example.com", { photoUpdates: false });
    const preference = await getNotificationPreference("quiet@example.com");

    expect(preference.photoUpdates).toBe(false);
    expect(preference.newsletter).toBe(true);
    expect(preference.unsubscribedAllAt).toBeNull();
  });

  it("stamps unsubscribedAllAt only when every channel is off, and clears it on re-subscribe", async () => {
    await setNotificationPreference("all-off@example.com", {
      photoUpdates: false,
      newsletter: false,
    });
    expect((await getNotificationPreference("all-off@example.com")).unsubscribedAllAt).toBeTruthy();

    await setNotificationPreference("all-off@example.com", { newsletter: true });
    expect((await getNotificationPreference("all-off@example.com")).unsubscribedAllAt).toBeNull();
  });

  it("is idempotent — unsubscribing twice leaves the same state", async () => {
    const first = await setNotificationPreference("twice@example.com", { photoUpdates: false });
    const second = await setNotificationPreference("twice@example.com", { photoUpdates: false });

    expect(second.photoUpdates).toBe(false);
    expect(second.unsubscribedAllAt).toBe(first.unsubscribedAllAt);
  });
});

describe("Consent partitioning", () => {
  it("separates consenting addresses from opted-out ones", async () => {
    await setNotificationPreference("optedout@example.com", { photoUpdates: false });

    const { allowed, blocked, unresolved } = await partitionByConsent(
      ["keen@example.com", "optedout@example.com", "KEEN@example.com"],
      "photoUpdates"
    );

    expect(allowed).toEqual(["keen@example.com"]);
    expect(blocked).toEqual(["optedout@example.com"]);
    expect(unresolved).toEqual([]);
  });

  it("keeps channels independent — a newsletter opt-out still gets photo updates", async () => {
    await setNotificationPreference("photos-yes@example.com", { newsletter: false });

    expect((await partitionByConsent(["photos-yes@example.com"], "photoUpdates")).allowed).toEqual([
      "photos-yes@example.com",
    ]);
    expect((await partitionByConsent(["photos-yes@example.com"], "newsletter")).blocked).toEqual([
      "photos-yes@example.com",
    ]);
  });

  it("de-duplicates an address that appears more than once", async () => {
    const { allowed } = await partitionByConsent(
      ["dupe@example.com", "dupe@example.com", " Dupe@Example.com "],
      "photoUpdates"
    );
    expect(allowed).toEqual(["dupe@example.com"]);
  });
});
