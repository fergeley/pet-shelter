import * as z from "zod";

export const petFormSchema = z.object({
  name: z.string().min(1, "Pet name is required").max(60, "Name is too long"),
  species: z.enum(["dog", "cat", "other"]),
  breed: z.string().min(1, "Breed is required"),
  age: z.string().min(1, "Age description is required (e.g. '2 years')"),
  ageCategory: z.enum(["puppy_kitten", "young", "adult", "senior"]),
  gender: z.enum(["Male", "Female"]),
  size: z.enum(["Small", "Medium", "Large"]),
  weight: z.string().min(1, "Weight is required (e.g. '18 kg')"),
  status: z.enum(["Available", "Pending", "Adopted"]),
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

  // Soft Delete
  isArchived: z.boolean().optional().default(false),
  deletedAt: z.string().nullable().optional(),
});

export type PetFormInput = z.input<typeof petFormSchema>;
export type PetFormOutput = z.output<typeof petFormSchema>;

export const petFilterSchema = z.object({
  species: z.enum(["all", "dog", "cat", "other"]).optional().default("all"),
  status: z.enum(["all", "Available", "Pending", "Adopted"]).optional().default("all"),
  ageCategory: z.enum(["all", "puppy_kitten", "young", "adult", "senior"]).optional().default("all"),
  size: z.enum(["all", "Small", "Medium", "Large"]).optional().default("all"),
  search: z.string().optional().default(""),
  isArchived: z.boolean().optional(),
});

export type PetFilterInput = {
  species?: "all" | "dog" | "cat" | "other";
  status?: "all" | "Available" | "Pending" | "Adopted";
  ageCategory?: "all" | "puppy_kitten" | "young" | "adult" | "senior";
  size?: "all" | "Small" | "Medium" | "Large";
  search?: string;
  isArchived?: boolean;
};
