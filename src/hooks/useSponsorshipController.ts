"use client";

import { useState } from "react";
import { Pet } from "@/types/pet";
import { SponsorshipTier, DonationReceipt, SponsorshipTierId } from "@/types/sponsorship";
import { SPONSORSHIP_TIERS, useSponsorshipStore } from "@/lib/client/sponsorshipStore";
import { submitDonationPledgeAction } from "@/actions/donations";

export interface UseSponsorshipControllerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPet?: Pet | null;
  initialTierId?: SponsorshipTierId;
}

export function useSponsorshipController({
  targetPet,
  initialTierId,
}: UseSponsorshipControllerProps) {
  const { saveDonationReceipt } = useSponsorshipStore();

  const initialTier =
    SPONSORSHIP_TIERS.find((t) => t.id === initialTierId) || SPONSORSHIP_TIERS[1]; // Default to Vaccine (RM 50)

  const [selectedTier, setSelectedTier] = useState<SponsorshipTier>(initialTier);
  const [isCustomTier, setIsCustomTier] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("50");
  const [frequency, setFrequency] = useState<"one_time" | "monthly">("one_time");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [taxIdOrIc, setTaxIdOrIc] = useState("");
  const [notes, setNotes] = useState("");
  const [copiedBank, setCopiedBank] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<DonationReceipt | null>(null);

  const finalAmount = isCustomTier
    ? Math.max(5, Number(customAmount) || 5)
    : selectedTier.amount;

  const handleCopyMaybank = () => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText("514012345678");
      setCopiedBank(true);
      setTimeout(() => setCopiedBank(false), 2500);
    }
  };

  const handleSelectTier = (tier: SponsorshipTier) => {
    setIsCustomTier(false);
    setSelectedTier(tier);
  };

  const handleSelectCustom = () => {
    setIsCustomTier(true);
  };

  const handleCompleteDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!donorName.trim() || !donorEmail.trim()) {
      setErrorMessage("Please fill in your name and email for the official receipt.");
      return;
    }

    if (finalAmount < 5) {
      setErrorMessage("Minimum donation amount is RM 5.00.");
      return;
    }

    setIsProcessing(true);

    try {
      // Execute Server Action
      const result = await submitDonationPledgeAction({
        donorName: donorName.trim(),
        donorEmail: donorEmail.trim().toLowerCase(),
        donorPhone: donorPhone.trim() || undefined,
        tierId: isCustomTier ? "custom" : selectedTier.id,
        tierName: isCustomTier ? "Custom Rescue Donation" : selectedTier.name,
        amountMYR: finalAmount,
        frequency,
        targetPetName: targetPet?.name,
        taxIdOrIc: taxIdOrIc.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethod: "duitnow_qr",
      });

      if (result.success && result.data) {
        saveDonationReceipt(result.data as DonationReceipt);
        setCompletedReceipt(result.data as DonationReceipt);
      } else {
        // No local fallback, deliberately. A receipt number is allocated inside
        // the transaction that writes the Donation row, so one invented here
        // would name a receipt the shelter has no record of — and the donor
        // would file it with LHDN. Say the gift did not go through instead.
        setErrorMessage(
          result.error ||
            "We could not reach the shelter to record your gift, so no receipt was issued. Nothing has been charged — please try again in a moment."
        );
      }
    } catch {
      setErrorMessage(
        "We could not reach the shelter to record your gift, so no receipt was issued. Nothing has been charged — please try again in a moment."
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCompletedReceipt(null);
    setDonorName("");
    setDonorEmail("");
    setDonorPhone("");
    setTaxIdOrIc("");
    setNotes("");
    setErrorMessage(null);
  };

  const handlePrintReceipt = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return {
    state: {
      selectedTier,
      isCustomTier,
      customAmount,
      frequency,
      donorName,
      donorEmail,
      donorPhone,
      taxIdOrIc,
      notes,
      copiedBank,
      isProcessing,
      errorMessage,
      completedReceipt,
      finalAmount,
      tiers: SPONSORSHIP_TIERS,
    },
    handlers: {
      setSelectedTier: handleSelectTier,
      setIsCustomTier: handleSelectCustom,
      setCustomAmount,
      setFrequency,
      setDonorName,
      setDonorEmail,
      setDonorPhone,
      setTaxIdOrIc,
      setNotes,
      handleCopyMaybank,
      handleCompleteDonation,
      handleReset,
      handlePrintReceipt,
    },
  };
}
