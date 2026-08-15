"use server";

import { revalidatePath } from "next/cache";
import { applicationFormSchema, ApplicationFormInput, updateApplicationStatusSchema, UpdateApplicationStatusInput } from "@/lib/validations/application";
import initialApplicationsData from "@/data/applications.json";
import { AdoptionApplicationRecord } from "@/types/application";

let serverApplications: AdoptionApplicationRecord[] = [...(initialApplicationsData as AdoptionApplicationRecord[])];

export async function getApplications(): Promise<AdoptionApplicationRecord[]> {
  return serverApplications;
}

export async function submitApplication(data: ApplicationFormInput): Promise<{ success: boolean; data?: AdoptionApplicationRecord; error?: string }> {
  try {
    const validated = applicationFormSchema.parse(data);
    const today = new Date().toISOString().split("T")[0];

    const newApp: AdoptionApplicationRecord = {
      id: `app-${Date.now()}`,
      petId: validated.petId,
      petName: validated.petName,
      applicantName: validated.applicantName,
      email: validated.email,
      phone: validated.phone,
      address: validated.address,
      housingType: validated.housingType,
      hasFencedYard: validated.hasFencedYard,
      currentPets: validated.currentPets,
      currentPetDetails: validated.currentPetDetails,
      householdExperience: validated.householdExperience,
      applicantNotes: validated.applicantNotes,
      status: "SUBMITTED",
      adminReviewNotes: "",
      createdAt: today,
      updatedAt: today,
    };

    serverApplications = [newApp, ...serverApplications];
    revalidatePath("/admin/applications");

    return { success: true, data: newApp };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to submit adoption application";
    return { success: false, error: msg };
  }
}

export async function updateApplicationStatus(input: UpdateApplicationStatusInput): Promise<{ success: boolean; error?: string }> {
  try {
    const validated = updateApplicationStatusSchema.parse(input);
    const index = serverApplications.findIndex((a) => a.id === validated.id);
    if (index === -1) {
      return { success: false, error: "Application not found" };
    }

    const today = new Date().toISOString().split("T")[0];
    serverApplications[index] = {
      ...serverApplications[index],
      status: validated.status,
      adminReviewNotes: validated.adminReviewNotes !== undefined ? validated.adminReviewNotes : serverApplications[index].adminReviewNotes,
      updatedAt: today,
    };

    revalidatePath("/admin/applications");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update application status";
    return { success: false, error: msg };
  }
}

export async function deleteApplication(id: string): Promise<{ success: boolean; error?: string }> {
  const index = serverApplications.findIndex((a) => a.id === id);
  if (index === -1) {
    return { success: false, error: "Application not found" };
  }

  serverApplications = serverApplications.filter((a) => a.id !== id);
  revalidatePath("/admin/applications");
  return { success: true };
}
