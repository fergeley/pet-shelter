import * as z from "zod";

export const applicationFormSchema = z.object({
  petId: z.string().min(1, "Please select an adoptable pet"),
  petName: z.string().min(1, "Pet name is required"),
  applicantName: z.string().min(2, "Please enter your full name"),
  email: z.string().email("Please enter a valid email address"),
  phone: z.string().min(9, "Please enter a valid Malaysian phone number"),
  address: z.string().min(5, "Please provide your residential address and city"),
  housingType: z.enum(["landed_terrace", "semi_d_bungalow", "condo_apartment", "townhouse", "other"]),
  hasFencedYard: z.enum(["yes", "no", "not_applicable"]),
  currentPets: z.enum(["none", "dogs", "cats", "both", "other"]),
  currentPetDetails: z.string().optional(),
  householdExperience: z.enum(["first_time", "some_experience", "experienced"]),
  applicantNotes: z.string().optional(),
});

export type ApplicationFormInput = z.infer<typeof applicationFormSchema>;

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
