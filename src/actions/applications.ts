"use server";

import { revalidatePath } from "next/cache";
import {
  applicationFormSchema,
  ApplicationFormInput,
  updateApplicationStatusSchema,
  UpdateApplicationStatusInput,
  scheduleInterviewSchema,
  ScheduleInterviewInput,
  recordHomeVisitSchema,
  RecordHomeVisitInput,
} from "@/lib/validations/application";
import {
  trackApplicationLookupSchema,
  TrackApplicationLookupInput,
  PublicApplicationTrackingDTO,
  PublicInterviewDetails,
} from "@/lib/validations/applicationTracking";
import { AdoptionApplicationRecord } from "@/types/application";
import { getVerifiedSession } from "@/lib/security/dal";
import { assertHasPermission, PERMISSIONS } from "@/lib/security/rbac";
import { checkRateLimit } from "@/lib/security/rateLimit";
import { withIdempotency } from "@/lib/security/idempotency";
import {
  getServerApplicationsAsync,
  insertServerApplication,
  atomicUpdateApplicationStatus,
  deleteServerApplication,
  findServerApplicationById,
  findServerApplicationByIdAsync,
  findServerApplicationByReferenceAsync,
  recordApplicationMilestones,
} from "@/lib/server/applicationRepository";
import {
  generateReferenceCode,
  normalizeReferenceCode,
  deriveApplicationProgress,
  combineInterviewDateTime,
  splitInterviewDateTime,
} from "@/lib/domain/applicationWorkflow";
import { findServerPetById } from "@/lib/server/petRepository";
import {
  sendApplicationConfirmationEmail,
  sendStaffApplicationAlert,
  sendApplicationStatusUpdateEmail,
  sendInterviewInvitationEmail,
} from "@/lib/email";
import { recordAuditLog } from "@/lib/domain/auditLog";

export async function getApplications(): Promise<AdoptionApplicationRecord[]> {
  const session = await getVerifiedSession();
  assertHasPermission(session, PERMISSIONS.VIEW_APPLICATIONS);

  return getServerApplicationsAsync();
}

const MAX_REFERENCE_CODE_ATTEMPTS = 5;

/** True for a Prisma unique-constraint violation naming the referenceCode index. */
function isReferenceCodeCollision(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const candidate = err as { code?: string; meta?: { target?: unknown } };
  if (candidate.code !== "P2002") return false;

  const target = candidate.meta?.target;
  const asText = Array.isArray(target) ? target.join(",") : String(target ?? "");
  return asText.includes("referenceCode");
}

/**
 * Inserts an application, allocating its public reference code.
 *
 * Uniqueness is enforced by the unique index, not by the generator: a losing
 * race surfaces as P2002 and is retried with a fresh code. Any other error
 * propagates untouched, so a genuine write failure is never mistaken for a
 * collision and silently retried.
 */
