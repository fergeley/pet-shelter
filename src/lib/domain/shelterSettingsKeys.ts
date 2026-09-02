/**
 * Shelter-settings key lists, kept free of any Prisma import.
 *
 * `shelterSettings.ts` imports `@/lib/prisma`, so a client component that
 * needed these constants from there would drag the database client into the
 * browser bundle. They live here instead, and both sides import from this file.
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

/**
 * Persisted keys whose column is nullable. Reading and writing both need this
 * distinction — a cleared value round-trips as NULL for these and must never be
 * written as NULL for the rest — so it is defined once rather than spelled out
 * at each site.
 */
export const NULLABLE_SETTING_COLUMNS: ReadonlySet<string> = new Set<string>([
  "announcementBanner",
  ...QR_SETTING_KEYS,
]);

export function isNullableSettingColumn(key: string): boolean {
  return NULLABLE_SETTING_COLUMNS.has(key);
}

/** Setting keys whose values must never reach the audit log in cleartext. */
export const SECRET_SETTING_KEYS = ["resendApiKey"] as const;
