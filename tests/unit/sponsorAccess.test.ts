import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Verification for the tier gates.
 *
 * The brief proposed logging in as three test users and checking that gated media locks
 * and unlocks. Clicking through a browser cannot show the property that actually matters:
 * that an under-tier sponsor's *response* never contains the protected URLs. So these
 * tests sign in as each seeded standing and assert on the serialized payload — if a
 * private URL ever appears in it, the assertion fails whatever the UI happens to render.
 */

const cookieStore = new Map<string, { name: string; value: string }>();

vi.mock("@/lib/prisma", async () => await import("../stubs/unreachablePrisma"));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      if (options?.maxAge === 0) cookieStore.delete(name);
      else cookieStore.set(name, { name, value });
    },
    delete: (name: string) => cookieStore.delete(name),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import {
  sealSponsorSession,
  SPONSOR_SESSION_COOKIE_NAME,
} from "@/lib/security/sponsorSession";
import {
  getGatedPetGallery,
  getGatedPetVideoDiary,
  getSponsorDashboard,
  getSponsorCertificate,
  getSponsorWall,
  getCurrentSupporterTier,
} from "@/lib/domain/sponsorAccess";
import { __resetSponsorStoreForTests } from "@/lib/sponsorStore";
import exclusiveMedia from "@/data/exclusiveMedia.json";

/** A pet with both a high-res album and a video diary in the private catalogue. */
const GATED_PET_ID = "pet-003";

const catalogue = exclusiveMedia as Record<
  string,
  { highResGallery: Array<{ url: string }>; videoDiary: Array<{ youtubeId: string; watchUrl: string }> }
>;

/** The exact strings that must never reach an under-tier sponsor. */
const SECRET_VIDEO_IDS = catalogue[GATED_PET_ID].videoDiary.map((v) => v.youtubeId);
const SECRET_GALLERY_URLS = catalogue[GATED_PET_ID].highResGallery.map((g) => g.url);

const SPONSORS = {
  bronze: { sponsorId: "spn-bronze-01", email: "bronze@example.com", name: "Nurul Aisyah" },
  silver: { sponsorId: "spn-silver-01", email: "silver@example.com", name: "Jason Lim" },
  gold: {
    sponsorId: "spn-gold-01",
    email: "gold@example.com",
    name: "Datin Sofia Rahman",
  },
};

function signInAs(sponsor: { sponsorId: string; email: string; name: string }) {
  cookieStore.set(SPONSOR_SESSION_COOKIE_NAME, {
    name: SPONSOR_SESSION_COOKIE_NAME,
    value: sealSponsorSession(sponsor),
  });
}

function signOut() {
  cookieStore.clear();
}

