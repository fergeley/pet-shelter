import { prisma } from "@/lib/prisma";
import { ShelterSettingsInput } from "@/lib/validations/settings";
import {
  isNullableSettingColumn,
  PERSISTED_SETTING_KEYS,
  QR_SETTING_KEYS,
  SECRET_SETTING_KEYS,
  SETTINGS_ROW_ID,
  type PersistedSettingKey,
  type QrSettingKey,
} from "@/lib/domain/shelterSettingsKeys";
import { DEFAULT_SHELTER_SETTINGS } from "@/lib/domain/shelterSettingsDefaults";

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

export {
  SETTINGS_ROW_ID,
  PERSISTED_SETTING_KEYS,
  QR_SETTING_KEYS,
  SECRET_SETTING_KEYS,
  type PersistedSettingKey,
  type QrSettingKey,
};

export { DEFAULT_SHELTER_SETTINGS };

/**
 * Holds the non-persisted keys, and serves as the fallback for every key when
 * the database is unreachable — the same degradation the pet and audit stores use.
 */
let memorySettings: ShelterSettingsInput = { ...DEFAULT_SHELTER_SETTINGS };

type ShelterSettingsRow = Record<PersistedSettingKey, string | null> & { id: string };

function mergeRow(row: ShelterSettingsRow): ShelterSettingsInput {
  const merged: ShelterSettingsInput = { ...memorySettings };

  for (const key of PERSISTED_SETTING_KEYS) {
    const value = row[key] ?? "";
    // A nullable column round-trips its emptiness faithfully. A NOT NULL column
    // that somehow came back empty keeps the in-memory value rather than
    // blanking the public site.
    if (isNullableSettingColumn(key) || value !== "") {
      (merged as Record<string, unknown>)[key] = value;
    }
  }

  return merged;
}

export interface ReadSettingsResult {
  settings: ShelterSettingsInput;
  /** True only when the values came back from Postgres. */
  fromDatabase: boolean;
}

/**
 * Reads settings from Postgres, reporting whether the row was actually found.
 *
 * Callers that overwrite admin-visible state need `fromDatabase`: treating the
 * in-memory fallback as authoritative would let a database outage silently
 * replace real settings with defaults.
 */
export async function readShelterSettingsWithSource(): Promise<ReadSettingsResult> {
  try {
    const row = (await prisma.shelterSettings.findUnique({
      where: { id: SETTINGS_ROW_ID },
    })) as ShelterSettingsRow | null;

    if (row) {
      const merged = mergeRow(row);
      memorySettings = merged;
      return { settings: merged, fromDatabase: true };
    }
  } catch {
    // Database offline, or the QR columns have not been applied yet.
  }

  return { settings: { ...memorySettings }, fromDatabase: false };
}

/** Convenience wrapper for callers that do not care where the values came from. */
export async function readShelterSettings(): Promise<ShelterSettingsInput> {
  return (await readShelterSettingsWithSource()).settings;
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
    const value = typeof raw === "string" ? raw.trim() : "";
    // Required columns are NOT NULL; never write null into them.
    columns[key] = isNullableSettingColumn(key) && value === "" ? null : value;
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
