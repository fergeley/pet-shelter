"use client";

import { useState, useEffect, useCallback } from "react";
import { SponsorshipTier, DonationReceipt } from "@/types/sponsorship";
import { SPONSORSHIP_TIERS } from "@/lib/domain/sponsorshipTiers";

/**
 * Re-exported so existing client consumers keep importing tiers from the store.
 * The canonical definition lives in `@/lib/domain/sponsorshipTiers` because
 * server-side callers must not import this "use client" module.
 */
export { SPONSORSHIP_TIERS };

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
      const randomSeq = Math.floor(1000 + Math.random() * 9000);
      const dateStr = new Date().toISOString().slice(0, 7).replace("-", "");
      const receiptNumber = `HFS-DON-${dateStr}-${randomSeq}`;

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
