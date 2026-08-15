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
});

export type ShelterSettingsInput = z.infer<typeof shelterSettingsSchema>;
