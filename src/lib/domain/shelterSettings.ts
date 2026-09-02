import { prisma } from "@/lib/prisma";
import { ShelterSettingsInput } from "@/lib/validations/settings";

/**
 * Persistence for shelter settings.
 *
 * Before this module the settings form wrote only to a module-level variable in
 * `src/actions/settings.ts`, so nothing survived a server restart and, on a
 * serverless deploy, each lambda instance held its own copy. Donation QR codes
 * have to outlive a request, so the columns that exist on `shelter_settings`
 * are now read and written through Prisma.
 *
 * The remaining keys (Resend credentials, storage provider config) have no
 * columns and stay in memory: an API key belongs in the environment, not in a
 * row any admin session can read back.
 */

export const SETTINGS_ROW_ID = "default-settings";

/** Keys backed by real columns on `shelter_settings`. */
export const PERSISTED_SETTING_KEYS = [
  "shelterName",
  "email",
  "phone",
  "address",
  "operatingHours",
  "announcementBanner",
  "adoptionFeeDog",
  "adoptionFeeCat",
  "duitNowQrUrl",
  "tngQrUrl",
  "bankQrUrl",
  "paymentPayload",
] as const;

export type PersistedSettingKey = (typeof PERSISTED_SETTING_KEYS)[number];

/** The QR-bearing subset, used for audit diffing and preview. */
export const QR_SETTING_KEYS = [
  "duitNowQrUrl",
  "tngQrUrl",
  "bankQrUrl",
  "paymentPayload",
] as const;

export type QrSettingKey = (typeof QR_SETTING_KEYS)[number];

export const DEFAULT_SHELTER_SETTINGS: ShelterSettingsInput = {
  shelterName: "Hope for Strays",
  email: "info@hopeforstrays.org",
  phone: "03-7876 5432",
  address: "No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia",
  operatingHours: "Tuesday – Sunday: 10:00 AM – 5:00 PM",
  announcementBanner:
    "Weekend Adoption Drive & Free Microchip Clinic this Saturday 9 AM – 1 PM at Petaling Jaya sanctuary!",
  adoptionFeeDog: "Free",
  adoptionFeeCat: "Free",
  duitNowQrUrl: "",
  tngQrUrl: "",
  bankQrUrl: "",
  paymentPayload: "",
  resendApiKey: "",
  emailFrom: "Hope for Strays <onboarding@resend.dev>",
  shelterNotificationEmail: "fergeley@gmail.com",
  storageProvider: "local",
  s3Bucket: "",
  s3Region: "ap-southeast-1",
  s3CdnUrl: "",
  cloudinaryCloudName: "",
};

/**
 * Holds the non-persisted keys, and serves as the fallback for every key when
 * the database is unreachable — the same degradation the pet and audit stores use.
 */
let memorySettings: ShelterSettingsInput = { ...DEFAULT_SHELTER_SETTINGS };

/** Prisma returns null for an unset optional column; the form model uses "". */
function fromColumn(value: string | null | undefined): string {
  return value ?? "";
}

/** "" means "cleared" to the form but must land in the column as NULL. */
function toColumn(value: string | null | undefined): string | null {
  const trimmed = (value ?? "").trim();
  return trimmed === "" ? null : trimmed;
}

type ShelterSettingsRow = Record<PersistedSettingKey, string | null> & { id: string };

function mergeRow(row: ShelterSettingsRow): ShelterSettingsInput {
  const merged: ShelterSettingsInput = { ...memorySettings };
  for (const key of PERSISTED_SETTING_KEYS) {
    const value = fromColumn(row[key]);
    // A required column that somehow came back empty keeps the default rather
    // than blanking the public site.
    if (value !== "" || key === "announcementBanner" || (QR_SETTING_KEYS as readonly string[]).includes(key)) {
      (merged as Record<string, unknown>)[key] = value;
    }
  }
  return merged;
}

/**
 * Reads settings from Postgres, falling back to the in-memory copy when the
 * row or the database is unavailable.
 */
export async function readShelterSettings(): Promise<ShelterSettingsInput> {
  try {
    const row = (await prisma.shelterSettings.findUnique({
      where: { id: SETTINGS_ROW_ID },
    })) as ShelterSettingsRow | null;

    if (row) {
      const merged = mergeRow(row);
      memorySettings = merged;
      return merged;
    }
  } catch {
    // Database offline or the QR columns have not been applied yet.
  }

  return { ...memorySettings };
}

export interface WriteSettingsResult {
  settings: ShelterSettingsInput;
  /** False when the write fell back to memory because Postgres was unreachable. */
  persisted: boolean;
}

/**
 * Upserts the persisted subset and keeps the in-memory copy in step so a
 * database outage degrades to the previous behaviour instead of failing the save.
 */
export async function writeShelterSettings(
  next: ShelterSettingsInput
): Promise<WriteSettingsResult> {
  memorySettings = { ...next };

  const columns: Record<string, string | null> = {};
  for (const key of PERSISTED_SETTING_KEYS) {
    const raw = (next as Record<string, unknown>)[key];
    const value = typeof raw === "string" ? raw : "";
    // Required columns are NOT NULL; never write null into them.
    const isOptionalColumn =
      key === "announcementBanner" || (QR_SETTING_KEYS as readonly string[]).includes(key);
    columns[key] = isOptionalColumn ? toColumn(value) : value;
  }

  try {
    await prisma.shelterSettings.upsert({
      where: { id: SETTINGS_ROW_ID },
      update: columns,
      create: { id: SETTINGS_ROW_ID, ...columns },
    });
    return { settings: { ...memorySettings }, persisted: true };
  } catch {
    return { settings: { ...memorySettings }, persisted: false };
  }
}

/** Synchronous view of the cached settings. Used by tests and sync callers. */
export function peekShelterSettings(): ShelterSettingsInput {
  return { ...memorySettings };
}

/** Test seam: restores the module to a known state between cases. */
export function resetShelterSettingsCache(
  seed: ShelterSettingsInput = DEFAULT_SHELTER_SETTINGS
): void {
  memorySettings = { ...seed };
}

/**
 * Extracts just the QR-related keys, for the audit-log before/after record.
 * Keeping the diff narrow means the audit entry reads as "what changed about
 * the QR codes" rather than a dump of every setting.
 */
export function pickQrSettings(
  settings: ShelterSettingsInput
): Record<QrSettingKey, string> {
  const picked = {} as Record<QrSettingKey, string>;
  for (const key of QR_SETTING_KEYS) {
    const raw = (settings as Record<string, unknown>)[key];
    picked[key] = typeof raw === "string" ? raw : "";
  }
  return picked;
}

/** Setting keys whose values must never reach the audit log in cleartext. */
export const SECRET_SETTING_KEYS = ["resendApiKey"] as const;

/**
 * Strips credentials before a settings snapshot is written to `audit_logs`.
 * Audit rows are readable by every admin and are deliberately immutable, so a
 * key captured there cannot be rotated out of the history.
 */
export function redactSettingsForAudit(
  settings: ShelterSettingsInput
): Record<string, unknown> {
  const copy: Record<string, unknown> = { ...settings };
  for (const key of SECRET_SETTING_KEYS) {
    const value = copy[key];
    copy[key] = typeof value === "string" && value !== "" ? "[redacted]" : "";
  }
  return copy;
}

/** True when any QR field differs between two settings snapshots. */
export function qrSettingsChanged(
  before: ShelterSettingsInput,
  after: ShelterSettingsInput
): boolean {
  const a = pickQrSettings(before);
  const b = pickQrSettings(after);
  return QR_SETTING_KEYS.some((key) => a[key] !== b[key]);
}
