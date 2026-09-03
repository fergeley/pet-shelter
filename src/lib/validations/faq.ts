import { z } from "zod";

/**
 * The FAQ category vocabulary.
 *
 * One of four places this list appears, all held in step deliberately:
 * the `FaqCategory` union in `@/types/faq`, the `FaqCategory` enum in
 * `prisma/schema.prisma`, the `FAQ_CATEGORY_LABELS` table in
 * `@/lib/presentation/categoryTabs`, and here. The first three are checked
 * against each other by a compile-time assertion in
 * `@/lib/server/faqRepository`; this schema is checked against the union by
 * `tests/unit/faqs.test.ts`.
 */
export const FAQ_CATEGORIES = [
  "tnrm",
  "sponsorship",
  "adoption",
  "visiting",
  "get_involved",
  "general",
  "medical",
] as const;

export const faqCategorySchema = z.enum(FAQ_CATEGORIES);

export const faqItemSchema = z.object({
  id: z.string().min(1, "FAQ ID is required"),
  category: faqCategorySchema,
  question: z.string().min(1, "Question is required"),
  questionMs: z.string().min(1, "Malay question is required"),
  answer: z.string().min(1, "Answer is required"),
  answerMs: z.string().min(1, "Malay answer is required"),
});

export const faqFilterSchema = z
  .object({
    category: z.string().optional(),
    search: z.string().optional(),
  })
  .optional();

/**
 * Payload accepted by the admin create/update actions.
 *
 * Malay fields are optional here, unlike `faqItemSchema` above, which validates
 * the committed fixture. Staff may publish an English entry and translate it
 * later; the repository resolves the English copy in its place on read. Empty
 * strings normalise to `undefined` so clearing a textarea removes the
 * translation instead of storing "" — which would defeat that resolution and
 * render a blank Malay question.
 */
export const faqFormSchema = z.object({
  category: faqCategorySchema,
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

export type FaqItemInput = z.infer<typeof faqItemSchema>;
export type FaqFilterInput = z.infer<typeof faqFilterSchema>;
export type FaqFormInput = z.input<typeof faqFormSchema>;
export type FaqFormValues = z.output<typeof faqFormSchema>;
