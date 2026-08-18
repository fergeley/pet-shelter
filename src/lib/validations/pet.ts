import * as z from "zod";

import { PetStatus } from "@/types/pet";
import { normalizePetStatus } from "@/lib/domain/stateMachine";

/**
 * Canonical pet lifecycle statuses. "Rehabilitation" is a legacy alias of
 * "In Rehabilitation" and is accepted on input for stored records.
 */
export const PET_STATUS_VALUES = [
  "Available",
  "Pending",
  "Adopted",
  "In Rehabilitation",
  "Rehabilitation",
] as const;

export const PET_STATUS_FILTER_VALUES = ["all", ...PET_STATUS_VALUES] as const;

/** Statuses that denote an animal still under clinical or behavioural care. */
export const REHABILITATION_STATUSES: readonly PetStatus[] = ["In Rehabilitation", "Rehabilitation"];

/** True when the status denotes an animal under care, in either spelling. */
export function isRehabilitationStatus(status: PetStatus): boolean {
  return normalizePetStatus(status) === "In Rehabilitation";
}

/** Rehabilitation progress fields — only meaningful while a pet is under care. */
const REHAB_FIELDS = ["rehabStage", "rehabStageMs", "rehabProgressPercent"] as const;

export const petBaseFormSchema = z.object({
  name: z.string().min(1, "Pet name is required").max(60, "Name is too long"),
  species: z.enum(["dog", "cat", "other"]),
  breed: z.string().min(1, "Breed is required"),
  age: z.string().min(1, "Age description is required (e.g. '2 years')"),
  ageCategory: z.enum(["puppy_kitten", "young", "adult", "senior"]),
  gender: z.enum(["Male", "Female"]),
  size: z.enum(["Small", "Medium", "Large"]),
  weight: z.string().min(1, "Weight is required (e.g. '18 kg')"),
  status: z.enum(PET_STATUS_VALUES),
  adoptionFee: z.string().min(1, "Adoption fee is required (e.g. 'Free')"),
  description: z.string().min(10, "Please provide at least a brief description (10+ characters)"),
  rescueStory: z.string().min(10, "Please provide the rescue background story"),
  image: z.string().url("Please provide a valid image URL"),
  galleryImages: z.array(z.string().url()).optional().default([]),
  tags: z.array(z.string()).min(1, "Please provide at least 1 characteristic tag"),
  featured: z.boolean().default(false),
  intakeDate: z.string().min(4, "Intake date is required"),
  
  // Medical
  vaccinated: z.boolean().default(true),
  microchipped: z.boolean().default(true),
  spayedNeutered: z.boolean().default(true),
  specialNeeds: z.string().optional(),

  // Compatibility
  goodWithDogs: z.boolean().default(true),
  goodWithCats: z.boolean().default(true),
  goodWithKids: z.boolean().default(true),
  energyLevel: z.enum(["Low", "Moderate", "High"]).default("Moderate"),

  // Rehabilitation progress (only valid while the pet is under care)
  rehabStage: z.string().min(1, "Rehabilitation stage cannot be blank").optional(),
  rehabStageMs: z.string().min(1, "Rehabilitation stage (BM) cannot be blank").optional(),
  rehabProgressPercent: z
    .number()
    .int("Rehabilitation progress must be a whole percentage")
    .min(0, "Rehabilitation progress cannot be below 0%")
    .max(100, "Rehabilitation progress cannot exceed 100%")
    .optional(),

  // Soft Delete
  isArchived: z.boolean().optional().default(false),
  deletedAt: z.string().nullable().optional(),
});

/**
 * Full pet form contract. Rehabilitation details are rejected on pets that are
 * not under care, so a cleared animal cannot keep a stale progress bar.
 */
export const petFormSchema = petBaseFormSchema.superRefine((data, ctx) => {
  if (isRehabilitationStatus(data.status)) return;

  for (const field of REHAB_FIELDS) {
    if (data[field] === undefined) continue;
    ctx.addIssue({
      code: "custom",
      path: [field],
      message: `'${field}' is only allowed while the pet status is 'In Rehabilitation' (received '${data.status}')`,
    });
  }
});

export type PetFormInput = z.input<typeof petBaseFormSchema>;
export type PetFormOutput = z.output<typeof petBaseFormSchema>;

export const petFilterSchema = z.object({
  species: z.enum(["all", "dog", "cat", "other"]).optional().default("all"),
  status: z.enum(PET_STATUS_FILTER_VALUES).optional().default("all"),
  ageCategory: z.enum(["all", "puppy_kitten", "young", "adult", "senior"]).optional().default("all"),
  size: z.enum(["all", "Small", "Medium", "Large"]).optional().default("all"),
  search: z.string().optional().default(""),
  isArchived: z.boolean().optional(),
});

export type PetFilterInput = {
  species?: "all" | "dog" | "cat" | "other";
  status?: PetStatus | "all";
  ageCategory?: "all" | "puppy_kitten" | "young" | "adult" | "senior";
  size?: "all" | "Small" | "Medium" | "Large";
  search?: string;
  isArchived?: boolean;
};
