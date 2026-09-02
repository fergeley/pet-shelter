import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Regressions found while reviewing the QR feature.
 *
 * The settings form is seeded from a localStorage-backed store. Once the QR
 * fields genuinely persisted, two gaps in that arrangement became destructive:
 * a persisted key missing from the local defaults reaches the form as
 * `undefined` and blanks its column on save, and treating the in-memory
 * fallback as authoritative would let a database outage overwrite real
 * settings with defaults.
 */

const findUnique = vi.fn();
const upsert = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shelterSettings: {
      findUnique: (...args: unknown[]) => findUnique(...args),
      upsert: (...args: unknown[]) => upsert(...args),
    },
  },
}));

import {
  DEFAULT_SHELTER_SETTINGS,
  readShelterSettingsWithSource,
  resetShelterSettingsCache,
  writeShelterSettings,
} from "@/lib/domain/shelterSettings";
import {
  NULLABLE_SETTING_COLUMNS,
  PERSISTED_SETTING_KEYS,
  QR_SETTING_KEYS,
  SETTINGS_ROW_ID,
} from "@/lib/domain/shelterSettingsKeys";
import { defaultSettings as localDefaultSettings } from "@/lib/settingsStore";
import { shelterSettingsSchema } from "@/lib/validations/settings";

beforeEach(() => {
  vi.clearAllMocks();
  resetShelterSettingsCache();
});

describe("local settings store shape", () => {
  it("declares every persisted key, so the form cannot submit undefined", () => {
    const local = localDefaultSettings as Record<string, unknown>;
    for (const key of PERSISTED_SETTING_KEYS) {
      expect(Object.prototype.hasOwnProperty.call(local, key)).toBe(true);
      expect(local[key]).toBeTypeOf("string");
    }
  });

  it("parses to empty strings, not undefined, for the QR fields", () => {
    const parsed = shelterSettingsSchema.parse(localDefaultSettings) as Record<string, unknown>;
    for (const key of QR_SETTING_KEYS) {
      expect(parsed[key]).toBe("");
    }
  });
});

describe("read source reporting", () => {
  it("reports fromDatabase when the row is found", async () => {
    findUnique.mockResolvedValue({
      id: SETTINGS_ROW_ID,
      shelterName: "Hope for Strays",
      email: "info@hopeforstrays.org",
      phone: "03-7876 5432",
      address: "PJ",
      operatingHours: "Tue-Sun",
      announcementBanner: null,
      adoptionFeeDog: "Free",
      adoptionFeeCat: "Free",
      duitNowQrUrl: "/uploads/duitnow.png",
      tngQrUrl: null,
      bankQrUrl: null,
      paymentPayload: null,
    });

    const result = await readShelterSettingsWithSource();
    expect(result.fromDatabase).toBe(true);
    expect(result.settings.duitNowQrUrl).toBe("/uploads/duitnow.png");
  });

  it("reports fromDatabase=false when the database throws", async () => {
    findUnique.mockRejectedValue(new Error("column does not exist"));
    const result = await readShelterSettingsWithSource();
    expect(result.fromDatabase).toBe(false);
    expect(result.settings.shelterName).toBe(DEFAULT_SHELTER_SETTINGS.shelterName);
  });

  it("reports fromDatabase=false when the row does not exist yet", async () => {
    findUnique.mockResolvedValue(null);
    expect((await readShelterSettingsWithSource()).fromDatabase).toBe(false);
  });
});

describe("nullable column handling", () => {
  it("treats exactly the optional columns as nullable", () => {
    expect([...NULLABLE_SETTING_COLUMNS].sort()).toEqual(
      ["announcementBanner", ...QR_SETTING_KEYS].sort()
    );
  });

  it("round-trips a stored QR through read without losing it", async () => {
    upsert.mockResolvedValue({});
    await writeShelterSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "/uploads/duitnow.png",
    });

    findUnique.mockResolvedValue({
      id: SETTINGS_ROW_ID,
      ...Object.fromEntries(PERSISTED_SETTING_KEYS.map((k) => [k, null])),
      shelterName: "Hope for Strays",
      email: "info@hopeforstrays.org",
      phone: "03-7876 5432",
      address: "PJ",
      operatingHours: "Tue-Sun",
      adoptionFeeDog: "Free",
      adoptionFeeCat: "Free",
      duitNowQrUrl: "/uploads/duitnow.png",
    });

    const { settings } = await readShelterSettingsWithSource();
    expect(settings.duitNowQrUrl).toBe("/uploads/duitnow.png");
  });

  it("trims a padded QR path before it reaches the column", async () => {
    upsert.mockResolvedValue({});
    await writeShelterSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "  /uploads/duitnow.png  ",
    });

    const update = (upsert.mock.calls[0][0] as { update: Record<string, unknown> }).update;
    expect(update.duitNowQrUrl).toBe("/uploads/duitnow.png");
  });

  it("keeps a NOT NULL column populated when the row returns it empty", async () => {
    findUnique.mockResolvedValue({
      id: SETTINGS_ROW_ID,
      ...Object.fromEntries(PERSISTED_SETTING_KEYS.map((k) => [k, null])),
      shelterName: "",
    });

    const { settings } = await readShelterSettingsWithSource();
    expect(settings.shelterName).toBe(DEFAULT_SHELTER_SETTINGS.shelterName);
  });
});
