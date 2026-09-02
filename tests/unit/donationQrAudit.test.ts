import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Covers requirement 3/5 of the QR feature: changing a donation QR must leave
 * an immutable audit record naming the actor and the old and new values.
 *
 * Prisma is mocked, so this asserts on what the action *sends* to the audit
 * store rather than on a row in the production database.
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

vi.mock("@/lib/security/session", () => ({
  getCurrentSession: vi.fn().mockResolvedValue({
    id: "admin-test-01",
    email: "admin@hopeforstrays.org",
    role: "ADMIN",
  }),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

import { updateShelterSettings } from "@/actions/settings";
import { getAuditLogs } from "@/lib/domain/auditLog";
import {
  DEFAULT_SHELTER_SETTINGS,
  resetShelterSettingsCache,
} from "@/lib/domain/shelterSettings";

beforeEach(() => {
  vi.clearAllMocks();
  resetShelterSettingsCache();
});

describe("donation QR audit trail", () => {
  it("records DONATION_QR_UPDATED with the actor and an old/new diff", async () => {
    const result = await updateShelterSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "/uploads/new-duitnow.png",
    });

    expect(result.success).toBe(true);

    const entry = getAuditLogs(20).find((log) => log.action === "DONATION_QR_UPDATED");
    expect(entry).toBeDefined();
    expect(entry!.actorEmail).toBe("admin@hopeforstrays.org");
    expect(entry!.actorRole).toBe("ADMIN");
    expect(entry!.entity).toBe("ShelterSettings");

    const details = entry!.details as {
      before: Record<string, string>;
      after: Record<string, string>;
    };
    expect(details.before.duitNowQrUrl).toBe("");
    expect(details.after.duitNowQrUrl).toBe("/uploads/new-duitnow.png");
  });

  it("persists that entry to the audit_logs table with targetEntity ShelterSettings", async () => {
    await updateShelterSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "/uploads/new-duitnow.png",
    });

    const qrRow = auditCreate.mock.calls
      .map((call) => (call[0] as { data: Record<string, unknown> }).data)
      .find((data) => data.action === "DONATION_QR_UPDATED");

    expect(qrRow).toBeDefined();
    expect(qrRow!.targetEntity).toBe("ShelterSettings");
    expect(qrRow!.actorEmail).toBe("admin@hopeforstrays.org");
  });

  it("does not record a QR entry when no QR field changed", async () => {
    // The audit store is a module-level array shared across cases, so assert on
    // the entries this call added rather than on the whole log.
    const before = getAuditLogs(1000).length;
    await updateShelterSettings({ ...DEFAULT_SHELTER_SETTINGS, shelterName: "Renamed Shelter" });
    const added = getAuditLogs(1000).length - before;

    const newEntries = getAuditLogs(1000).slice(0, added);
    expect(newEntries.some((log) => log.action === "SETTINGS_UPDATED")).toBe(true);
    expect(newEntries.some((log) => log.action === "DONATION_QR_UPDATED")).toBe(false);
  });

  it("keeps the Resend key out of the settings audit entry", async () => {
    await updateShelterSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      resendApiKey: "re_live_supersecret",
      duitNowQrUrl: "/uploads/new-duitnow.png",
    });

    const serialized = JSON.stringify(getAuditLogs(20));
    expect(serialized).not.toContain("re_live_supersecret");
    expect(serialized).toContain("[redacted]");
  });

  it("refuses the write for a non-ADMIN session", async () => {
    const session = await import("@/lib/security/session");
    vi.mocked(session.getCurrentSession).mockResolvedValueOnce({
      id: "coord-01",
      email: "coordinator@hopeforstrays.org",
      role: "COORDINATOR",
    } as Awaited<ReturnType<typeof session.getCurrentSession>>);

    const result = await updateShelterSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "/uploads/sneaky.png",
    });

    expect(result.success).toBe(false);
    expect(settingsUpsert).not.toHaveBeenCalled();
  });

  it("rejects an unsafe QR URL before it can reach the database", async () => {
    const result = await updateShelterSettings({
      ...DEFAULT_SHELTER_SETTINGS,
      duitNowQrUrl: "javascript:alert(1)",
    });

    expect(result.success).toBe(false);
    expect(settingsUpsert).not.toHaveBeenCalled();
  });
});
