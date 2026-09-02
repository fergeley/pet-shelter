import { describe, it, expect } from "vitest";
import {
  deriveTier,
  recognisedContributionSen,
  tierForAmount,
  meetsTier,
  rankOf,
  perksForTier,
  hasPerk,
  tierRequiredForPerk,
  nextTierAbove,
  amountToNextTier,
  tierLabel,
  TIER_THRESHOLDS_SEN,
  RECOGNITION_WINDOW_DAYS,
  PERKS,
} from "@/lib/domain/supporterTier";
import { SponsoredDonation } from "@/types/supporter";
import { senFromRinggit } from "@/lib/domain/money";

const NOW = new Date("2026-09-02T00:00:00.000Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function daysBefore(days: number): string {
  return new Date(NOW.getTime() - days * DAY_MS).toISOString();
}

/**
 * Amounts are given in ringgit for readability and converted at the boundary, the same
 * way the donation action does — so a test can never assert against a figure the
 * production path would not have produced.
 */
function contribution(
  overrides: Partial<SponsoredDonation> & { ringgit?: number } = {}
): SponsoredDonation {
  const { ringgit, ...rest } = overrides;
  return {
    receiptNumber: "HFS-DON-202609-1000",
    sponsorId: "spn-test",
    donorEmail: "donor@example.com",
    donorName: "Test Donor",
    tierId: "vaccine",
    tierName: "Core Vaccination & Deworming",
    amountSen: senFromRinggit(ringgit ?? 50),
    frequency: "one_time",
    isActive: true,
    status: "CONFIRMED",
    displayOnWall: false,
    targetPetId: null,
    targetPetName: null,
    issuedAt: daysBefore(10),
    ...rest,
  };
}

