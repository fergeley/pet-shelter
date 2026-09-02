import { ShelterSettingsInput } from "@/lib/validations/settings";

/**
 * The single source of truth for shelter-settings fallbacks.
 *
 * This list previously existed twice — here in effect, and in
 * `src/lib/settingsStore.ts` — and the two had already drifted: the client copy
 * said "(Closed Mondays)" and the server copy did not, so whichever fallback
 * path happened to fire decided which opening hours the public site showed.
 * `settingsStore` now re-exports this object.
 *
 * Kept free of any Prisma import so client code can use it without pulling the
 * database client into the browser bundle, the same reason
 * `shelterSettingsKeys.ts` is separate.
 *
 * `operatingHours` matches the `@default` on `ShelterSettings.operatingHours`
 * in `prisma/schema.prisma`, so a fresh database row and the in-memory fallback
 * agree.
 */
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
