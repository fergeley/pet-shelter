import { prisma } from "@/lib/server/prisma";
import { handlePersistenceError, isDatabasePersistent } from "@/lib/persistenceMode";
import { ShelterSettingsInput, ShelterSettingsOutput } from "@/lib/validations/settings";

/**
 * Shelter Settings persistence over the repository layer.
 *
 * Deterministic storage strategy:
 * - When DATABASE_URL is set / active: pure Prisma persistence with PostgreSQL.
 * - When offline / test mode: isolated in-memory fixture store for fast zero-dependency runs.
 */

const DEFAULT_SETTINGS_ID = "default-settings";

const INITIAL_SETTINGS: ShelterSettingsOutput = {
  shelterName: "Hope for Strays",
  email: "info@hopeforstrays.org",
  phone: "03-7876 5432",
  address: "No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia",
  operatingHours: "Tuesday – Sunday: 10:00 AM – 5:00 PM",
  announcementBanner: "Weekend Adoption Drive & Free Microchip Clinic this Saturday 9 AM – 1 PM at Petaling Jaya sanctuary!",
  adoptionFeeDog: "Free",
  adoptionFeeCat: "Free",
  resendApiKey: "",
  emailFrom: "Hope for Strays <onboarding@resend.dev>",
  shelterNotificationEmail: "fergeley@gmail.com",
  storageProvider: "local",
  s3Bucket: "",
  s3Region: "ap-southeast-1",
  s3CdnUrl: "",
  cloudinaryCloudName: "",
};

function freshSettings(): ShelterSettingsOutput {
  return structuredClone(INITIAL_SETTINGS);
}

let serverSettings: ShelterSettingsOutput = freshSettings();

/** Test-only. Reached through `resetServerStore()` in `./fallbackState`. */
export function resetSettings(): void {
  serverSettings = freshSettings();
}

/** Synchronous cached read. */
export function getServerSettings(): ShelterSettingsOutput {
  return serverSettings;
}

/**
 * Asynchronous read with database query or fallback to test fixture.
 */
export async function getServerSettingsAsync(): Promise<ShelterSettingsOutput> {
  if (isDatabasePersistent()) {
    try {
      const row = await prisma.shelterSettings.findUnique({
        where: { id: DEFAULT_SETTINGS_ID },
      });

      if (row) {
        return {
          ...serverSettings,
          shelterName: row.shelterName,
          email: row.email,
          phone: row.phone,
          address: row.address,
          operatingHours: row.operatingHours,
          announcementBanner: row.announcementBanner ?? "",
          adoptionFeeDog: row.adoptionFeeDog,
          adoptionFeeCat: row.adoptionFeeCat,
        };
      }
    } catch (err) {
      handlePersistenceError("Prisma shelter settings query", err, "read");
      return serverSettings;
    }
  }

  return serverSettings;
}

/**
 * Updates settings in the database or the in-memory test store.
 */
export async function updateServerSettings(data: ShelterSettingsInput): Promise<ShelterSettingsOutput> {
  if (isDatabasePersistent()) {
    try {
      const updated = await prisma.shelterSettings.upsert({
        where: { id: DEFAULT_SETTINGS_ID },
        update: {
          shelterName: data.shelterName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          operatingHours: data.operatingHours,
          announcementBanner: data.announcementBanner || null,
          adoptionFeeDog: data.adoptionFeeDog,
          adoptionFeeCat: data.adoptionFeeCat,
        },
        create: {
          id: DEFAULT_SETTINGS_ID,
          shelterName: data.shelterName,
          email: data.email,
          phone: data.phone,
          address: data.address,
          operatingHours: data.operatingHours,
          announcementBanner: data.announcementBanner || null,
          adoptionFeeDog: data.adoptionFeeDog,
          adoptionFeeCat: data.adoptionFeeCat,
        },
      });

      serverSettings = {
        ...serverSettings,
        ...data,
        shelterName: updated.shelterName,
        email: updated.email,
        phone: updated.phone,
        address: updated.address,
        operatingHours: updated.operatingHours,
        announcementBanner: updated.announcementBanner ?? "",
        adoptionFeeDog: updated.adoptionFeeDog,
        adoptionFeeCat: updated.adoptionFeeCat,
      };
      return serverSettings;
    } catch (err) {
      handlePersistenceError("Prisma shelter settings update", err, "write");
    }
  }

  serverSettings = {
    ...serverSettings,
    ...data,
  };
  return serverSettings;
}
