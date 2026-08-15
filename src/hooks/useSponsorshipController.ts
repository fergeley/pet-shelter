"use client";

import { useState } from "react";
import { Pet } from "@/types/pet";
import { SponsorshipTier, DonationReceipt } from "@/types/sponsorship";
import { SPONSORSHIP_TIERS, useSponsorshipStore } from "@/lib/sponsorshipStore";

export interface UseSponsorshipControllerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetPet?: Pet | null;
}

export function useSponsorshipController({
  targetPet,
}: UseSponsorshipControllerProps) {
  const { createDonationReceipt } = useSponsorshipStore();

  const [selectedTier, setSelectedTier] = useState<SponsorshipTier>(SPONSORSHIP_TIERS[1]); // Default to Vaccination (RM 50)
  const [customAmount] = useState<string>("50");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [copiedBank, setCopiedBank] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [completedReceipt, setCompletedReceipt] = useState<DonationReceipt | null>(null);

  const finalAmount = selectedTier.id === "custom" ? Number(customAmount) || 10 : selectedTier.amount;

  const handleCopyMaybank = () => {
    navigator.clipboard.writeText("514012345678");
    setCopiedBank(true);
    setTimeout(() => setCopiedBank(false), 2500);
  };

  const handleCompleteDonation = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!donorName.trim() || !donorEmail.trim()) return;

    setIsProcessing(true);
    await new Promise((r) => setTimeout(r, 600));

    const receipt = createDonationReceipt({
      donorName: donorName.trim(),
      donorEmail: donorEmail.trim().toLowerCase(),
      donorPhone: donorPhone.trim() || undefined,
      tierId: selectedTier.id,
      tierName: selectedTier.name,
      amountMYR: finalAmount,
      targetPetName: targetPet?.name,
      paymentMethod: "duitnow_qr",
    });

    setCompletedReceipt(receipt);
    setIsProcessing(false);
  };

  const handleReset = () => {
    setCompletedReceipt(null);
    setDonorName("");
    setDonorEmail("");
    setDonorPhone("");
  };

  const handlePrintReceipt = () => {
    if (typeof window !== "undefined") {
      window.print();
    }
  };

  return {
    state: {
      selectedTier,
      customAmount,
      donorName,
      donorEmail,
      donorPhone,
      copiedBank,
      isProcessing,
      completedReceipt,
      finalAmount,
      tiers: SPONSORSHIP_TIERS,
    },
    handlers: {
      setSelectedTier,
      setDonorName,
      setDonorEmail,
      setDonorPhone,
      handleCopyMaybank,
      handleCompleteDonation,
      handleReset,
      handlePrintReceipt,
    },
  };
}
