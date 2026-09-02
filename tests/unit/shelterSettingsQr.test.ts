import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Prisma is mocked so these cases exercise the persistence layer's own logic —
 * column mapping, null handling, and the offline fallback — without reaching a
 * real database.
 */
const upsert = vi.fn();
const findUnique = vi.fn();

vi.mock("@/lib/prisma", () => ({
  prisma: {
    shelterSettings: {
      upsert: (...args: unknown[]) => upsert(...args),
      findUnique: (...args: unknown[]) => findUnique(...args),
    },
  },
}));

import {
  DEFAULT_SHELTER_SETTINGS,
  PERSISTED_SETTING_KEYS,
  QR_SETTING_KEYS,
  SETTINGS_ROW_ID,
  pickQrSettings,
  qrSettingsChanged,
  readShelterSettings,
  redactSettingsForAudit,
  resetShelterSettingsCache,
  writeShelterSettings,
} from "@/lib/domain/shelterSettings";
import { shelterSettingsSchema } from "@/lib/validations/settings";
import { petFormSchema } from "@/lib/validations/pet";
import { QR_GLOBAL_WRITE_ROLES, QR_PET_WRITE_ROLES } from "@/lib/security/qrAccess";

beforeEach(() => {
  vi.clearAllMocks();
  resetShelterSettingsCache();
});

describe("shelter settings persistence", () => {
  it("writes every QR field to the shelter_settings row", async () => {
    upsert.mockResolvedValue({});

    const result = await writeShelterSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "/uploads/duitnow.png",
      paymentPayload: "00020101021126",
    });

    expect(result.persisted).toBe(true);
    expect(upsert).toHaveBeenCalledTimes(1);

    const call = upsert.mock.calls[0][0] as {
      where: { id: string };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    };
    expect(call.where.id).toBe(SETTINGS_ROW_ID);
    expect(call.update.duitNowQrUrl).toBe("/uploads/duitnow.png");
    expect(call.update.paymentPayload).toBe("00020101021126");
    expect(call.create.id).toBe(SETTINGS_ROW_ID);
  });

  it("stores a cleared optional field as NULL, not an empty string", async () => {
    upsert.mockResolvedValue({});
    await writeShelterSettings({ ...DEFAULT_SHELTER_SETTINGS, duitNowQrUrl: "" });

    const update = (upsert.mock.calls[0][0] as { update: Record<string, unknown> }).update;
    expect(update.duitNowQrUrl).toBeNull();
  });

  it("never writes NULL into a NOT NULL column", async () => {
    upsert.mockResolvedValue({});
    await writeShelterSettings({ ...DEFAULT_SHELTER_SETTINGS, shelterName: "Hope" });

    const update = (upsert.mock.calls[0][0] as { update: Record<string, unknown> }).update;
    expect(update.shelterName).toBe("Hope");
    for (const key of ["shelterName", "email", "phone", "address", "operatingHours"]) {
      expect(update[key]).not.toBeNull();
    }
  });

  it("only sends keys that have real columns", async () => {
    upsert.mockResolvedValue({});
    await writeShelterSettings({ ...DEFAULT_SHELTER_SETTINGS, resendApiKey: "re_secret" });

    const update = (upsert.mock.calls[0][0] as { update: Record<string, unknown> }).update;
    expect(Object.keys(update).sort()).toEqual([...PERSISTED_SETTING_KEYS].sort());
    expect(update.resendApiKey).toBeUndefined();
  });

  it("reads a stored QR back and maps NULL columns to empty strings", async () => {
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

    const settings = await readShelterSettings();
    expect(settings.duitNowQrUrl).toBe("/uploads/duitnow.png");
    expect(settings.tngQrUrl).toBe("");
    expect(settings.announcementBanner).toBe("");
  });

  it("falls back to memory instead of throwing when the database is unreachable", async () => {
    findUnique.mockRejectedValue(new Error("ECONNREFUSED"));
    const settings = await readShelterSettings();
    expect(settings.shelterName).toBe(DEFAULT_SHELTER_SETTINGS.shelterName);
  });

  it("reports persisted:false when the write fails, and keeps the value in memory", async () => {
    upsert.mockRejectedValue(new Error("column does not exist"));

    const result = await writeShelterSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "/uploads/duitnow.png",
    });

    expect(result.persisted).toBe(false);
    expect(result.settings.duitNowQrUrl).toBe("/uploads/duitnow.png");

    findUnique.mockRejectedValue(new Error("still down"));
    expect((await readShelterSettings()).duitNowQrUrl).toBe("/uploads/duitnow.png");
  });
});

