import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * The boundary between "the database said no" and "the database did not answer".
 *
 * The in-memory seed exists so the portal is demonstrable with no infrastructure, which is
 * a real and deliberate purpose. These tests pin the two limits on it:
 *
 *  1. A reachable database is authoritative even when its answer is empty. Previously a
 *     `rows.length > 0` guard meant an empty result fell through to the seed — which put
 *     demo names on the public wall and let the published demo passwords sign in.
 *  2. The seed does not exist in production at all, so an outage fails closed.
 */

const cookieStore = new Map<string, { name: string; value: string }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: () => {},
    delete: () => {},
  }),
}));

/** A database that is reachable and simply holds no sponsors yet. */
const emptyDatabase = {
  prisma: {
    sponsor: {
      findUnique: async () => null,
      findMany: async () => [],
      create: async () => {
        throw new Error("not used");
      },
      update: async () => ({}),
    },
    sponsorContribution: {
      findUnique: async () => null,
      findMany: async () => [],
      updateMany: async () => ({ count: 0 }),
      create: async () => {
        throw new Error("not used");
      },
    },
  },
};

/** A database that cannot be reached at all. */
const unreachableDatabase = {
  prisma: new Proxy(
    {},
    {
      get: () =>
        new Proxy(
          {},
          {
            get: () => async () => {
              throw new Error("ECONNREFUSED");
            },
          }
        ),
    }
  ),
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  vi.doUnmock("@/lib/prisma");
});

describe("A reachable database is authoritative, even when empty", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => emptyDatabase);
  });

  it("does not resolve a demo sponsor when the database has no such row", async () => {
    const { findSponsorByEmail } = await import("@/lib/sponsorStore");

    // The published demo password must not sign anyone in against a real database.
    expect(await findSponsorByEmail("gold@example.com")).toBeNull();
  });

  it("does not publish demo names on an empty public wall", async () => {
    const { listWallOptInSponsors } = await import("@/lib/sponsorStore");

    expect(await listWallOptInSponsors()).toEqual([]);
  });

  it("reports a receipt number as unknown rather than matching a seeded one", async () => {
    const { findContributionByReceipt } = await import("@/lib/sponsorStore");

    // The account-claim challenge depends on "no such receipt" being a real answer.
    expect(await findContributionByReceipt("HFS-DON-202607-6600")).toBeNull();
  });

  it("reports an empty ledger rather than a seeded one", async () => {
    const { listContributionsBySponsorId } = await import("@/lib/sponsorStore");

    expect(await listContributionsBySponsorId("spn-gold-01")).toEqual([]);
  });

  it("reports zero linked contributions without mutating the seed", async () => {
    const { linkContributionsToSponsor } = await import("@/lib/sponsorStore");

    expect(await linkContributionsToSponsor("spn-new-01", "unclaimed@example.com")).toBe(0);
  });
});

describe("An unreachable database still falls back to the seed in development", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.doMock("@/lib/prisma", () => unreachableDatabase);
  });

  it("resolves the demo sponsors so the portal stays demonstrable", async () => {
    const { findSponsorByEmail } = await import("@/lib/sponsorStore");

    const sponsor = await findSponsorByEmail("gold@example.com");
    expect(sponsor).not.toBeNull();
    expect(sponsor!.id).toBe("spn-gold-01");
  });

  it("serves the demo wall", async () => {
    const { listWallOptInSponsors } = await import("@/lib/sponsorStore");

    expect((await listWallOptInSponsors()).length).toBeGreaterThan(0);
  });
});

describe("Production has no seed at all", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.doMock("@/lib/prisma", () => unreachableDatabase);
  });

  it("resolves no sponsor even when the database is down", async () => {
    const { findSponsorByEmail } = await import("@/lib/sponsorStore");

    // Fails closed: an outage must not hand out a Gold session.
    expect(await findSponsorByEmail("gold@example.com")).toBeNull();
    expect(await findSponsorByEmail("bronze@example.com")).toBeNull();
  });

  it("serves an empty wall rather than demo names", async () => {
    const { listWallOptInSponsors } = await import("@/lib/sponsorStore");

    expect(await listWallOptInSponsors()).toEqual([]);
  });

  it("exposes no seeded receipt number to the account-claim challenge", async () => {
    const { findContributionByReceipt } = await import("@/lib/sponsorStore");

    expect(await findContributionByReceipt("HFS-DON-202607-6600")).toBeNull();
  });
});
