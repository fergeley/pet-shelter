import * as z from "zod";
import { ApplicationStatus } from "@/types/application";
import { ApplicationMilestone } from "@/lib/domain/applicationWorkflow";

export const trackApplicationLookupSchema = z.object({
  referenceId: z
    .string()
    .trim()
    .min(3, "Please enter your application reference code (e.g. HFS-APP-202609-K7QM)"),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Please enter a valid email address"),
});

export type TrackApplicationLookupInput = z.input<typeof trackApplicationLookupSchema>;
export type TrackApplicationLookupOutput = z.output<typeof trackApplicationLookupSchema>;

export interface PublicInterviewDetails {
  interviewDate: string;
  interviewTime: string;
  location: string;
  meetingType: "in_person" | "video_call";
  coordinatorNotes?: string;
  coordinatorName?: string;
}

/**
 * The only application data that crosses to an unauthenticated caller.
 *
 * Built field-by-field in `lookupApplicationStatusAction` rather than by
 * spreading the record, so a column added to `AdoptionApplicationRecord` is
 * never published by accident. `identification` (NRIC/passport), `phone`,
 * `address` and the internal `adminReviewNotes` are all deliberately absent.
 */
export interface PublicApplicationTrackingDTO {
  id: string;
  referenceCode?: string;
  petId: string | null;
  petName: string;
  petBreed?: string;
  petSpecies?: string;
  petImage?: string;
  applicantName: string;
  status: ApplicationStatus;
  createdAt: string;
  updatedAt: string;
  publicNotes?: string;
  interviewDetails?: PublicInterviewDetails;

  /** Milestone progress, derived server-side so the page renders one answer. */
  milestone: ApplicationMilestone;
  milestoneIndex: number;
  homeVisitAt?: string | null;
}
