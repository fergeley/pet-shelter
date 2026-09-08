import * as z from "zod";

/**
 * The canonical adoption application contract.
 *
 * This is the single definition of an application's shape. The client form
 * schema below is built from it with `.extend()` rather than being written out
 * a second time, because the two used to be separate objects with different
 * field names (`applicantEmail` here, `email` there) reconciled by a hand-map
 * in the form controller. Every field added to one had to be remembered in the
 * other two places, and nothing failed when it wasn't.
 *
 * Field names match the persisted record and the public DTO, so the client can
 * submit its values straight through.
 */
export const applicationFormSchema = z.object({
  petId: z.string().min(1, "Please select an adoptable pet"),
  petName: z.string().min(1, "Pet name is required"),

  // Step 1 — contact and identification
  applicantName: z.string().min(2, "Please enter your full name"),
  email: z.string().trim().toLowerCase().email("Please enter a valid email address"),
  phone: z.string().min(9, "Please enter a valid Malaysian phone number"),
  identification: z
    .string()
    .trim()
    .min(6, "Please enter your NRIC or passport number")
    .max(20, "That does not look like an NRIC or passport number"),
  address: z.string().min(5, "Please provide your residential address and city"),

  // Step 2 — living environment
  housingType: z.enum(["landed_terrace", "semi_d_bungalow", "condo_apartment", "townhouse", "other"]),
  hasFencedYard: z.enum(["yes", "no", "not_applicable"]),
  landlordApproval: z.enum(["owner_occupied", "obtained", "pending", "not_permitted"]),

  // Step 3 — experience and care plan
  currentPets: z.enum(["none", "dogs", "cats", "both", "other"]),
  currentPetDetails: z.string().optional(),
  householdExperience: z.enum(["first_time", "some_experience", "experienced"]),
  vetClinic: z.string().trim().min(2, "Please name the clinic you intend to use"),
  dailyAloneHours: z.enum(["under_4", "4_to_8", "8_to_12", "over_12"]),

  applicantNotes: z.string().optional(),
});

export type ApplicationFormInput = z.infer<typeof applicationFormSchema>;

/**
 * What the multi-step form binds to: the canonical contract plus the consent
 * checkboxes, which are gates on submission rather than data the shelter keeps.
 */
export const adoptionFormSchema = applicationFormSchema.extend({
  agreeToTerms: z.boolean().refine((val) => val === true, {
    message: "Please agree to the adoption terms to submit your application",
  }),
  agreeToHomeVisit: z.boolean().refine((val) => val === true, {
    message: "Please consent to a home check before submitting",
  }),
});

export type AdoptionFormValues = z.infer<typeof adoptionFormSchema>;

/**
 * Narrows form values to exactly the canonical contract.
 *
 * Parsing against `applicationFormSchema` rather than deleting the two consent
 * keys by hand means the wire payload is defined by the schema in one place:
 * Zod drops whatever the contract does not declare, so a field added to the
 * form but not to the contract cannot silently reach the server action.
 * Replaces the two hand-written field maps that lived in the form controller.
 */
export function toApplicationInput(values: AdoptionFormValues): ApplicationFormInput {
  return applicationFormSchema.parse(values);
}

export const updateApplicationStatusSchema = z.object({
  id: z.string().min(1),
  status: z.enum(["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"]),
  adminReviewNotes: z.string().optional(),
  notifyApplicant: z.boolean().optional(),
});

export type UpdateApplicationStatusInput = z.input<typeof updateApplicationStatusSchema>;

export const scheduleInterviewSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required"),
  interviewDate: z.string().min(1, "Interview date is required"),
  interviewTime: z.string().min(1, "Interview time is required"),
  location: z.string().min(1, "Location or meeting link is required"),
  meetingType: z.enum(["in_person", "video_call"]).optional().default("in_person"),
  coordinatorNotes: z.string().optional(),
  notifyApplicant: z.boolean().optional(),
});

export type ScheduleInterviewInput = z.input<typeof scheduleInterviewSchema>;

export const recordHomeVisitSchema = z.object({
  applicationId: z.string().min(1, "Application ID is required"),
  homeVisitDate: z.string().min(1, "Home visit date is required"),
  homeVisitTime: z.string().min(1, "Home visit time is required"),
  coordinatorNotes: z.string().optional(),
});

export type RecordHomeVisitInput = z.input<typeof recordHomeVisitSchema>;