describe("Tier gates on exclusive pet media", () => {
  beforeEach(async () => {
    signOut();
    await __resetSponsorStoreForTests();
  });

  it("places the seeded sponsors on Bronze, Silver and Gold", async () => {
    signInAs(SPONSORS.bronze);
    expect(await getCurrentSupporterTier()).toBe("BRONZE");

    signInAs(SPONSORS.silver);
    expect(await getCurrentSupporterTier()).toBe("SILVER");

    signInAs(SPONSORS.gold);
    expect(await getCurrentSupporterTier()).toBe("GOLD");
  });

  it("reports no standing for a signed-out visitor", async () => {
    expect(await getCurrentSupporterTier()).toBeNull();
  });

  describe("video diary (Gold)", () => {
    it("locks the diary for a signed-out visitor and withholds every URL", async () => {
      const payload = await getGatedPetVideoDiary(GATED_PET_ID);

      expect(payload.locked).toBe(true);
      expect(payload).not.toHaveProperty("items");

      const serialized = JSON.stringify(payload);
      for (const id of SECRET_VIDEO_IDS) {
        expect(serialized).not.toContain(id);
      }
    });

    it("locks the diary for Bronze and Silver", async () => {
      for (const sponsor of [SPONSORS.bronze, SPONSORS.silver]) {
        signInAs(sponsor);
        const payload = await getGatedPetVideoDiary(GATED_PET_ID);

        expect(payload.locked).toBe(true);
        expect(payload).not.toHaveProperty("items");
        expect(JSON.stringify(payload)).not.toContain(SECRET_VIDEO_IDS[0]);
      }
    });

    it("reports how many updates are withheld, without naming them", async () => {
      signInAs(SPONSORS.silver);
      const payload = await getGatedPetVideoDiary(GATED_PET_ID);

      expect(payload.locked).toBe(true);
      if (payload.locked) {
        expect(payload.lockedCount).toBe(SECRET_VIDEO_IDS.length);
        expect(payload.requiredTier).toBe("GOLD");
        expect(payload.currentTier).toBe("SILVER");
      }
    });

    it("unlocks the diary for Gold and returns every episode", async () => {
      signInAs(SPONSORS.gold);
      const payload = await getGatedPetVideoDiary(GATED_PET_ID);

      expect(payload.locked).toBe(false);
      if (!payload.locked) {
        expect(payload.items).toHaveLength(SECRET_VIDEO_IDS.length);
        expect(payload.items.map((item) => item.youtubeId)).toEqual(SECRET_VIDEO_IDS);
      }
    });
  });

  describe("high-resolution album (Silver)", () => {
    it("locks the album for a signed-out visitor and withholds every URL", async () => {
      const payload = await getGatedPetGallery(GATED_PET_ID);

      expect(payload.locked).toBe(true);
      const serialized = JSON.stringify(payload);
      for (const url of SECRET_GALLERY_URLS) {
        expect(serialized).not.toContain(url);
      }
      expect(serialized).not.toContain("w=2400");
    });

    it("locks the album for Bronze", async () => {
      signInAs(SPONSORS.bronze);
      const payload = await getGatedPetGallery(GATED_PET_ID);

      expect(payload.locked).toBe(true);
      expect(payload).not.toHaveProperty("items");
      expect(JSON.stringify(payload)).not.toContain("w=2400");
    });

    it("unlocks the album for Silver and for Gold", async () => {
      for (const sponsor of [SPONSORS.silver, SPONSORS.gold]) {
        signInAs(sponsor);
        const payload = await getGatedPetGallery(GATED_PET_ID);

        expect(payload.locked).toBe(false);
        if (!payload.locked) {
          expect(payload.items.map((item) => item.url)).toEqual(SECRET_GALLERY_URLS);
        }
      }
    });
  });

  it("ignores a tampered session cookie rather than trusting it", async () => {
    cookieStore.set(SPONSOR_SESSION_COOKIE_NAME, {
      name: SPONSOR_SESSION_COOKIE_NAME,
      value: `${Buffer.from(
        JSON.stringify({
          sponsorId: "spn-gold-01",
          email: "attacker@example.com",
          name: "Attacker",
          expiresAt: Date.now() + 100000,
        }),
        "utf8"
      ).toString("base64url")}.not-a-real-signature`,
    });

    expect(await getCurrentSupporterTier()).toBeNull();

    const payload = await getGatedPetVideoDiary(GATED_PET_ID);
    expect(payload.locked).toBe(true);
  });
});

