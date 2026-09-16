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
  paymentMethod: paymentMethodEnum.default("duitnow_qr"),
  /**
   * The donor intends to claim Section 44(6) relief on this gift.
   *
   * Deliberately **not persisted**. `Donation.taxIdOrIc` already records whether an
   * issued receipt carries a claimable identifier, so a column here would be a
   * second, divergible answer to one question. This flag decides which fields the
   * form requires and nothing else, which is why it lives in the validator rather
   * than in the ledger.
   *
   * `z.boolean()`, not `z.coerce.boolean()`: coercion is `Boolean(value)`, so the
   * string `"false"` would arrive as `true` and silently require a tax number from
   * a donor who declined one.
   *
   * `.optional()`, not `.default(false)`: `DonationPledgeInput` is `z.infer`, which
   * is the schema's *output* type, and a defaulted field is required there. That
   * would have made every existing caller — `useSponsorshipController` among them —
   * fail to compile for a flag they have no opinion about. Absent means the donor
   * did not ask for relief, which is what the form did before this field existed.
   */
  wantsTaxReceipt: z.boolean().optional(),
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
}).superRefine((pledge, ctx) => {
  // A receipt is issued for every donation either way — the ledger is the shelter's
  // complete record of money received, so opting out of relief must not create a
  // donation the series never saw. What the flag changes is whether the receipt can
  // actually be claimed: without an identifier it is a thank-you, not a tax document.
  // Marking the field required in the form while accepting it as absent here is how a
  // donor ends up holding a "tax-deductible" receipt they cannot file.
  if (!pledge.wantsTaxReceipt) return;

  if (!pledge.taxIdOrIc || pledge.taxIdOrIc.trim() === "") {
    ctx.addIssue({
      code: "custom",
      path: ["taxIdOrIc"],
      message:
        "An NRIC, passport or SSM number is required for a Section 44(6) tax-exemption receipt.",
    });
  }
});

export type DonationPledgeInput = z.infer<typeof donationPledgeSchema>;

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
