import { z } from "zod";

import {
  isAllowedBulletinEmbedUrl,
  isAllowedBulletinImageUrl,
  BULLETIN_EMBED_HOSTS,
} from "@/lib/domain/bulletinMedia";

/**
 * The bulletin category vocabulary.
 *
 * One of four places this list appears, all held in step deliberately: the
 * `BulletinCategory` union in `@/types/bulletin`, the `BulletinCategory` enum in
 * `prisma/schema.prisma`, the `BULLETIN_CATEGORY_PRESENTATION` table in
 * `@/lib/presentation/bulletinPresentation`, and here. The first three are
 * checked against each other by a compile-time assertion in
 * `@/lib/server/bulletinRepository`; this schema is checked against the union by
 * `tests/unit/bulletins.test.ts`.
 */
export const BULLETIN_CATEGORIES = [
  "announcement",
  "urgent_need",
  "event",
  "happy_tail",
  "clinic",
] as const;

export const BULLETIN_TARGET_PAGES = ["all", "home", "pets", "bulletins"] as const;

export const BULLETIN_MEDIA_TYPES = ["none", "image", "video"] as const;

export const bulletinCategorySchema = z.enum(BULLETIN_CATEGORIES);
export const bulletinTargetPageSchema = z.enum(BULLETIN_TARGET_PAGES);
export const bulletinMediaTypeSchema = z.enum(BULLETIN_MEDIA_TYPES);

/** Empty textarea → `undefined`, so clearing a field removes it instead of storing "". */
const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, `${label} is too long (maximum ${max.toLocaleString()} characters)`)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined));

const optionalUrl = (check: (url: string) => boolean, message: string) =>
  z
    .string()
    .trim()
    .max(2048, "URL is too long (maximum 2,048 characters)")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined))
    .refine((v) => v === undefined || check(v), { message });

/**
 * Payload accepted by the admin create/update actions.
 *
 * Note what is NOT here: `authorName`. The byline is taken from the verified
 * session by the action, never from the form — otherwise any CONTENT_EDITOR
 * could publish a notice under a colleague's name, or under "Veterinary Team"
 * without being on it. `id`, `createdAt` and `updatedAt` are likewise the
 * database's to set.
 *
 * Malay fields are optional: staff may publish an English notice and translate
 * it later, and the repository resolves the English copy in its place on read.
 */
export const bulletinFormSchema = z
  .object({
    category: bulletinCategorySchema,
    targetPage: bulletinTargetPageSchema.default("all"),
    title: z
      .string()
      .trim()
      .min(8, "Title must be at least 8 characters")
      .max(200, "Title is too long (maximum 200 characters)"),
    content: z
      .string()
      .trim()
      .min(15, "Content must be at least 15 characters")
      .max(5000, "Content is too long (maximum 5,000 characters)"),
    titleMs: optionalText(200, "Malay title"),
    contentMs: optionalText(5000, "Malay content"),
    mediaType: bulletinMediaTypeSchema.default("none"),
    mediaUrl: optionalUrl(
      isAllowedBulletinImageUrl,
      "Image URL must be an https link on a host this site is configured to load " +
        "(see images.remotePatterns in next.config.ts). An image elsewhere will not render."
    ),
    videoEmbedUrl: optionalUrl(
      isAllowedBulletinEmbedUrl,
      `Video embed URL must be an https link on one of: ${BULLETIN_EMBED_HOSTS.join(", ")}.`
    ),
    isPinned: z.boolean().default(false),
    isPublished: z.boolean().default(true),
    /**
     * The notice date the card prints. Accepted as `YYYY-MM-DD` rather than a
     * datetime because that is what an editor is choosing — a day, not an
     * instant — and because a datetime would drag the browser's timezone into a
     * value the shelter means locally.
     */
    publishedAt: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD form")
      .refine((v) => !Number.isNaN(Date.parse(`${v}T00:00:00Z`)), {
        message: "That date does not exist",
      }),
  })
  /**
   * A card renders media only when `mediaType` says so, so a type without its
   * URL is a notice whose picture silently never appears — the editor saved
   * what looked like a complete form and got a plain card. Caught here rather
   * than shrugged off at render time.
   */
  .refine((v) => v.mediaType !== "image" || !!v.mediaUrl, {
    message: "Choose an image URL, or set media type to None.",
    path: ["mediaUrl"],
  })
  .refine((v) => v.mediaType !== "video" || !!v.videoEmbedUrl, {
    message: "Choose a video embed URL, or set media type to None.",
    path: ["videoEmbedUrl"],
  });

export type BulletinFormInput = z.input<typeof bulletinFormSchema>;
export type BulletinFormValues = z.output<typeof bulletinFormSchema>;
