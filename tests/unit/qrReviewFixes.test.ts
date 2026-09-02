import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Defects found by code review of the donation QR feature, each pinned so it
 * cannot come back.
 */

const auditCreate = vi.fn().mockResolvedValue({});
const settingsUpsert = vi.fn().mockResolvedValue({});
const settingsFindUnique = vi.fn().mockResolvedValue(null);

vi.mock("@/lib/prisma", () => ({
  prisma: {
    auditLog: {
      create: (...args: unknown[]) => auditCreate(...args),
      findMany: vi.fn().mockResolvedValue([]),
    },
    shelterSettings: {
      upsert: (...args: unknown[]) => settingsUpsert(...args),
      findUnique: (...args: unknown[]) => settingsFindUnique(...args),
    },
  },
}));

const getCurrentSession = vi.fn();
vi.mock("@/lib/security/session", () => ({
  getCurrentSession: () => getCurrentSession(),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { loadShelterSettings, updateShelterSettings } from "@/actions/settings";
import {
  DEFAULT_SHELTER_SETTINGS,
  resetShelterSettingsCache,
} from "@/lib/domain/shelterSettings";
import { defaultSettings as localDefaultSettings } from "@/lib/settingsStore";
import { mergeQrSources } from "@/lib/domain/qrCode";
import {
  roleCanEditGlobalQr,
  roleCanEditPetQr,
} from "@/lib/security/qrAccess";

const ADMIN = { id: "a1", email: "admin@hopeforstrays.org", role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  resetShelterSettingsCache();
  settingsFindUnique.mockResolvedValue(null);
  settingsUpsert.mockResolvedValue({});
  getCurrentSession.mockResolvedValue(ADMIN);
});

describe("loadShelterSettings authorization", () => {
  it("rejects an unauthenticated caller", async () => {
    getCurrentSession.mockResolvedValue(null);
    // A server action is a POST endpoint whose id ships in the client bundle.
    await expect(loadShelterSettings()).rejects.toThrow();
  });

  it("rejects a STAFF session", async () => {
    getCurrentSession.mockResolvedValue({ ...ADMIN, role: "STAFF" });
    await expect(loadShelterSettings()).rejects.toThrow();
  });

  it("never returns the Resend key or storage credentials", async () => {
    resetShelterSettingsCache({
      ...DEFAULT_SHELTER_SETTINGS,
      resendApiKey: "re_live_supersecret",
      s3Bucket: "private-bucket",
    });

    const { settings } = await loadShelterSettings();

    expect(JSON.stringify(settings)).not.toContain("re_live_supersecret");
    expect(JSON.stringify(settings)).not.toContain("private-bucket");
    expect("resendApiKey" in settings).toBe(false);
  });

  it("returns the QR fields the form needs", async () => {
    resetShelterSettingsCache({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "/uploads/duitnow.png",
    });
    const { settings } = await loadShelterSettings();
    expect(settings.duitNowQrUrl).toBe("/uploads/duitnow.png");
  });
});

describe("save honesty", () => {
  it("reports persisted:false when the write never reached Postgres", async () => {
    settingsUpsert.mockRejectedValue(new Error("column does not exist"));

    const res = await updateShelterSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "/uploads/duitnow.png",
    });

    // The admin must not be shown an unqualified success: donors would keep
    // scanning the old code and the upload dies with the process.
    expect(res.success).toBe(true);
    expect(res.persisted).toBe(false);
  });

  it("reports persisted:true on a real write", async () => {
    const res = await updateShelterSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "/uploads/duitnow.png",
    });
    expect(res.persisted).toBe(true);
  });
});

describe("mergeQrSources undefined vs empty string", () => {
  const config = {
    duitNowQrUrl: "/uploads/shelter.png",
    paymentPayload: "0002010102",
    shelterName: "Rumah Harapan",
  };

  it("falls back to the shelter config when a source is undefined", () => {
    // The pet dialog passes no shelter values and must still preview the QR a
    // donor would really see for that animal.
    const merged = mergeQrSources({ petCustomQrUrl: "", petName: "Bruno" }, config);
    expect(merged.shelterQrUrl).toBe("/uploads/shelter.png");
    expect(merged.shelterName).toBe("Rumah Harapan");
  });

  it("treats an explicit empty string as cleared, not as absent", () => {
    // The settings preview passes "" when the admin clears the field.
    const merged = mergeQrSources({ shelterQrUrl: "", paymentPayload: "" }, config);
    expect(merged.shelterQrUrl).toBe("");
    expect(merged.paymentPayload).toBe("");
  });
});

describe("settings defaults are a single object", () => {
  it("shares one instance between the store and the domain module", () => {
    // These were two literals that had already drifted on operatingHours.
    expect(localDefaultSettings).toBe(DEFAULT_SHELTER_SETTINGS);
  });
});

describe("QR role policy is the one the UI consults", () => {
  it("normalizes the loosely-typed role from useAdminAuth", () => {
    expect(roleCanEditGlobalQr("admin")).toBe(true);
    expect(roleCanEditGlobalQr("ADMIN")).toBe(true);
  });

  it("keeps shelter-wide edits away from COORDINATOR", () => {
    expect(roleCanEditGlobalQr("COORDINATOR")).toBe(false);
    expect(roleCanEditPetQr("COORDINATOR")).toBe(true);
  });

  it("refuses STAFF, VOLUNTEER and absent roles in both scopes", () => {
    for (const role of ["STAFF", "VOLUNTEER", "", null, undefined]) {
      expect(roleCanEditGlobalQr(role)).toBe(false);
      expect(roleCanEditPetQr(role)).toBe(false);
    }
  });
});
