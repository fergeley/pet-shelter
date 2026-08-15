import * as z from "zod";

export const shelterSettingsSchema = z.object({
  shelterName: z.string().min(2, "Shelter name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(5, "Contact phone is required"),
  address: z.string().min(5, "Physical address is required"),
  operatingHours: z.string().min(5, "Operating hours are required"),
  announcementBanner: z.string().optional().default(""),
  adoptionFeeDog: z.string().min(1, "Dog adoption fee is required"),
  adoptionFeeCat: z.string().min(1, "Cat adoption fee is required"),

  // Email Configuration (Optional overrides)
  resendApiKey: z.string().optional().default(""),
  emailFrom: z.string().optional().default("Hope for Strays <onboarding@resend.dev>"),
  shelterNotificationEmail: z.string().email().or(z.literal("")).optional().default(""),

  // Storage Configuration (Optional overrides)
  storageProvider: z.enum(["local", "s3", "cloudinary"]).optional().default("local"),
  s3Bucket: z.string().optional().default(""),
  s3Region: z.string().optional().default("ap-southeast-1"),
  s3CdnUrl: z.string().optional().default(""),
  cloudinaryCloudName: z.string().optional().default(""),
});

export type ShelterSettingsInput = z.input<typeof shelterSettingsSchema>;
export type ShelterSettingsOutput = z.output<typeof shelterSettingsSchema>;