async function insertWithUniqueReferenceCode(
  draft: Omit<AdoptionApplicationRecord, "referenceCode">
): Promise<AdoptionApplicationRecord> {
  for (let attempt = 0; attempt < MAX_REFERENCE_CODE_ATTEMPTS; attempt += 1) {
    const candidate: AdoptionApplicationRecord = {
      ...draft,
      referenceCode: generateReferenceCode(),
    };

    try {
      await insertServerApplication(candidate);
      return candidate;
    } catch (err) {
      if (!isReferenceCodeCollision(err)) throw err;
    }
  }

  throw new Error("Could not allocate a unique application reference. Please try again.");
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

      const draft: Omit<AdoptionApplicationRecord, "referenceCode"> = {
        id: `app-${Date.now()}`,
        petId: validated.petId,
        petName: validated.petName,
        applicantName: validated.applicantName,
        email: validated.email,
        phone: validated.phone,
        address: validated.address,
        identification: validated.identification,
        housingType: validated.housingType,
        hasFencedYard: validated.hasFencedYard,
        landlordApproval: validated.landlordApproval,
        currentPets: validated.currentPets,
        currentPetDetails: validated.currentPetDetails,
        householdExperience: validated.householdExperience,
        vetClinic: validated.vetClinic,
        dailyAloneHours: validated.dailyAloneHours,
        applicantNotes: validated.applicantNotes,
        status: "SUBMITTED",
        adminReviewNotes: "",
        createdAt: today,
        updatedAt: today,
      };

      // The reference code's suffix is random, so uniqueness is guaranteed by
      // the unique index rather than by generation. A collision is a retry, not
      // a failed application — see generateReferenceCode's ceiling note.
      const newApp = await insertWithUniqueReferenceCode(draft);
      try {
        revalidatePath("/admin/applications");
        revalidatePath("/admin");
      } catch {
        // Safe outside Next.js runtime
      }

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
    const session = await getVerifiedSession();
    assertHasPermission(session, PERMISSIONS.REVIEW_APPLICATIONS);

    const validated = updateApplicationStatusSchema.parse(input);
    const existingApp = (await findServerApplicationByIdAsync(validated.id)) || findServerApplicationById(validated.id);

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

    try {
      revalidatePath("/admin/applications");
      revalidatePath("/admin/pets");
      revalidatePath("/pets");
      revalidatePath("/");
    } catch {
      // Safe outside Next.js runtime
    }

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
    const session = await getVerifiedSession();
    assertHasPermission(session, PERMISSIONS.REVIEW_APPLICATIONS);

    const validated = scheduleInterviewSchema.parse(input);
    const app = (await findServerApplicationByIdAsync(validated.applicationId)) || findServerApplicationById(validated.applicationId);

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

    // Record the interview as structured data. The formatted note above stays
    // for staff readability, but the public tracking portal now reads these
    // columns instead of parsing that text back out of the notes field.
    //
    // Only written when the date and time actually parse. Passing the null
    // through would clear whatever interview was already on the record, so an
    // unparseable time would silently un-schedule a real appointment; leaving
    // the columns alone instead means the note above still carries it, and the
    // legacy reader in `readInterviewDetails` still lights the step.
    const interviewAt = combineInterviewDateTime(validated.interviewDate, validated.interviewTime);
    if (interviewAt) {
      await recordApplicationMilestones(app.id, {
        interviewAt,
        interviewLocation: validated.location,
        interviewMeetingType: validated.meetingType,
      });
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

    try {
      revalidatePath("/admin/applications");
      revalidatePath("/admin");
    } catch {
      // Safe outside Next.js runtime
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to schedule interview";
    return { success: false, error: msg };
  }
}

/**
 * Records that a pre-adoption home visit took place.
 *
 * Deliberately not a status transition: the application stays UNDER_REVIEW
 * while the home visit happens, and this only lights the corresponding step in
 * the applicant's tracking portal. See
 * `tasks/decisions/2026-09-08-interview-and-home-visit-are-milestones-not-statuses.md`.
 */
export async function recordApplicationHomeVisit(
  input: RecordHomeVisitInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getVerifiedSession();
    assertHasPermission(session, PERMISSIONS.REVIEW_APPLICATIONS);

    const validated = recordHomeVisitSchema.parse(input);
    const app = (await findServerApplicationByIdAsync(validated.applicationId)) ||
      findServerApplicationById(validated.applicationId);

    if (!app) {
      return { success: false, error: "Application not found" };
    }

    const homeVisitAt = combineInterviewDateTime(validated.homeVisitDate, validated.homeVisitTime);
    if (!homeVisitAt) {
      return { success: false, error: "Home visit date and time could not be understood." };
    }

    const recorded = await recordApplicationMilestones(app.id, { homeVisitAt });
    if (!recorded) {
      return { success: false, error: "Failed to record the home visit." };
    }

    recordAuditLog({
      actorId: session.id,
      actorEmail: session.email,
      actorRole: session.role,
      action: "HOME_VISIT_RECORDED",
      entity: "AdoptionApplication",
      entityId: app.id,
      details: {
        petId: app.petId,
        petName: app.petName,
        applicantName: app.applicantName,
        homeVisitAt,
        coordinatorNotes: validated.coordinatorNotes,
      },
    });

    try {
      revalidatePath("/admin/applications");
      revalidatePath("/admin");
    } catch {
      // Safe outside Next.js runtime
    }

    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to record the home visit";
    return { success: false, error: msg };
  }
}

export async function deleteApplication(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getVerifiedSession();
    assertHasPermission(session, PERMISSIONS.DELETE_APPLICATIONS);

    const ok = await deleteServerApplication(id, session);
    if (!ok) {
      return { success: false, error: "Application not found" };
    }

    try {
      revalidatePath("/admin/applications");
    } catch {
      // Safe outside Next.js runtime
    }
    return { success: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to delete application";
    return { success: false, error: msg };
  }
}

