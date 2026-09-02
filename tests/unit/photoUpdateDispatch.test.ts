import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The dispatcher is exercised against a stubbed ledger rather than the real
 * reconciliation machinery: what is under test is who gets mailed and why, not
 * how a pledge becomes ACTIVE.
 */
const listActiveSponsorshipsForPet = vi.hoisted(() => vi.fn());

vi.mock("@/lib/server/sponsorshipLedger", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/server/sponsorshipLedger")>();
  return { ...actual, listActiveSponsorshipsForPet };
});

import {
  diffNewGalleryImages,
  dispatchPetPhotoUpdate,
  isEligibleForPhotoUpdates,
} from "@/lib/domain/photoUpdateDispatch";
import { setNotificationPreference } from "@/lib/server/notificationPreferences";
import { absolutizeAssetUrl } from "@/lib/email";
import type { SponsorshipRecord } from "@/lib/server/sponsorshipLedger";
import { senFromInteger } from "@/lib/domain/money";

function sponsorship(overrides: Partial<SponsorshipRecord> = {}): SponsorshipRecord {
  return {
    id: `spon-${Math.random().toString(36).slice(2, 9)}`,
    petId: "pet-001",
    petName: "Barnaby",
    sponsorName: "Tan Ah Kow",
    sponsorEmail: "sponsor@example.com",
    tierId: "spay_neuter",
    tierName: "Spay / Neuter Surgery Sponsorship",
    frequency: "one_time",
    amountSen: senFromInteger(12000),
    paymentMethod: "duitnow_qr",
    status: "ACTIVE",
    pledgeRef: "HFS-PLG-000001",
    receiptNumber: null,
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe("Gallery diffing — what actually counts as a photo update", () => {
  it("returns only images that were not previously on the record", () => {
    expect(
      diffNewGalleryImages(["https://cdn/a.jpg"], ["https://cdn/a.jpg", "https://cdn/b.jpg"])
    ).toEqual(["https://cdn/b.jpg"]);
  });

  it("reports nothing when the gallery is merely reordered", () => {
    expect(
      diffNewGalleryImages(
        ["https://cdn/a.jpg", "https://cdn/b.jpg"],
        ["https://cdn/b.jpg", "https://cdn/a.jpg"]
      )
    ).toEqual([]);
  });

  it("reports nothing when an unrelated field changed and the gallery did not", () => {
    const gallery = ["https://cdn/a.jpg"];
    expect(diffNewGalleryImages(gallery, gallery)).toEqual([]);
  });

  it("reports nothing when photos are removed", () => {
    expect(
      diffNewGalleryImages(["https://cdn/a.jpg", "https://cdn/b.jpg"], ["https://cdn/a.jpg"])
    ).toEqual([]);
  });

  it("treats an empty starting gallery as all-new", () => {
    expect(diffNewGalleryImages(null, ["https://cdn/a.jpg"])).toEqual(["https://cdn/a.jpg"]);
  });

  it("de-duplicates repeated URLs within one save and drops empties", () => {
    expect(diffNewGalleryImages([], ["https://cdn/a.jpg", "https://cdn/a.jpg", ""])).toEqual([
      "https://cdn/a.jpg",
    ]);
  });
});

describe("Supporter eligibility", () => {
  it("requires a reconciled commitment — a pledge awaiting payment is not a supporter", () => {
    expect(isEligibleForPhotoUpdates(sponsorship({ status: "PENDING_PAYMENT" }))).toBe(false);
    expect(isEligibleForPhotoUpdates(sponsorship({ status: "CANCELLED" }))).toBe(false);
    expect(isEligibleForPhotoUpdates(sponsorship({ status: "ACTIVE" }))).toBe(true);
  });

  it("counts the two highest one-time tiers as qualifying", () => {
    expect(isEligibleForPhotoUpdates(sponsorship({ tierId: "spay_neuter" }))).toBe(true);
    expect(isEligibleForPhotoUpdates(sponsorship({ tierId: "emergency_medical" }))).toBe(true);
  });

  it("excludes the entry-level one-time tiers", () => {
    expect(isEligibleForPhotoUpdates(sponsorship({ tierId: "kibble" }))).toBe(false);
    expect(isEligibleForPhotoUpdates(sponsorship({ tierId: "vaccine" }))).toBe(false);
  });

  it("qualifies any recurring monthly supporter regardless of tier", () => {
    expect(
      isEligibleForPhotoUpdates(sponsorship({ tierId: "kibble", frequency: "monthly" }))
    ).toBe(true);
  });
});

describe("Photo update dispatch", () => {
  beforeEach(() => {
    listActiveSponsorshipsForPet.mockReset();
    listActiveSponsorshipsForPet.mockResolvedValue([]);
  });

  it("mails every eligible, consenting supporter of the pet", async () => {
    listActiveSponsorshipsForPet.mockResolvedValue([
      sponsorship({ sponsorEmail: "one@example.com" }),
      sponsorship({ sponsorEmail: "two@example.com", tierId: "emergency_medical" }),
    ]);

    const result = await dispatchPetPhotoUpdate({
      petId: "pet-happy",
      petName: "Barnaby",
      newImageUrls: ["https://cdn/new.jpg"],
      caption: "First day off the drip!",
      notifySponsors: true,
    });

    expect(result.dispatched).toBe(2);
    expect(result.failed).toBe(0);
    expect(result.recipients.sort()).toEqual(["one@example.com", "two@example.com"]);
  });

  it("skips supporters who unsubscribed from photo updates", async () => {
    listActiveSponsorshipsForPet.mockResolvedValue([
      sponsorship({ sponsorEmail: "keen@example.com" }),
      sponsorship({ sponsorEmail: "nomail@example.com" }),
    ]);
    await setNotificationPreference("nomail@example.com", { photoUpdates: false });

    const result = await dispatchPetPhotoUpdate({
      petId: "pet-optout",
      petName: "Barnaby",
      newImageUrls: ["https://cdn/new.jpg"],
      notifySponsors: true,
    });

    expect(result.recipients).toEqual(["keen@example.com"]);
    expect(result.skippedOptedOut).toBe(1);
  });

  it("emails one address once even when it sponsors the same animal twice", async () => {
    listActiveSponsorshipsForPet.mockResolvedValue([
      sponsorship({ sponsorEmail: "repeat@example.com" }),
      sponsorship({ sponsorEmail: "repeat@example.com", tierId: "emergency_medical" }),
    ]);

    const result = await dispatchPetPhotoUpdate({
      petId: "pet-dupe",
      petName: "Barnaby",
      newImageUrls: ["https://cdn/new.jpg"],
      notifySponsors: true,
    });

    expect(result.dispatched).toBe(1);
  });

  it("counts, but does not mail, supporters below the qualifying tier", async () => {
    listActiveSponsorshipsForPet.mockResolvedValue([
      sponsorship({ sponsorEmail: "gold@example.com" }),
      sponsorship({ sponsorEmail: "kibble@example.com", tierId: "kibble" }),
    ]);

    const result = await dispatchPetPhotoUpdate({
      petId: "pet-mixed",
      petName: "Barnaby",
      newImageUrls: ["https://cdn/new.jpg"],
      notifySponsors: true,
    });

    expect(result.recipients).toEqual(["gold@example.com"]);
    expect(result.skippedIneligible).toBe(1);
  });

  it("sends nothing when the admin clears the notify checkbox", async () => {
    listActiveSponsorshipsForPet.mockResolvedValue([sponsorship()]);

    const result = await dispatchPetPhotoUpdate({
      petId: "pet-quiet",
      petName: "Barnaby",
      newImageUrls: ["https://cdn/new.jpg"],
      notifySponsors: false,
    });

    expect(result.skippedReason).toBe("notification_disabled_by_admin");
  });

  it("sends nothing when the save added no new photos", async () => {
    const result = await dispatchPetPhotoUpdate({
      petId: "pet-nonew",
      petName: "Barnaby",
      newImageUrls: [],
      notifySponsors: true,
    });

    expect(result.skippedReason).toBe("no_new_images");
  });

  it("sends nothing for an archived animal", async () => {
    const result = await dispatchPetPhotoUpdate({
      petId: "pet-archived",
      petName: "Barnaby",
      newImageUrls: ["https://cdn/new.jpg"],
      notifySponsors: true,
      petIsArchived: true,
    });

    expect(result.skippedReason).toBe("pet_archived");
  });

  it("reports cleanly when a pet has no qualifying supporters", async () => {
    const result = await dispatchPetPhotoUpdate({
      petId: "pet-nosponsors",
      petName: "Barnaby",
      newImageUrls: ["https://cdn/new.jpg"],
      notifySponsors: true,
    });

    expect(result.skippedReason).toBe("no_eligible_sponsors");
  });

  it("distinguishes everyone-opted-out from nobody-qualifies", async () => {
    listActiveSponsorshipsForPet.mockResolvedValue([
      sponsorship({ sponsorEmail: "no1@example.com" }),
      sponsorship({ sponsorEmail: "no2@example.com" }),
    ]);
    await setNotificationPreference("no1@example.com", { photoUpdates: false });
    await setNotificationPreference("no2@example.com", { photoUpdates: false });

    const result = await dispatchPetPhotoUpdate({
      petId: "pet-allout",
      petName: "Barnaby",
      newImageUrls: ["https://cdn/new.jpg"],
      notifySponsors: true,
    });

    expect(result.skippedReason).toBe("all_sponsors_opted_out");
    expect(result.skippedOptedOut).toBe(2);
  });

  it("sends nothing when none of the new images can be rendered", async () => {
    listActiveSponsorshipsForPet.mockResolvedValue([sponsorship({ sponsorEmail: "k@example.com" })]);

    const result = await dispatchPetPhotoUpdate({
      petId: "pet-badimg",
      petName: "Barnaby",
      // absolutizeAssetUrl drops non-http(s) schemes, so nothing would render.
      newImageUrls: ["javascript:alert(1)", "data:image/svg+xml;base64,AAAA"],
      notifySponsors: true,
    });

    // Announcing a new photo with no photo in it is worse than staying quiet.
    expect(result.skippedReason).toBe("no_renderable_images");
  });

  it("does not re-mail the list when the identical save is repeated", async () => {
    listActiveSponsorshipsForPet.mockResolvedValue([
      sponsorship({ sponsorEmail: "once@example.com" }),
    ]);

    const input = {
      petId: "pet-idem",
      petName: "Barnaby",
      newImageUrls: ["https://cdn/same.jpg"],
      notifySponsors: true,
    };

    const first = await dispatchPetPhotoUpdate(input);
    const second = await dispatchPetPhotoUpdate(input);

    expect(first.dispatched).toBe(1);
    // Identity, not deep equality: a genuine second dispatch would be
    // structurally identical and satisfy toEqual either way.
    expect(second).toBe(first);
  });

  // Raised past the 5s default rather than shrunk below the cap. This test is
  // meant to drive a *full* recipient list through the real fan-out — 250 sends
  // five at a time, each minting two HMAC tokens and building the message — and
  // under the whole suite in parallel that legitimately crosses five seconds.
  // Trimming the list to fit would mean no longer testing the cap.
  it("caps a runaway supporter list rather than sending without bound", async () => {
    listActiveSponsorshipsForPet.mockResolvedValue(
      Array.from({ length: 260 }, (_, i) => sponsorship({ sponsorEmail: `s${i}@example.com` }))
    );

    const result = await dispatchPetPhotoUpdate({
      petId: "pet-huge",
      petName: "Barnaby",
      newImageUrls: ["https://cdn/new.jpg"],
      notifySponsors: true,
    });

    expect(result.truncated).toBe(true);
    expect(result.dispatched).toBe(250);
  }, 20_000);
});

describe("Absolute asset URLs", () => {
  it("leaves already-absolute URLs untouched", () => {
    expect(absolutizeAssetUrl("https://cdn.example.com/a.jpg")).toBe(
      "https://cdn.example.com/a.jpg"
    );
  });

  it("resolves a site-relative upload path against the public origin", () => {
    const resolved = absolutizeAssetUrl("/uploads/a.jpg");
    expect(resolved).toMatch(/^https?:\/\//);
    expect(resolved.endsWith("/uploads/a.jpg")).toBe(true);
  });

  it("drops non-http(s) schemes instead of rendering them into an img src", () => {
    // Zod's url() accepts these, so passing validation is not proof of safety.
    expect(absolutizeAssetUrl("javascript:alert(1)")).toBe("");
    expect(absolutizeAssetUrl("data:image/svg+xml;base64,AAAA")).toBe("");
  });

  it("returns an empty string for empty input rather than a bare origin", () => {
    expect(absolutizeAssetUrl("")).toBe("");
  });
});
