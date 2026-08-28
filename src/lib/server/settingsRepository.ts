import { prisma } from "@/lib/server/prisma";
import { handlePersistenceError } from "@/lib/persistenceMode";
import { ShelterSettingsInput, ShelterSettingsOutput } from "@/lib/validations/settings";

/**
 * Shelter Settings persistence and caching over the dual-layer store (L-B2).
 *
 * Persists operational shelter configuration (name, address, hours, fees, banner)
 * to PostgreSQL via Prisma with an in-memory fallback cache for offline/test environments.
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
 * Asynchronous read with database query and fallback cache update.
 */
export async function getServerSettingsAsync(): Promise<ShelterSettingsOutput> {
  try {
    const row = await prisma.shelterSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    if (row) {
      serverSettings = {
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
  }

  return serverSettings;
}

/**
 * Updates settings both in the database and the in-memory store.
 */
export async function updateServerSettings(data: ShelterSettingsInput): Promise<ShelterSettingsOutput> {
  serverSettings = {
    ...serverSettings,
    ...data,
  };

  try {
    await prisma.shelterSettings.upsert({
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
  } catch (err) {
    handlePersistenceError("Prisma shelter settings update", err, "write");
  }

  return serverSettings;
}