describe("Supporter tier derivation", () => {
  describe("recognisedContributionSen", () => {
    it("sums one-time pledges made inside the recognition window", () => {
      const total = recognisedContributionSen(
        [
          contribution({ ringgit: 50, issuedAt: daysBefore(10) }),
          contribution({ ringgit: 120, issuedAt: daysBefore(200) }),
        ],
        NOW
      );

      expect(total).toBe(senFromRinggit(170));
    });

    it("excludes one-time pledges that have aged out of the window", () => {
      const total = recognisedContributionSen(
        [
          contribution({ ringgit: 50, issuedAt: daysBefore(10) }),
          contribution({
            ringgit: 5000,
            issuedAt: daysBefore(RECOGNITION_WINDOW_DAYS + 1),
          }),
        ],
        NOW
      );

      expect(total).toBe(senFromRinggit(50));
    });

    it("counts a pledge on the last day of the window", () => {
      const total = recognisedContributionSen(
        [
          contribution({
            ringgit: 90,
            issuedAt: daysBefore(RECOGNITION_WINDOW_DAYS - 1),
          }),
        ],
        NOW
      );

      expect(total).toBe(senFromRinggit(90));
    });

    it("annualises an active monthly pledge, so recurring giving counts immediately", () => {
      const total = recognisedContributionSen(
        [contribution({ ringgit: 25, frequency: "monthly", issuedAt: daysBefore(5) })],
        NOW
      );

      expect(total).toBe(senFromRinggit(300));
    });

    it("ignores a cancelled monthly pledge entirely, whatever its age", () => {
      const total = recognisedContributionSen(
        [
          contribution({
            ringgit: 500,
            frequency: "monthly",
            isActive: false,
            issuedAt: daysBefore(5),
          }),
        ],
        NOW
      );

      expect(total).toBe(0);
    });

    it("counts an active monthly pledge even once it predates the window", () => {
      // A two-year-old standing order is a stronger relationship than a recent one-off,
      // so ageing it out would punish exactly the donors this programme retains.
      const total = recognisedContributionSen(
        [
          contribution({
            ringgit: 30,
            frequency: "monthly",
            issuedAt: daysBefore(700),
          }),
        ],
        NOW
      );

      expect(total).toBe(senFromRinggit(360));
    });

    it("returns zero for an empty ledger", () => {
      expect(recognisedContributionSen([], NOW)).toBe(0);
    });
  });

  describe("tierForAmount thresholds", () => {
    it("awards no standing below the Bronze threshold", () => {
      expect(tierForAmount(TIER_THRESHOLDS_SEN.BRONZE - 1)).toBeNull();
      expect(tierForAmount(0)).toBeNull();
    });

    it("awards each standing exactly at its threshold", () => {
      expect(tierForAmount(TIER_THRESHOLDS_SEN.BRONZE)).toBe("BRONZE");
      expect(tierForAmount(TIER_THRESHOLDS_SEN.SILVER)).toBe("SILVER");
      expect(tierForAmount(TIER_THRESHOLDS_SEN.GOLD)).toBe("GOLD");
    });

    it("holds the lower standing one ringgit below each boundary", () => {
      expect(tierForAmount(TIER_THRESHOLDS_SEN.SILVER - 1)).toBe("BRONZE");
      expect(tierForAmount(TIER_THRESHOLDS_SEN.GOLD - 1)).toBe("SILVER");
    });

    it("stays Gold above the top threshold", () => {
      expect(tierForAmount(TIER_THRESHOLDS_SEN.GOLD * 10)).toBe("GOLD");
    });
  });

  describe("deriveTier", () => {
    it("lands a single RM 50 vaccine pledge on Bronze", () => {
      expect(deriveTier([contribution({ ringgit: 50 })], NOW)).toBe("BRONZE");
    });

    it("lands RM 250 emergency plus RM 120 spay/neuter on Silver", () => {
      const tier = deriveTier(
        [
          contribution({ ringgit: 250, issuedAt: daysBefore(120) }),
          contribution({ ringgit: 120, issuedAt: daysBefore(30) }),
        ],
        NOW
      );

      expect(tier).toBe("SILVER");
    });

    it("lands an RM 100 monthly pledge on Gold", () => {
      expect(
        deriveTier([contribution({ ringgit: 100, frequency: "monthly" })], NOW)
      ).toBe("GOLD");
    });

    it("drops a sponsor out of Gold when their monthly pledge is cancelled", () => {
      const ledger = [
        contribution({ ringgit: 100, frequency: "monthly" }),
        contribution({ ringgit: 50, issuedAt: daysBefore(20) }),
      ];

      expect(deriveTier(ledger, NOW)).toBe("GOLD");

      ledger[0] = { ...ledger[0], isActive: false };
      expect(deriveTier(ledger, NOW)).toBe("BRONZE");
    });

    it("drops a sponsor to no standing once their only pledge ages out", () => {
      const aged = [
        contribution({
          ringgit: 250,
          issuedAt: daysBefore(RECOGNITION_WINDOW_DAYS + 30),
        }),
      ];

      expect(deriveTier(aged, NOW)).toBeNull();
    });
  });

  describe("meetsTier and rankOf", () => {
    it("ranks a missing standing below Bronze", () => {
      expect(rankOf(null)).toBe(0);
      expect(rankOf("BRONZE")).toBeGreaterThan(rankOf(null));
    });

    it("satisfies a requirement at or above the required standing", () => {
      expect(meetsTier("GOLD", "SILVER")).toBe(true);
      expect(meetsTier("SILVER", "SILVER")).toBe(true);
      expect(meetsTier("GOLD", "BRONZE")).toBe(true);
    });

    it("refuses a requirement above the held standing", () => {
      expect(meetsTier("BRONZE", "SILVER")).toBe(false);
      expect(meetsTier("SILVER", "GOLD")).toBe(false);
      expect(meetsTier(null, "BRONZE")).toBe(false);
    });
  });

  describe("perks", () => {
    it("gives Bronze the wall listing and newsletter only", () => {
      expect(perksForTier("BRONZE").map((p) => p.id)).toEqual([
        "sponsor_wall",
        "quarterly_newsletter",
      ]);
    });

    it("makes Silver a superset of Bronze", () => {
      const bronze = perksForTier("BRONZE").map((p) => p.id);
      const silver = perksForTier("SILVER").map((p) => p.id);

      expect(silver).toEqual(expect.arrayContaining(bronze));
      expect(silver).toContain("photo_gallery_updates");
      expect(silver).toContain("e_certificate");
    });

    it("makes Gold a superset of Silver, and the full matrix", () => {
      const silver = perksForTier("SILVER").map((p) => p.id);
      const gold = perksForTier("GOLD").map((p) => p.id);

      expect(gold).toEqual(expect.arrayContaining(silver));
      expect(gold).toHaveLength(PERKS.length);
      expect(gold).toContain("video_diary");
      expect(gold).toContain("open_day_invite");
      expect(gold).toContain("caretaker_qa");
    });

    it("gives a sponsor with no standing no perks at all", () => {
      expect(perksForTier(null)).toEqual([]);
    });

    it("keeps the Gold-only perks locked at Silver", () => {
      expect(hasPerk("SILVER", "video_diary")).toBe(false);
      expect(hasPerk("SILVER", "caretaker_qa")).toBe(false);
      expect(hasPerk("GOLD", "video_diary")).toBe(true);
    });

    it("reports the standing a perk requires", () => {
      expect(tierRequiredForPerk("e_certificate")).toBe("SILVER");
      expect(tierRequiredForPerk("video_diary")).toBe("GOLD");
      expect(tierRequiredForPerk("sponsor_wall")).toBe("BRONZE");
    });
  });

  describe("progress to the next standing", () => {
    it("names the next standing up the ladder", () => {
      expect(nextTierAbove(null)).toBe("BRONZE");
      expect(nextTierAbove("BRONZE")).toBe("SILVER");
      expect(nextTierAbove("SILVER")).toBe("GOLD");
      expect(nextTierAbove("GOLD")).toBeNull();
    });

    it("reports the shortfall to the next standing", () => {
      expect(amountToNextTier(0)).toBe(TIER_THRESHOLDS_SEN.BRONZE);
      expect(amountToNextTier(senFromRinggit(50))).toBe(
        TIER_THRESHOLDS_SEN.SILVER - senFromRinggit(50)
      );
      expect(amountToNextTier(senFromRinggit(370))).toBe(
        TIER_THRESHOLDS_SEN.GOLD - senFromRinggit(370)
      );
    });

    it("reports no shortfall at Gold", () => {
      expect(amountToNextTier(TIER_THRESHOLDS_SEN.GOLD)).toBeNull();
    });
  });

  describe("unconfirmed pledges", () => {
    it("confer no standing, however large", () => {
      // /donate is public and unauthenticated, so a submitted pledge is an assertion.
      // Counting it would make the donation form a self-service Gold button.
      const asserted = [
        contribution({ ringgit: 5000, status: "PENDING" }),
        contribution({ ringgit: 1000, frequency: "monthly", status: "PENDING" }),
      ];

      expect(recognisedContributionSen(asserted, NOW)).toBe(0);
      expect(deriveTier(asserted, NOW)).toBeNull();
    });

    it("do not drag down a standing earned by confirmed ones", () => {
      const mixed = [
        contribution({ ringgit: 300, status: "CONFIRMED" }),
        contribution({ ringgit: 9000, status: "PENDING" }),
      ];

      expect(recognisedContributionSen(mixed, NOW)).toBe(senFromRinggit(300));
      expect(deriveTier(mixed, NOW)).toBe("SILVER");
    });
  });

  describe("a lapsed recurring sponsor", () => {
    it("is not described as a one-time donor", () => {
      // A cancelled standing order used to fall through to "one_time", which reads as
      // "One-time pledges" on the dashboard and misdescribes the relationship.
      const lapsed = [
        contribution({ ringgit: 100, frequency: "monthly", isActive: false }),
      ];

      expect(deriveTier(lapsed, NOW)).toBeNull();
      expect(recognisedContributionSen(lapsed, NOW)).toBe(0);
    });
  });

  describe("tierLabel", () => {
    it("labels each standing in English and Malay", () => {
      expect(tierLabel("GOLD")).toBe("Gold");
      expect(tierLabel("GOLD", true)).toBe("Emas");
      expect(tierLabel("SILVER", true)).toBe("Perak");
      expect(tierLabel("BRONZE", true)).toBe("Gangsa");
    });

    it("labels a sponsor with no standing as a plain supporter", () => {
      expect(tierLabel(null)).toBe("Supporter");
      expect(tierLabel(null, true)).toBe("Penyokong");
    });
  });
});
