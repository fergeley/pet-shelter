"use server";

import { revalidatePath } from "next/cache";
import {
  applicationFormSchema,
  ApplicationFormInput,
  updateApplicationStatusSchema,
  UpdateApplicationStatusInput,
  scheduleInterviewSchema,
  ScheduleInterviewInput,
} from "@/lib/validations/application";
import { AdoptionApplicationRecord } from "@/types/application";
import { getCurrentSession } from "@/lib/security/session";
import { assertAuthorized, ROLES } from "@/lib/security/rbac";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { withIdempotency } from "@/lib/security/idempotency";
import {
  getServerApplicationsAsync,
  insertServerApplication,
  atomicUpdateApplicationStatus,
  deleteServerApplication,
  findServerPetById,
  findServerApplicationById,
} from "@/lib/serverStore";
import {
  sendApplicationConfirmationEmail,
  sendStaffApplicationAlert,
  sendApplicationStatusUpdateEmail,
  sendInterviewInvitationEmail,
} from "@/lib/email";
import { recordAuditLog } from "@/lib/domain/auditLog";

export async function getApplications(): Promise<AdoptionApplicationRecord[]> {
  const session = await getCurrentSession();
  assertAuthorized(session, [ROLES.ADMIN, ROLES.COORDINATOR, ROLES.STAFF]);

  return getServerApplicationsAsync();
}

export async function submitApplication(
  data: ApplicationFormInput,
  idempotencyKey?: string
): Promise<{ success: boolean; data?: AdoptionApplicationRecord; error?: string }> {
  try {
    const validated = applicationFormSchema.parse(data);

    // Verify target pet exists and is not archived
    const pet = findServerPetById(validated.petId);
    if (pet && pet.isArchived) {
      return {
        success: false,
        error: "This animal is currently archived and is no longer accepting new adoption applications.",
      };
    }

    // 1. Rate Limiting on public adoption applications (10 applications per 10 minutes per email)
    const rateLimit = checkRateLimit(`submit-app:${validated.email.toLowerCase()}`, 10, 600000);
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Submission rate limit exceeded. Please wait ${rateLimit.retryAfterSeconds}s before submitting again.`,
      };
    }

    // 2. Idempotency Wrapper
    return await withIdempotency(idempotencyKey, async () => {
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

      await insertServerApplication(newApp);
      revalidatePath("/admin/applications");
      revalidatePath("/admin");

      // Non-blocking, resilient email notification dispatch
      Promise.allSettled([
        sendApplicationConfirmationEmail(newApp),
        sendStaffApplicationAlert(newApp),
      ]).catch((err) => console.error("[Email Notification Dispatch Failed]", err));

      return { success: true, data: newApp };
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to submit adoption application";
    return { success: false, error: msg };
  }
}

export async function updateApplicationStatus(
  input: UpdateApplicationStatusInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentSession();
    assertAuthorized(session, [ROLES.ADMIN, ROLES.COORDINATOR]);

    const validated = updateApplicationStatusSchema.parse(input);
    const existingApp = findServerApplicationById(validated.id);

    const result = await atomicUpdateApplicationStatus(
      validated.id,
      validated.status,
      validated.adminReviewNotes,
      session
    );

    if (!result.success) {
      return result;
    }

    // Non-blocking transactional email notification for status change
    if (existingApp && validated.notifyApplicant !== false) {
      const updatedApp: AdoptionApplicationRecord = {
        ...existingApp,
        status: validated.status,
        adminReviewNotes: validated.adminReviewNotes ?? existingApp.adminReviewNotes,
      };

      sendApplicationStatusUpdateEmail(
        updatedApp,
        validated.status,
        validated.adminReviewNotes
      ).catch((err) => console.error("[Status Email Notification Error]", err));
    }

    revalidatePath("/admin/applications");
    revalidatePath("/admin/pets");
    revalidatePath("/pets");
    revalidatePath("/");

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to update application status";
    return { success: false, error: msg };
  }
}

export async function scheduleApplicationInterview(
  input: ScheduleInterviewInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentSession();
    assertAuthorized(session, [ROLES.ADMIN, ROLES.COORDINATOR]);

    const validated = scheduleInterviewSchema.parse(input);
    const app = findServerApplicationById(validated.applicationId);

    if (!app) {
      return { success: false, error: "Application not found" };
    }

    const meetingTypeLabel = validated.meetingType === "video_call" ? "Virtual Video Call" : "In-Person Visit";
    const formattedNotes = `[Meet & Greet Scheduled: ${validated.interviewDate} at ${validated.interviewTime} (${meetingTypeLabel}) - Location: ${validated.location}] ${validated.coordinatorNotes || ""}`.trim();

    // If currently SUBMITTED, transition to UNDER_REVIEW
    if (app.status === "SUBMITTED") {
      await atomicUpdateApplicationStatus(
        app.id,
        "UNDER_REVIEW",
        formattedNotes,
        session
      );
    } else {
      // Append interview details to review notes
      await atomicUpdateApplicationStatus(
        app.id,
        app.status,
        formattedNotes,
        session
      );
    }

    // Record interview scheduled audit log
    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "INTERVIEW_SCHEDULED",
      entity: "AdoptionApplication",
      entityId: app.id,
      details: {
        petId: app.petId,
        petName: app.petName,
        applicantName: app.applicantName,
        interviewDate: validated.interviewDate,
        interviewTime: validated.interviewTime,
        meetingType: validated.meetingType,
        location: validated.location,
      },
    });

    // Dispatch interview invitation email to applicant
    if (validated.notifyApplicant !== false) {
      sendInterviewInvitationEmail(app, {
        interviewDate: validated.interviewDate,
        interviewTime: validated.interviewTime,
        location: validated.location,
        meetingType: validated.meetingType,
        coordinatorNotes: validated.coordinatorNotes,
        coordinatorName: session.email.split("@")[0],
      }).catch((err) => console.error("[Interview Email Notification Error]", err));
    }

    revalidatePath("/admin/applications");
    revalidatePath("/admin");

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to schedule interview";
    return { success: false, error: msg };
  }
}

export async function deleteApplication(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getCurrentSession();
    assertAuthorized(session, [ROLES.ADMIN]);

    const ok = await deleteServerApplication(id, session);
    if (!ok) {
      return { success: false, error: "Application not found" };
    }

    revalidatePath("/admin/applications");
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete application";
    return { success: false, error: msg };
  }
}
