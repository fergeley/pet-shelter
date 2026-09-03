import { describe, it, expect } from "vitest";
import {
  availableQrChannels,
  channelQrUrl,
  mergeQrSources,
  resolveDonationQr,
  QR_CHANNEL_PRESENTATION,
  type ShelterQrConfigLike,
} from "@/lib/domain/qrCode";

/**
 * `tngQrUrl` and `bankQrUrl` were persisted, validated and uploadable for a
 * whole release without any public surface rendering them — an admin could
 * upload a Touch 'n Go code and reasonably believe donors could pay with it.
 * These cover the channel selection that closes that gap.
 */

const base: ShelterQrConfigLike = {
  duitNowQrUrl: "",
  tngQrUrl: "",
  bankQrUrl: "",
  paymentPayload: "",
  shelterName: "Hope for Strays",
};

describe("availableQrChannels", () => {
  it("always offers DuitNow, which owns the generated and placeholder fallbacks", () => {
    expect(availableQrChannels(base)).toEqual(["duitnow"]);
  });

  it("offers only DuitNow when nothing else is uploaded, so no switcher renders", () => {
    // The regression this guards: a shelter that configures DuitNow alone must
    // look exactly as it did before channels existed.
    const config = { ...base, duitNowQrUrl: "/uploads/duitnow.png" };
    expect(availableQrChannels(config)).toEqual(["duitnow"]);
  });

  it("adds a channel once its image is uploaded", () => {
    const config = { ...base, tngQrUrl: "/uploads/tng.png" };
    expect(availableQrChannels(config)).toEqual(["duitnow", "tng"]);
  });

  it("orders channels by payment rail, not by config key", () => {
    const config = {
      ...base,
      bankQrUrl: "/uploads/bank.png",
      tngQrUrl: "/uploads/tng.png",
    };
    expect(availableQrChannels(config)).toEqual(["duitnow", "tng", "bank"]);
  });

  it("ignores an unsafe URL rather than offering a broken tab", () => {
    const config = { ...base, tngQrUrl: "javascript:alert(1)" };
    expect(availableQrChannels(config)).toEqual(["duitnow"]);
  });

  it("ignores whitespace-only values", () => {
    expect(availableQrChannels({ ...base, bankQrUrl: "   " })).toEqual(["duitnow"]);
  });
});

describe("channelQrUrl", () => {
  it("maps each channel to its own column", () => {
    const config = {
      ...base,
      duitNowQrUrl: "/uploads/d.png",
      tngQrUrl: "/uploads/t.png",
      bankQrUrl: "/uploads/b.png",
    };
    expect(channelQrUrl(config, "duitnow")).toBe("/uploads/d.png");
    expect(channelQrUrl(config, "tng")).toBe("/uploads/t.png");
    expect(channelQrUrl(config, "bank")).toBe("/uploads/b.png");
  });
});

describe("mergeQrSources per channel", () => {
  const config: ShelterQrConfigLike = {
    ...base,
    duitNowQrUrl: "/uploads/duitnow.png",
    tngQrUrl: "/uploads/tng.png",
    paymentPayload: "00020101021126",
  };

  it("selects the requested channel's image", () => {
    expect(mergeQrSources({}, config, "tng").shelterQrUrl).toBe("/uploads/tng.png");
  });

  it("defaults to DuitNow", () => {
    expect(mergeQrSources({}, config).shelterQrUrl).toBe("/uploads/duitnow.png");
  });

  it("does not lend the DuitNow payment payload to another rail", () => {
    // The payload is a DuitNow EMVCo string. Generating a code from it under a
    // Touch 'n Go tab would show the wrong rail's QR.
    expect(mergeQrSources({}, config, "tng").paymentPayload).toBe("");
    expect(mergeQrSources({}, config, "duitnow").paymentPayload).toBe("00020101021126");
  });

  it("still lets an explicit prop win over the channel lookup", () => {
    const merged = mergeQrSources({ shelterQrUrl: "/uploads/pending.png" }, config, "tng");
    expect(merged.shelterQrUrl).toBe("/uploads/pending.png");
  });

  it("resolves a non-DuitNow channel to its uploaded image", () => {
    const resolved = resolveDonationQr(mergeQrSources({}, config, "tng"));
    expect(resolved.kind).toBe("shelter-image");
    if (resolved.kind === "shelter-image") {
      expect(resolved.imageUrl).toBe("/uploads/tng.png");
    }
  });
});

describe("channel presentation", () => {
  it("gives every channel a label, subtitle, accent and instructions", () => {
    for (const channel of ["duitnow", "tng", "bank"] as const) {
      const p = QR_CHANNEL_PRESENTATION[channel];
      expect(p.label.length).toBeGreaterThan(0);
      expect(p.subtitle.length).toBeGreaterThan(0);
      expect(p.instructions.length).toBeGreaterThan(0);
      // Applied inline as a CSS custom-property reference, so globals.css stays
      // the single source of truth for the colour itself.
      expect(p.accent).toMatch(/^var\(--brand-[a-z-]+\)$/);
    }
  });

  it("keeps the DuitNow branding byte-identical to what shipped before", () => {
    // The literal #ed008c now lives once, in globals.css as --brand-duitnow.
    expect(QR_CHANNEL_PRESENTATION.duitnow.accent).toBe("var(--brand-duitnow)");
    expect(QR_CHANNEL_PRESENTATION.duitnow.label).toBe("DuitNow QR");
    expect(QR_CHANNEL_PRESENTATION.duitnow.subtitle).toBe(
      "National QR Standard (PayNet Malaysia)"
    );
  });

  it("gives each channel a distinct accent so the tabs are distinguishable", () => {
    const accents = (["duitnow", "tng", "bank"] as const).map(
      (c) => QR_CHANNEL_PRESENTATION[c].accent
    );
    expect(new Set(accents).size).toBe(3);
  });
});
