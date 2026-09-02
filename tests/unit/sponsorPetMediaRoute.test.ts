import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * End-to-end check on the response the browser actually receives.
 *
 * The gate is unit-tested in `sponsorAccess.test.ts`; this asserts the same property one
 * layer out, on the serialized HTTP body, because that is the artefact an under-tier
 * visitor can inspect. A gate that is correct in the data layer but leaks in the handler
 * would pass the former and fail here.
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

import { GET } from "@/app/api/sponsor/pet-media/[petId]/route";
import {
  sealSponsorSession,
  SPONSOR_SESSION_COOKIE_NAME,
} from "@/lib/security/sponsorSession";
import { __resetSponsorStoreForTests } from "@/lib/sponsorStore";
import { PetExclusiveMediaResponse } from "@/types/supporter";
import exclusiveMedia from "@/data/exclusiveMedia.json";

const PET_ID = "pet-003";

const catalogue = exclusiveMedia as Record<
  string,
  {
    highResGallery: Array<{ url: string }>;
    videoDiary: Array<{ youtubeId: string; watchUrl: string }>;
  }
>;

const SECRETS = [
  ...catalogue[PET_ID].videoDiary.map((v) => v.youtubeId),
  ...catalogue[PET_ID].videoDiary.map((v) => v.watchUrl),
  ...catalogue[PET_ID].highResGallery.map((g) => g.url),
];

const SPONSORS = {
  bronze: { sponsorId: "spn-bronze-01", email: "bronze@example.com", name: "Nurul Aisyah" },
  silver: { sponsorId: "spn-silver-01", email: "silver@example.com", name: "Jason Lim" },
  gold: { sponsorId: "spn-gold-01", email: "gold@example.com", name: "Datin Sofia Rahman" },
};

function signInAs(sponsor: { sponsorId: string; email: string; name: string }) {
  cookieStore.set(SPONSOR_SESSION_COOKIE_NAME, {
    name: SPONSOR_SESSION_COOKIE_NAME,
    value: sealSponsorSession(sponsor),
  });
}

async function fetchMedia(petId = PET_ID) {
  const response = await GET(new Request(`http://localhost/api/sponsor/pet-media/${petId}`), {
    params: Promise.resolve({ petId }),
  });
  const raw = await response.text();
  return { response, raw, body: JSON.parse(raw) as PetExclusiveMediaResponse };
}

describe("GET /api/sponsor/pet-media/[petId]", () => {
  beforeEach(async () => {
    cookieStore.clear();
    await __resetSponsorStoreForTests();
  });

  it("marks the response private and uncacheable", async () => {
    const { response } = await fetchMedia();
    expect(response.headers.get("Cache-Control")).toBe("private, no-store");
  });

  it("returns no private URL at all to a signed-out visitor", async () => {
    const { raw, body } = await fetchMedia();

    expect(body.gallery.locked).toBe(true);
    expect(body.videoDiary.locked).toBe(true);
    for (const secret of SECRETS) {
      expect(raw).not.toContain(secret);
    }
  });

  it("returns no private URL at all to a Bronze sponsor", async () => {
    signInAs(SPONSORS.bronze);
    const { raw, body } = await fetchMedia();

    expect(body.gallery.locked).toBe(true);
    expect(body.videoDiary.locked).toBe(true);
    for (const secret of SECRETS) {
      expect(raw).not.toContain(secret);
    }
  });

  it("releases the album but withholds every video from a Silver sponsor", async () => {
    signInAs(SPONSORS.silver);
    const { raw, body } = await fetchMedia();

    expect(body.gallery.locked).toBe(false);
    expect(body.videoDiary.locked).toBe(true);

    for (const url of catalogue[PET_ID].highResGallery.map((g) => g.url)) {
      expect(raw).toContain(url);
    }
    for (const videoId of catalogue[PET_ID].videoDiary.map((v) => v.youtubeId)) {
      expect(raw).not.toContain(videoId);
    }
  });

  it("releases both to a Gold sponsor", async () => {
    signInAs(SPONSORS.gold);
    const { raw, body } = await fetchMedia();

    expect(body.gallery.locked).toBe(false);
    expect(body.videoDiary.locked).toBe(false);
    for (const secret of SECRETS) {
      expect(raw).toContain(secret);
    }
  });

  it("reports empty releases for a pet with no catalogue entry", async () => {
    signInAs(SPONSORS.gold);
    const { body } = await fetchMedia("pet-does-not-exist");

    expect(body.gallery.locked).toBe(false);
    expect(body.videoDiary.locked).toBe(false);
    if (!body.gallery.locked) expect(body.gallery.items).toEqual([]);
    if (!body.videoDiary.locked) expect(body.videoDiary.items).toEqual([]);
  });
});
