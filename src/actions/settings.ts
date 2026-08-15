"use server";

import { revalidatePath } from "next/cache";
import { shelterSettingsSchema, ShelterSettingsInput } from "@/lib/validations/settings";

let serverSettings: ShelterSettingsInput = {
  shelterName: "Hope for Strays",
  email: "info@hopeforstrays.org",
  phone: "03-7876 5432",
  address: "No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia",
  operatingHours: "Tuesday – Sunday: 10:00 AM – 5:00 PM",
  announcementBanner: "Weekend Adoption Drive & Free Microchip Clinic this Saturday 9 AM – 1 PM at Petaling Jaya sanctuary!",
  adoptionFeeDog: "RM 180",
  adoptionFeeCat: "RM 95",
};

export async function getShelterSettings(): Promise<ShelterSettingsInput> {
  return serverSettings;
}

export async function updateShelterSettings(data: ShelterSettingsInput): Promise<{ success: boolean; data?: ShelterSettingsInput; error?: string }> {
  try {
    const validated = shelterSettingsSchema.parse(data);
    serverSettings = { ...validated };

    revalidatePath("/");
    revalidatePath("/pets");
    revalidatePath("/admin/settings");

    return { success: true, data: serverSettings };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update shelter settings";
    return { success: false, error: msg };
  }
}
