import { z } from "zod";

export const faqCategoryEnum = z.enum([
  "ADOPTION",
  "VOLUNTEERING",
  "ANIMAL_CARE",
  "SHELTER_INFO",
]);

export type FaqCategoryValue = z.infer<typeof faqCategoryEnum>;

/**
 * Payload accepted by the admin create/update FAQ actions.
 *
 * Bahasa Malaysia fields are optional: staff may publish an English-only entry
 * and translate it later. Empty strings are normalised to `undefined` so a
 * cleared textarea removes the translation instead of storing "".
 */
export const faqFormSchema = z.object({
  category: faqCategoryEnum,
  question: z
    .string()
    .trim()
    .min(8, "Question must be at least 8 characters")
    .max(300, "Question is too long (maximum 300 characters)"),
  answer: z
    .string()
    .trim()
    .min(15, "Answer must be at least 15 characters")
    .max(5000, "Answer is too long (maximum 5,000 characters)"),
  questionMs: z
    .string()
    .trim()
    .max(300, "Malay question is too long (maximum 300 characters)")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  answerMs: z
    .string()
    .trim()
    .max(5000, "Malay answer is too long (maximum 5,000 characters)")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  displayOrder: z.coerce
    .number({ message: "Display order must be a number" })
    .int("Display order must be a whole number")
    .min(0, "Display order cannot be negative")
    .max(9999, "Display order is too large")
    .default(0),
  isPublished: z.boolean().default(true),
});

export type FaqFormInput = z.input<typeof faqFormSchema>;
export type FaqFormValues = z.output<typeof faqFormSchema>;

/** Filter applied to the public `/faq` listing. */
export const faqFilterSchema = z.object({
  category: faqCategoryEnum.or(z.literal("all")).default("all"),
  search: z.string().max(200).default(""),
});

export type FaqFilterInput = z.infer<typeof faqFilterSchema>;
