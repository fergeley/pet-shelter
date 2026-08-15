"use server";

import { revalidatePath } from "next/cache";
import { shelterSettingsSchema, ShelterSettingsInput } from "@/lib/validations/settings";
import { getCurrentSession } from "@/lib/security/session";
import { assertAuthorized, ROLES } from "@/lib/security/rbac";
import { recordAuditLog } from "@/lib/domain/auditLog";

let serverSettings: ShelterSettingsInput = {
  shelterName: "Hope for Strays",
  email: "info@hopeforstrays.org",
  phone: "03-7876 5432",
  address: "No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia",
  operatingHours: "Tuesday – Sunday: 10:00 AM – 5:00 PM",
  announcementBanner: "Weekend Adoption Drive & Free Microchip Clinic this Saturday 9 AM – 1 PM at Petaling Jaya sanctuary!",
  adoptionFeeDog: "Free",
  adoptionFeeCat: "Free",
};

export async function getShelterSettings(): Promise<ShelterSettingsInput> {
  return serverSettings;
}

export async function updateShelterSettings(
  data: ShelterSettingsInput
): Promise<{ success: boolean; data?: ShelterSettingsInput; error?: string }> {
  try {
    const session = await getCurrentSession();
    assertAuthorized(session, [ROLES.ADMIN]);

    const validated = shelterSettingsSchema.parse(data);
    const previous = { ...serverSettings };
    serverSettings = { ...validated };

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "SETTINGS_UPDATED",
      entity: "ShelterSettings",
      entityId: "global-settings",
      details: { before: previous, after: serverSettings },
    });

    revalidatePath("/");
    revalidatePath("/pets");
    revalidatePath("/admin/settings");

    return { success: true, data: serverSettings };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update shelter settings";
    return { success: false, error: msg };
  }
}
