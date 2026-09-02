import { z } from "zod";

export const donationTierEnum = z.enum([
  "kibble",
  "vaccine",
  "spay_neuter",
  "emergency_medical",
  "custom",
]);

export const donationFrequencyEnum = z.enum(["one_time", "monthly"]);
export const paymentMethodEnum = z.enum(["duitnow_qr", "online_banking", "card"]);

export const donationPledgeSchema = z.object({
  donorName: z
    .string()
    .min(2, "Donor name must be at least 2 characters")
    .max(100, "Donor name is too long"),
  donorEmail: z
    .string()
    .email("Please provide a valid email address for receipt dispatch"),
  donorPhone: z
    .string()
    .max(25, "Phone number is too long")
    .optional()
    .or(z.literal("")),
  tierId: donationTierEnum.default("vaccine"),
  tierName: z.string().optional(),
  amountMYR: z.coerce
    .number({ message: "Donation amount must be a number" })
    .min(5, "Minimum donation amount is RM 5.00")
    .max(100000, "Maximum single donation amount is RM 100,000.00"),
  frequency: donationFrequencyEnum.default("one_time"),
  targetPetName: z
    .string()
    .max(100, "Pet dedication name is too long")
    .optional()
    .or(z.literal("")),
  /** Set when the pledge is made from a specific pet's profile, so "My Rescues" can link it. */
  targetPetId: z
    .string()
    .max(64, "Pet identifier is too long")
    .optional()
    .or(z.literal("")),
  /**
   * Public Sponsor Wall opt-in, captured at checkout.
   *
   * Recorded against this pledge rather than against a donor account, because most
   * donors have no account at the moment they give. The consent carries into the account
   * when they later claim it in `registerSponsorAction`.
   */
  displayOnWall: z.boolean().default(false),
  paymentMethod: paymentMethodEnum.default("duitnow_qr"),
  taxIdOrIc: z
    .string()
    .max(30, "Tax ID / IC / SSM number is too long")
    .optional()
    .or(z.literal("")),
  notes: z
    .string()
    .max(500, "Note to shelter must be under 500 characters")
    .optional()
    .or(z.literal("")),
});

/**
 * What a caller *sends*. Uses `z.input`, not `z.infer`: fields carrying `.default()`
 * (`tierId`, `frequency`, `paymentMethod`, `displayOnWall`) are optional on the way in
 * and guaranteed on the way out. `z.infer` is the output type, which would force every
 * caller to restate every default.
 */
export type DonationPledgeInput = z.input<typeof donationPledgeSchema>;

/** The validated pledge, with every default resolved. */
export type DonationPledgeParsed = z.output<typeof donationPledgeSchema>;

export interface DonationReceiptDTO {
  receiptNumber: string;
  date: string;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  tierId: z.infer<typeof donationTierEnum>;
  tierName: string;
  amountMYR: number;
  frequency: "one_time" | "monthly";
  paymentMethod: "duitnow_qr" | "online_banking" | "card";
  targetPetName?: string;
  taxIdOrIc?: string;
  notes?: string;
  taxDeductibleRef: string;
  shelterRegistrationNo: string;
}