describe("QR audit diffing", () => {
  it("picks only the QR keys", () => {
    const picked = pickQrSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "/uploads/a.png",
    });
    expect(Object.keys(picked).sort()).toEqual([...QR_SETTING_KEYS].sort());
    expect(picked.duitNowQrUrl).toBe("/uploads/a.png");
  });

  it("detects a QR change", () => {
    const before = { ...DEFAULT_SHELTER_SETTINGS };
    const after = { ...DEFAULT_SHELTER_SETTINGS, tngQrUrl: "/uploads/tng.png" };
    expect(qrSettingsChanged(before, after)).toBe(true);
  });

  it("ignores changes to unrelated settings", () => {
    const before = { ...DEFAULT_SHELTER_SETTINGS };
    const after = { ...DEFAULT_SHELTER_SETTINGS, shelterName: "Renamed" };
    expect(qrSettingsChanged(before, after)).toBe(false);
  });

  it("redacts the Resend key before it reaches audit_logs", () => {
    const redacted = redactSettingsForAudit({
      ...DEFAULT_SHELTER_SETTINGS,
      resendApiKey: "re_live_supersecret",
    });
    expect(redacted.resendApiKey).toBe("[redacted]");
    expect(JSON.stringify(redacted)).not.toContain("supersecret");
  });

  it("leaves an unset key as an empty string rather than claiming redaction", () => {
    const redacted = redactSettingsForAudit({ ...DEFAULT_SHELTER_SETTINGS, resendApiKey: "" });
    expect(redacted.resendApiKey).toBe("");
  });
});

describe("settings schema QR fields", () => {
  const base = {
    shelterName: "Hope for Strays",
    email: "contact@hopeforstrays.org",
    phone: "03-7876 5432",
    address: "No. 18, Jalan SS 2/72, Petaling Jaya",
    operatingHours: "Tue-Sun 10am-5pm",
    adoptionFeeDog: "Free",
    adoptionFeeCat: "Free",
  };

  it("accepts an uploaded path", () => {
    expect(shelterSettingsSchema.safeParse({ ...base, duitNowQrUrl: "/uploads/qr.png" }).success).toBe(true);
  });

  it("rejects a javascript: URL", () => {
    expect(shelterSettingsSchema.safeParse({ ...base, duitNowQrUrl: "javascript:alert(1)" }).success).toBe(false);
  });

  it("treats an omitted QR field as empty", () => {
    const parsed = shelterSettingsSchema.parse(base);
    expect(parsed.duitNowQrUrl).toBe("");
    expect(parsed.paymentPayload).toBe("");
  });

  it("rejects an over-long payment payload", () => {
    expect(shelterSettingsSchema.safeParse({ ...base, paymentPayload: "A".repeat(5000) }).success).toBe(false);
  });
});

describe("pet schema image fields", () => {
  const base = {
    name: "Bruno",
    species: "dog",
    breed: "Mixed",
    age: "2 years",
    ageCategory: "adult",
    gender: "Male",
    size: "Medium",
    weight: "18 kg",
    status: "Available",
    adoptionFee: "Free",
    description: "A gentle rescue dog looking for a home.",
    rescueStory: "Found near the PJ market in poor condition.",
    tags: ["Vaccinated"],
    intakeDate: "2026-01-04",
  };

  it("accepts the /uploads/ path the uploader returns (regression)", () => {
    // The previous `z.string().url()` rejected this, so saving a pet after
    // uploading its photo failed validation outright.
    const parsed = petFormSchema.safeParse({ ...base, image: "/uploads/1730-ab-bruno.webp" });
    expect(parsed.success).toBe(true);
  });

  it("still accepts the absolute https URLs used by the seed data", () => {
    expect(
      petFormSchema.safeParse({ ...base, image: "https://images.unsplash.com/photo-123" }).success
    ).toBe(true);
  });

  it("rejects a javascript: image URL", () => {
    expect(petFormSchema.safeParse({ ...base, image: "javascript:alert(1)" }).success).toBe(false);
  });

  it("accepts an optional per-animal QR", () => {
    const parsed = petFormSchema.safeParse({
      ...base,
      image: "/uploads/bruno.webp",
      customQrUrl: "/uploads/bruno-fund.png",
    });
    expect(parsed.success).toBe(true);
  });

  it("rejects an unsafe per-animal QR", () => {
    expect(
      petFormSchema.safeParse({
        ...base,
        image: "/uploads/bruno.webp",
        customQrUrl: "//evil.example/qr.png",
      }).success
    ).toBe(false);
  });
});

describe("QR write access", () => {
  it("keeps shelter-wide QR edits to ADMIN, not widening the existing boundary", () => {
    expect([...QR_GLOBAL_WRITE_ROLES]).toEqual(["ADMIN"]);
  });

  it("lets COORDINATOR set a per-animal QR, matching their existing pet access", () => {
    expect([...QR_PET_WRITE_ROLES].sort()).toEqual(["ADMIN", "COORDINATOR"]);
  });

  it("never grants STAFF or VOLUNTEER either scope", () => {
    for (const role of ["STAFF", "VOLUNTEER"]) {
      expect(QR_GLOBAL_WRITE_ROLES).not.toContain(role);
      expect(QR_PET_WRITE_ROLES).not.toContain(role);
    }
  });
});
