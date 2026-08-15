import * as z from "zod";
import { ApplicationStatus } from "@/types/application";

export const trackApplicationLookupSchema = z.object({
  referenceId: z
    .string()
    .trim()
    .min(3, "Please enter your Application Reference ID (e.g. app-123456)"),
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

export interface PublicApplicationTrackingDTO {
  id: string;
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
}