/**
 * Reads an application's interview, preferring the structured milestone columns.
 *
 * ceiling: the second branch recovers interviews by regex from the free-text
 * `adminReviewNotes` field, which is how every interview scheduled before the
 * milestone columns existed was recorded. It is a read-only compatibility path
 * — nothing writes that format any more — and should be deleted once no
 * application predating those columns is still open.
 */
function readInterviewDetails(app: AdoptionApplicationRecord): PublicInterviewDetails | undefined {
  if (app.interviewAt) {
    const parts = splitInterviewDateTime(app.interviewAt);
    if (parts) {
      return {
        interviewDate: parts.date,
        interviewTime: parts.time,
        location: app.interviewLocation || "",
        meetingType: app.interviewMeetingType === "video_call" ? "video_call" : "in_person",
      };
    }
  }

  const notes = app.adminReviewNotes;
  if (!notes || !notes.includes("[Meet & Greet Scheduled:")) return undefined;

  const match = notes.match(
    /\[Meet & Greet Scheduled:\s*([0-9-]+)\s*at\s*([0-9:]+)\s*\(([^)]+)\)\s*-\s*Location:\s*([^\]]+)\]\s*(.*)/i
  );
  if (!match) return undefined;

  return {
    interviewDate: match[1],
    interviewTime: match[2],
    meetingType: match[3].toLowerCase().includes("virtual") ? "video_call" : "in_person",
    location: match[4].trim(),
    coordinatorNotes: match[5]?.trim() || undefined,
  };
}

/**
 * Public, rate-limited, privacy-safe status lookup for adoption applicants.
 */
export async function lookupApplicationStatusAction(
  input: TrackApplicationLookupInput
): Promise<{ success: boolean; data?: PublicApplicationTrackingDTO; error?: string }> {
  try {
    const validated = trackApplicationLookupSchema.parse(input);

    // 1. Rate Limiting: max 15 lookup attempts per 5 minutes per email/IP
    const rateLimit = checkRateLimit(`track-app:${validated.email}`, 15, 300000);
    if (!rateLimit.success) {
      return {
        success: false,
        error: `Too many lookup attempts. Please wait ${rateLimit.retryAfterSeconds}s before trying again.`,
      };
    }

    // 2. Resolve the claim. The reference code is what the applicant was given;
    //    a bare id is still accepted so applications submitted before reference
    //    codes existed remain trackable.
    const reference = normalizeReferenceCode(validated.referenceId);
    const app = await findServerApplicationByReferenceAsync(reference);

    // Authorization: the reference code alone proves nothing. The email on the
    // record must match, and both misses return the same message so the portal
    // cannot be used to test whether a reference code exists.
    if (!app || app.email.trim().toLowerCase() !== validated.email) {
      return {
        success: false,
        error:
          "No application matching this reference code and email combination was found. Please check your reference code.",
      };
    }

    // 3. Enrich with live pet profile data if available
    const pet = app.petId ? findServerPetById(app.petId) : null;

    // 4. Interview details, structured columns first.
    const interviewDetails = readInterviewDetails(app);

    // 5. Milestone progress, derived from evidence rather than status alone.
    const progress = deriveApplicationProgress({
      status: app.status,
      // A legacy row carries its interview only in the notes; treat a parsed
      // note as the same evidence a real interviewAt column would provide.
      interviewAt: app.interviewAt ?? (interviewDetails ? app.updatedAt : null),
      homeVisitAt: app.homeVisitAt,
    });

    // 6. Construct public-safe sanitized DTO. Built field by field, never
    //    spread: `identification` (NRIC/passport), phone and address must not
    //    cross to an unauthenticated caller, and a future column must not
    //    publish itself by being added to the record.
    const publicDto: PublicApplicationTrackingDTO = {
      id: app.id,
      referenceCode: app.referenceCode,
      petId: app.petId,
      petName: app.petName,
      petBreed: pet?.breed || app.petBreed,
      petSpecies: pet?.species,
      petImage: pet?.image,
      applicantName: app.applicantName,
      status: app.status,
      createdAt: app.createdAt,
      updatedAt: app.updatedAt,
      publicNotes:
        app.adminReviewNotes && !app.adminReviewNotes.startsWith("[Meet & Greet")
          ? app.adminReviewNotes
          : undefined,
      interviewDetails,
      milestone: progress.currentMilestone,
      milestoneIndex: progress.currentIndex,
      homeVisitAt: app.homeVisitAt ?? null,
    };

    return { success: true, data: publicDto };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Failed to lookup application status";
    return { success: false, error: msg };
  }
}