describe("Sponsor dashboard projection", () => {
  beforeEach(async () => {
    signOut();
    await __resetSponsorStoreForTests();
  });

  it("returns nothing for a signed-out visitor", async () => {
    expect(await getSponsorDashboard()).toBeNull();
  });

  it("lists the sponsored rescues with live status and rehabilitation badges", async () => {
    signInAs(SPONSORS.gold);
    const dashboard = await getSponsorDashboard();

    expect(dashboard).not.toBeNull();
    expect(dashboard!.tier).toBe("GOLD");
    expect(dashboard!.rescues.length).toBeGreaterThan(0);

    const luna = dashboard!.rescues.find((rescue) => rescue.petId === "pet-003");
    expect(luna).toBeDefined();
    expect(luna!.name).toBe("Luna");
    expect(luna!.status).toBeTruthy();
    expect(luna!.rehabStage).toBeTruthy();
    expect(luna!.medicalBadges.length).toBeGreaterThan(0);
  });

  it("reports a monthly pledge as recurring billing", async () => {
    signInAs(SPONSORS.gold);
    const dashboard = await getSponsorDashboard();

    expect(dashboard!.hasActiveRecurring).toBe(true);
    expect(dashboard!.billingFrequency).toBe("mixed");
  });

  it("reports one-time-only giving as non-recurring", async () => {
    signInAs(SPONSORS.silver);
    const dashboard = await getSponsorDashboard();

    expect(dashboard!.hasActiveRecurring).toBe(false);
    expect(dashboard!.billingFrequency).toBe("one_time");
  });

  it("marks the perk checklist against the derived standing", async () => {
    signInAs(SPONSORS.bronze);
    const dashboard = await getSponsorDashboard();

    const unlocked = dashboard!.perks.filter((perk) => perk.unlocked).map((p) => p.id);
    const locked = dashboard!.perks.filter((perk) => !perk.unlocked).map((p) => p.id);

    expect(unlocked).toEqual(["sponsor_wall", "quarterly_newsletter"]);
    expect(locked).toContain("e_certificate");
    expect(locked).toContain("video_diary");
  });

  it("never exposes a password hash or a tax identifier", async () => {
    signInAs(SPONSORS.gold);
    const serialized = JSON.stringify(await getSponsorDashboard());

    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("taxIdOrIc");
  });
});

describe("Sponsorship e-Certificate", () => {
  beforeEach(async () => {
    signOut();
    await __resetSponsorStoreForTests();
  });

  it("is not issued to a signed-out visitor", async () => {
    expect(await getSponsorCertificate()).toBeNull();
  });

  it("is not issued below Silver", async () => {
    signInAs(SPONSORS.bronze);
    expect(await getSponsorCertificate()).toBeNull();
  });

  it("is issued at Silver and at Gold, carrying the derived standing", async () => {
    signInAs(SPONSORS.silver);
    const silver = await getSponsorCertificate();
    expect(silver).not.toBeNull();
    expect(silver!.tier).toBe("SILVER");
    expect(silver!.sponsorName).toBe("Jason Lim");

    signInAs(SPONSORS.gold);
    const gold = await getSponsorCertificate();
    expect(gold!.tier).toBe("GOLD");
    expect(gold!.rescueNames.length).toBeGreaterThan(0);
  });

  it("issues the same certificate number on a reprint", async () => {
    signInAs(SPONSORS.silver);
    const first = await getSponsorCertificate();
    const second = await getSponsorCertificate();

    expect(first!.certificateNumber).toBe(second!.certificateNumber);
    expect(first!.certificateNumber).toMatch(/^HFS-CERT-\d{4}-\d{5}$/);
  });
});

describe("Public sponsor wall", () => {
  beforeEach(async () => {
    signOut();
    await __resetSponsorStoreForTests();
  });

  it("groups opted-in sponsors under their derived standing", async () => {
    const wall = await getSponsorWall();

    expect(wall.BRONZE.map((entry) => entry.name)).toContain("Nurul Aisyah");
    expect(wall.SILVER.map((entry) => entry.name)).toContain("Jason Lim");
    expect(wall.GOLD.map((entry) => entry.name)).toContain("Datin Sofia Rahman");
  });

  it("publishes names and standings only — no amounts, emails or tax numbers", async () => {
    const serialized = JSON.stringify(await getSponsorWall());

    expect(serialized).not.toContain("@example.com");
    expect(serialized).not.toContain("amountMYR");
    expect(serialized).not.toContain("passwordHash");
    expect(serialized).not.toContain("receiptNumber");
  });
});
