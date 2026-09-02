"use client";

import { useState, useEffect, useCallback } from "react";
import { SponsorshipTier, DonationReceipt } from "@/types/sponsorship";
import { generateReceiptNumber } from "@/lib/domain/receiptNumber";

export const SPONSORSHIP_TIERS: SponsorshipTier[] = [
  {
    id: "kibble",
    name: "1-Week Nutrition & Kibble Fund",
    amount: 30,
    frequency: "one_time",
    tagline: "Fuel healthy meals for recovering strays",
    description: "Covers 10 kg of balanced, high-protein kibble, supplements, and fresh wet food portions.",
    impactMetrics: "Feeds 2 rescue dogs or 4 shelter cats for a full week.",
    badgeText: "Most Popular",
  },
  {
    id: "vaccine",
    name: "Core Vaccination & Deworming",
    amount: 50,
    frequency: "one_time",
    tagline: "Essential immunity for rescue intakes",
    description: "Covers 6-in-1 / FVRCP core vaccines, internal deworming (Drontal), and external flea/tick preventative.",
    impactMetrics: "Protects a newly rescued puppy or kitten from fatal viral diseases.",
    badgeText: "High Impact",
    featured: true,
  },
  {
    id: "spay_neuter",
    name: "Spay / Neuter Surgery Sponsorship",
    amount: 120,
    frequency: "one_time",
    tagline: "End the cycle of stray overpopulation",
    description: "Sponsors veterinary sterilization surgery, anesthesia, pain management, and surgical recovery boarding.",
    impactMetrics: "Prevents up to dozens of unwanted stray births per animal over their lifetime.",
    badgeText: "Crucial Mission",
  },
  {
    id: "emergency_medical",
    name: "Emergency Medical & Trauma Care",
    amount: 250,
    frequency: "one_time",
    tagline: "Urgent lifeline for injured and neglected strays",
    description: "Funds veterinary diagnostic X-rays, extensive blood profiling, wound debridement, and specialized therapy.",
    impactMetrics: "Provides urgent rescue intervention for road-accident or severely sick animals.",
    badgeText: "Lifesaver",
  },
];

const STORAGE_RECEIPTS_KEY = "hope_for_strays_donation_receipts_v1";

export function useSponsorshipStore() {
  const [receipts, setReceipts] = useState<DonationReceipt[]>(() => {
    if (typeof window !== "undefined") {
      try {
        const saved = localStorage.getItem(STORAGE_RECEIPTS_KEY);
        if (saved) return JSON.parse(saved);
      } catch (e) {
        console.error(e);
      }
    }
    return [];
  });

  const [activeReceipt, setActiveReceipt] = useState<DonationReceipt | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem(STORAGE_RECEIPTS_KEY, JSON.stringify(receipts));
      } catch (e) {
        console.error(e);
      }
    }
  }, [receipts]);

  const saveDonationReceipt = useCallback((receipt: DonationReceipt) => {
    setReceipts((prev) => [receipt, ...prev]);
    setActiveReceipt(receipt);
  }, []);

  const createDonationReceipt = useCallback(
    (data: {
      donorName: string;
      donorEmail: string;
      donorPhone?: string;
      tierId: SponsorshipTier["id"];
      tierName: string;
      amountMYR: number;
      frequency?: "one_time" | "monthly";
      paymentMethod: "duitnow_qr" | "online_banking" | "card";
      targetPetName?: string;
      taxIdOrIc?: string;
      notes?: string;
    }): DonationReceipt => {
      const receiptNumber = generateReceiptNumber();

      const newReceipt: DonationReceipt = {
        receiptNumber,
        date: new Date().toLocaleDateString("en-MY", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        }),
        donorName: data.donorName,
        donorEmail: data.donorEmail,
        donorPhone: data.donorPhone,
        tierId: data.tierId,
        tierName: data.tierName,
        amountMYR: data.amountMYR,
        frequency: data.frequency || "one_time",
        paymentMethod: data.paymentMethod,
        targetPetName: data.targetPetName,
        taxIdOrIc: data.taxIdOrIc,
        notes: data.notes,
        taxDeductibleRef: "LHDN.01/35/42/51/179-6.4912",
        shelterRegistrationNo: "PPM-021-10-18082021",
      };

      setReceipts((prev) => [newReceipt, ...prev]);
      setActiveReceipt(newReceipt);
      return newReceipt;
    },
    []
  );

  return {
    tiers: SPONSORSHIP_TIERS,
    receipts,
    activeReceipt,
    setActiveReceipt,
    saveDonationReceipt,
    createDonationReceipt,
  };
}
