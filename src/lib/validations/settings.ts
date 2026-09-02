import * as z from "zod";
import { optionalQrImageUrl, optionalQrPayload } from "@/lib/validations/qrImage";

export const shelterSettingsSchema = z.object({
  shelterName: z.string().min(2, "Shelter name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(5, "Contact phone is required"),
  address: z.string().min(5, "Physical address is required"),
  operatingHours: z.string().min(5, "Operating hours are required"),
  announcementBanner: z.string().optional().default(""),
  adoptionFeeDog: z.string().min(1, "Dog adoption fee is required"),
  adoptionFeeCat: z.string().min(1, "Cat adoption fee is required"),

  // Donation QR codes. Each is either an /uploads/... path or an https URL;
  // paymentPayload is a DuitNow/bank string we render to an SVG QR ourselves.
  duitNowQrUrl: optionalQrImageUrl,
  tngQrUrl: optionalQrImageUrl,
  bankQrUrl: optionalQrImageUrl,
  paymentPayload: optionalQrPayload,

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
