import { describe, it, expect, afterEach, vi } from "vitest";

/**
 * Which store is authoritative, and when the demo sponsors exist.
 *
 * The repository follows `donationLedger.ts`: the mode is **declared** by whether
 * `DATABASE_URL` is configured, not discovered by catching an error. That replaced an
 * earlier design where a `rows.length > 0` guard treated an empty result as an outage —
 * which put demo names on the public wall and let the published demo passwords sign in
 * against a real database.
 *
 * Two properties are pinned here because both are load-bearing for security:
 *
 *  1. With a database configured, nothing is seeded and no demo account resolves.
 *  2. In production, nothing is seeded even offline, so an outage fails closed.
 */

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined, set: () => {}, delete: () => {} }),
}));

/** A configured database that holds no sponsors yet. */
const emptyDatabase = {
  prisma: {
    sponsor: { findUnique: async () => null, findMany: async () => [] },
    donation: { findMany: async () => [] },
    donationSponsorship: { findMany: async () => [] },
  },
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock("@/lib/server/prisma");
});

describe("With a database configured, it is authoritative", () => {
  function configureDatabase() {
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "postgresql://localhost:5432/test");
    vi.doMock("@/lib/server/prisma", () => emptyDatabase);
  }

  it("does not resolve a demo sponsor the database has never heard of", async () => {
    configureDatabase();
    const { findSponsorByEmail } = await import("@/lib/server/sponsorRepository");

    // The demo password is published in the guide; it must not sign anyone in here.
    expect(await findSponsorByEmail("gold@example.com")).toBeNull();
  });

  it("does not publish demo names on an empty public wall", async () => {
    configureDatabase();
    const { listWallOptInSponsors } = await import("@/lib/server/sponsorRepository");

    expect(await listWallOptInSponsors()).toEqual([]);
  });

  it("reports an unknown receipt number as unknown", async () => {
    configureDatabase();
    const { findSponsoredDonationByReceipt } = await import(
      "@/lib/server/sponsorRepository"
    );

    // The account-claim challenge depends on "no such receipt" being a real answer.
    expect(await findSponsoredDonationByReceipt("HFS-DON-202607-0001")).toBeNull();
  });
});

describe("Offline, the demo sponsors exist so the portal is demonstrable", () => {
  it("resolves them, with standings derived from real ledger donations", async () => {
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "");
    const { findSponsorByEmail, listSponsoredDonationsBySponsorId } = await import(
      "@/lib/server/sponsorRepository"
    );

    const sponsor = await findSponsorByEmail("gold@example.com");
    expect(sponsor?.id).toBe("spn-gold-01");

    // Seeded through issueDonationReceipt, so the demo exercises the real path.
    const donations = await listSponsoredDonationsBySponsorId("spn-gold-01");
    expect(donations.length).toBeGreaterThan(0);
    expect(donations[0].receiptNumber).toMatch(/^HFS-DON-\d{6}-\d{4,}$/);
  });
});

describe("Production has no seed at all", () => {
  it("resolves no sponsor, even with no database configured", async () => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DATABASE_URL", "");
    // `crypto.ts` resolves the session secret at module load and refuses to boot
    // production on the development fallback, which is the behaviour we want — it just
    // has to be satisfied before this module graph can be imported at all.
    vi.stubEnv("SESSION_SECRET", "a".repeat(48));
    const { findSponsorByEmail, listWallOptInSponsors } = await import(
      "@/lib/server/sponsorRepository"
    );

    // Fails closed: an outage must not hand out a Gold session.
    expect(await findSponsorByEmail("gold@example.com")).toBeNull();
    expect(await listWallOptInSponsors()).toEqual([]);
  });
});
