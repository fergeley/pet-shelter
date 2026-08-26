import { z } from "zod";

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
  categoryLabel: z.string().min(1, "Category label is required"),
  categoryLabelMs: z.string().min(1, "Malay category label is required"),
  question: z.string().min(1, "Question is required"),
  questionMs: z.string().min(1, "Malay question is required"),
  answer: z.string().min(1, "Answer is required"),
  answerMs: z.string().min(1, "Malay answer is required"),
});

export const faqFilterSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
}).optional();

export type FaqItemInput = z.infer<typeof faqItemSchema>;
export type FaqFilterInput = z.infer<typeof faqFilterSchema>;
