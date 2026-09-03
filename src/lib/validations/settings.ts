import * as z from "zod";
import { optionalQrImageUrl, optionalQrPayload } from "@/lib/validations/qrImage";
import {
  DEFAULT_VOLUNTEER_FORM_URL,
  DEFAULT_VOLUNTEER_FORM_RESPONSES_URL,
} from "@/lib/volunteerFormUrl";

// Re-exported for server-side importers. Client components must import from
// "@/lib/volunteerFormUrl" directly, so they do not pull zod into their bundle.
export {
  DEFAULT_VOLUNTEER_FORM_URL,
  DEFAULT_VOLUNTEER_FORM_RESPONSES_URL,
  isPlaceholderFormUrl,
  isSafeExternalUrl,
  isUsableFormUrl,
} from "@/lib/volunteerFormUrl";

export const shelterSettingsSchema = z.object({
  shelterName: z.string().min(2, "Shelter name is required"),
  email: z.string().email("Valid email required"),
  phone: z.string().min(5, "Contact phone is required"),
  address: z.string().min(5, "Physical address is required"),
  operatingHours: z.string().min(5, "Operating hours are required"),
  announcementBanner: z.string().optional().default(""),
  adoptionFeeDog: z.string().min(1, "Dog adoption fee is required"),
  adoptionFeeCat: z.string().min(1, "Cat adoption fee is required"),

  // Donation QR codes. Each is either an /uploads/... path or an absolute
  // http(s) URL; paymentPayload is a DuitNow/bank string we render ourselves.
  duitNowQrUrl: optionalQrImageUrl,
  tngQrUrl: optionalQrImageUrl,
  bankQrUrl: optionalQrImageUrl,
  paymentPayload: optionalQrPayload,

  // Volunteer intake (external Google Form).
  // The protocol is pinned because Zod's z.url() accepts `javascript:` and `data:`,
  // and these values are rendered straight into an href.
  // `.or(z.literal(""))` matters: an emptied react-hook-form input submits "", not
  // undefined, so ZodDefault never fires and a bare .url() would reject it, blocking
  // the whole settings form and making the fields impossible to unset once set.
  volunteerFormUrl: z
    .url({
      protocol: /^https?$/,
      error: "Enter a valid http(s) volunteer form URL, e.g. https://forms.gle/abc123",
    })
    .or(z.literal(""))
    .optional()
    .default(DEFAULT_VOLUNTEER_FORM_URL),
  volunteerFormResponsesUrl: z
    .url({
      protocol: /^https?$/,
      error: "Enter a valid http(s) responses sheet URL",
    })
    .or(z.literal(""))
    .optional()
    .default(DEFAULT_VOLUNTEER_FORM_RESPONSES_URL),

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
