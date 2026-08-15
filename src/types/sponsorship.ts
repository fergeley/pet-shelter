export type SponsorshipTierId = "kibble" | "vaccine" | "spay_neuter" | "emergency_medical" | "custom";

export interface SponsorshipTier {
  id: SponsorshipTierId;
  name: string;
  amount: number; // in MYR
  frequency: "one_time" | "monthly";
  tagline: string;
  description: string;
  impactMetrics: string;
  badgeText: string;
  featured?: boolean;
}

export interface DonationReceipt {
  receiptNumber: string; // e.g. HFS-DON-202608-4821
  date: string;
  donorName: string;
  donorEmail: string;
  donorPhone?: string;
  tierId: SponsorshipTierId;
  tierName: string;
  amountMYR: number;
  paymentMethod: "duitnow_qr" | "online_banking" | "card";
  targetPetName?: string;
  taxDeductibleRef: string;
  shelterRegistrationNo: string;
}
