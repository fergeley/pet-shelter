import { z } from "zod";

export const REHAB_NEED_CATEGORIES = [
  "URGENT",
  "REGULAR",
  "LONG_TERM",
  "TNRM_EQUIPMENT",
  "MEDICAL",
  "FACILITY",
  "NUTRITION",
] as const;

export const rehabNeedCategorySchema = z.enum(REHAB_NEED_CATEGORIES);

export const REHAB_URGENCY_LEVELS = ["Critical", "High", "Normal", "Low"] as const;

export const rehabUrgencyLevelSchema = z.enum(REHAB_URGENCY_LEVELS).or(z.string());

export const rehabNeedSchema = z.object({
  id: z.string().min(1, "Need ID is required"),
  category: rehabNeedCategorySchema,
  categoryLabel: z.string().min(1, "Category label is required"),
  categoryLabelMs: z.string().min(1, "Malay category label is required"),
  name: z.string().min(1, "Need name is required"),
  nameMs: z.string().min(1, "Malay need name is required"),
  description: z.string().min(1, "Description is required"),
  descriptionMs: z.string().min(1, "Malay description is required"),
  quantityNeeded: z.string().min(1, "Quantity needed is required"),
  urgencyLevel: rehabUrgencyLevelSchema,
  estimatedCostMYR: z.number().nonnegative().optional(),
  shopeeLink: z.string().url().optional().or(z.literal("")),
  brand: z.string().optional(),
});

export const rehabFilterSchema = z.object({
  category: z.string().optional(),
  search: z.string().optional(),
}).optional();

export type RehabNeedInput = z.infer<typeof rehabNeedSchema>;
export type RehabFilterInput = z.infer<typeof rehabFilterSchema>;
