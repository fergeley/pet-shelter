import { z } from "zod";
import {
  donationTierEnum,
  donationFrequencyEnum,
  paymentMethodEnum,
} from "@/lib/validations/donation";
import { MIN_SPONSORSHIP_SEN, MAX_SPONSORSHIP_SEN } from "@/lib/domain/petSponsorship";
import { formatMYR } from "@/lib/domain/money";

/**
 * A supporter's commitment to fund one animal's care.
 *
 * Money crosses this boundary as ringgit, matching `donationPledgeSchema` — the
 * form collects ringgit and `senFromRinggit` is the single conversion point on
 * the server. Keeping the two pledge forms the same shape means a reader does
 * not have to remember which one takes sen.
 */
export const petSponsorshipSchema = z.object({
  /// Optional: an animal served from the JSON fixture has no database row.
  petId: z.string().max(64).optional(),
  petName: z
    .string()
    .min(1, "Please choose the animal you would like to sponsor")
    .max(100, "Pet name is too long"),

  sponsorName: z
    .string()
    .min(2, "Sponsor name must be at least 2 characters")
    .max(100, "Sponsor name is too long"),
  sponsorEmail: z
    .string()
    .email("Please provide a valid email address so we can confirm your sponsorship"),
  sponsorPhone: z.string().max(25, "Phone number is too long").optional().or(z.literal("")),

  tierId: donationTierEnum.default("vaccine"),
  tierName: z.string().max(120).optional(),
  frequency: donationFrequencyEnum.default("one_time"),

  amountMYR: z.coerce
    .number({ message: "Sponsorship amount must be a number" })
    .min(
      MIN_SPONSORSHIP_SEN / 100,
      `Minimum sponsorship amount is ${formatMYR(MIN_SPONSORSHIP_SEN)}`
    )
    .max(
      MAX_SPONSORSHIP_SEN / 100,
      `Maximum single sponsorship amount is ${formatMYR(MAX_SPONSORSHIP_SEN)}`
    ),

  paymentMethod: paymentMethodEnum.default("duitnow_qr"),

  taxIdOrIc: z.string().max(30, "Tax ID / IC / SSM number is too long").optional().or(z.literal("")),
  notes: z.string().max(500, "Note to the shelter must be under 500 characters").optional().or(z.literal("")),

  /// Reserved for a future supporter account; guest checkout never sets it.
  userId: z.string().max(64).optional(),
});

export type PetSponsorshipInput = z.infer<typeof petSponsorshipSchema>;

/**
 * Payment rails the shelter can actually settle.
 *
 * `card` is accepted by the enum because the column records what the supporter
 * chose, but refused at the action boundary: there is no payment processor, and
 * a form that collected card details it cannot process would be worse than one
 * that says so.
 */
export const ENABLED_PAYMENT_METHODS = ["duitnow_qr", "online_banking"] as const;

export function isPaymentMethodEnabled(method: string): boolean {
  return (ENABLED_PAYMENT_METHODS as readonly string[]).includes(method);
}
