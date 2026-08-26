"use client";

import { LHDN_TAX_DEDUCTIBLE_REF, PUBLIC_ROS_REGISTRATION_NO } from "@/lib/domain/shelterIdentity";
import React, { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import {
  QrCode,
  CheckCircle2,
  Copy,
  Printer,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Sparkles,
  Gift,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SPONSORSHIP_TIERS, useSponsorshipStore } from "@/lib/client/sponsorshipStore";
import { submitDonationPledgeAction } from "@/actions/donations";
import { getPublicPets } from "@/actions/pets";
import { DonationReceipt, SponsorshipTier } from "@/types/sponsorship";
import { Pet } from "@/types/pet";
import initialPetsData from "@/data/pets.json";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { PetChooserCarousel } from "./PetChooserCarousel";

interface DonationWidgetProps {
  initialPets?: Pet[];
}

export function DonationWidget({ initialPets = [] }: DonationWidgetProps) {
  const { t, isMs } = useLanguage();
  const searchParams = useSearchParams();
  const { saveDonationReceipt, createDonationReceipt } = useSponsorshipStore();

  const urlPetName = searchParams.get("pet");
  const urlSponsorPetId = searchParams.get("sponsorPetId");
  const urlTier = searchParams.get("tier");
  const urlFreq = searchParams.get("freq");

  const basePets: Pet[] =
    initialPets.length > 0
      ? initialPets
      : ((initialPetsData as unknown as Pet[]).filter((p) => !p.isArchived));

  const [pets, setPets] = useState<Pet[]>(basePets);

  const [frequency, setFrequency] = useState<"one_time" | "monthly">(() => {
    return urlFreq === "monthly" || urlFreq === "one_time" ? urlFreq : "one_time";
  });

  const [selectedTier, setSelectedTier] = useState<SponsorshipTier>(() => {
    if (urlTier) {
      const match = SPONSORSHIP_TIERS.find(
        (t) => t.id.toLowerCase() === urlTier.toLowerCase()
      );
      if (match) return match;
    }
    return SPONSORSHIP_TIERS[1]; // Default RM 50 Vaccine
  });

  const [selectedPet, setSelectedPet] = useState<Pet | null>(() => {
    if (urlSponsorPetId || urlPetName) {
      return (
        basePets.find(
          (p) =>
            (urlSponsorPetId && p.id === urlSponsorPetId) ||
            (urlPetName && p.name.toLowerCase() === urlPetName.toLowerCase())
        ) || null
      );
    }
    return null;
  });

  const [targetPetName, setTargetPetName] = useState(() => {
    if (urlPetName) return urlPetName;
    if (urlSponsorPetId) {
      const p = basePets.find((pet) => pet.id === urlSponsorPetId);
      if (p) return p.name;
    }
    return "";
  });

  const [isCustomTier, setIsCustomTier] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("100");
  const [donorName, setDonorName] = useState("");
  const [donorEmail, setDonorEmail] = useState("");
  const [donorPhone, setDonorPhone] = useState("");
  const [taxIdOrIc, setTaxIdOrIc] = useState("");
  const [notes, setNotes] = useState("");
  const [copiedBank, setCopiedBank] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [completedReceipt, setCompletedReceipt] = useState<DonationReceipt | null>(null);

  // Fetch public pets if not supplied initially
  useEffect(() => {
    if (pets.length === 0) {
      getPublicPets().then((loadedPets) => {
        if (loadedPets && loadedPets.length > 0) {
          setPets(loadedPets);
          if (!selectedPet && (urlSponsorPetId || urlPetName)) {
            const match = loadedPets.find(
              (p) =>
                (urlSponsorPetId && p.id === urlSponsorPetId) ||
                (urlPetName && p.name.toLowerCase() === urlPetName.toLowerCase())
            );
            if (match) {
              setSelectedPet(match);
              setTargetPetName(match.name);
            }
          }
        }
      });
    }
  }, [pets.length, selectedPet, urlPetName, urlSponsorPetId]);

  const finalAmount = isCustomTier
    ? Math.max(5, Number(customAmount) || 5)
    : selectedTier.amount;

  const handleSelectPet = (pet: Pet | null) => {
    setSelectedPet(pet);
    setTargetPetName(pet ? pet.name : "");
  };

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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!donorName.trim() || !donorEmail.trim()) {
      setErrorMessage(
        isMs
          ? "Sila masukkan nama dan alamat emel anda untuk menerima resit rasmi."
          : "Please enter your name and email address to receive your official tax receipt."
      );
      return;
    }

    if (finalAmount < 5) {
      setErrorMessage(
        isMs
          ? "Jumlah sumbangan minimum ialah RM 5.00."
          : "Minimum donation amount is RM 5.00."
      );
      return;
    }

    setIsProcessing(true);

    const payload = {
      donorName: donorName.trim(),
      donorEmail: donorEmail.trim().toLowerCase(),
      donorPhone: donorPhone.trim() || undefined,
      tierId: isCustomTier ? "custom" : selectedTier.id,
      tierName: isCustomTier
        ? isMs
          ? "Sumbangan Reskue Tersuai"
          : "Custom Rescue Donation"
        : selectedTier.name,
      amountMYR: finalAmount,
      frequency,
      targetPetName: targetPetName.trim() || undefined,
      taxIdOrIc: taxIdOrIc.trim() || undefined,
      notes: notes.trim() || undefined,
      paymentMethod: "duitnow_qr" as const,
    };

    try {
      const result = await submitDonationPledgeAction(payload);

      if (result.success && result.data) {
        saveDonationReceipt(result.data as DonationReceipt);
        setCompletedReceipt(result.data as DonationReceipt);
      } else {
        const localReceipt = createDonationReceipt(payload);
        setCompletedReceipt(localReceipt);
      }
    } catch {
      const localReceipt = createDonationReceipt(payload);
      setCompletedReceipt(localReceipt);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCompletedReceipt(null);
    setSelectedPet(null);
    setTargetPetName("");
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

  if (completedReceipt) {
    return (
      <div className="border border-border bg-card p-6 sm:p-10 rounded-2xl shadow-sm space-y-6">
        <div className="bg-success-surface border border-success-accent/30 p-5 rounded-xl flex items-start gap-3.5">
          <CheckCircle2 className="size-6 text-success-accent shrink-0 mt-0.5" />
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">
              {isMs
                ? "Terima Kasih! Sumbangan Anda Telah Diterima."
                : "Thank You! Your Donation Has Been Received."}
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              {isMs
                ? `e-Resit rasmi pengecualian cukai berjumlah RM ${completedReceipt.amountMYR}.00 telah dijana dan dihantar ke ${completedReceipt.donorEmail}.`
                : `An official tax-exempt e-Receipt for RM ${completedReceipt.amountMYR}.00 has been generated and dispatched to ${completedReceipt.donorEmail}.`}
            </p>
          </div>
        </div>

        {/* Printable Official Receipt Dossier */}
        <div
          id="donation-receipt-print"
          className="receipt p-6 sm:p-8 space-y-5 shadow-xs"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-receipt-ink pb-4">
            <div>
              <h3 className="font-heading text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-receipt-ink">
                Hope for Strays Animal Sanctuary
              </h3>
              <p className="text-xs text-receipt-ink-muted">
                No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia
              </p>
              <p className="text-2xs text-receipt-ink-faint">
                ROS Reg: {completedReceipt.shelterRegistrationNo} • Tax Exemption:{" "}
                {completedReceipt.taxDeductibleRef}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block px-2.5 py-1 bg-receipt-ink text-receipt-paper font-mono text-xs font-bold uppercase rounded-sm">
                {t("donations.receiptTitle", "Official e-Receipt")}
              </span>
              <div className="font-mono text-xs font-bold text-receipt-ink-soft mt-1">
                {completedReceipt.receiptNumber}
              </div>
              <div className="text-2xs text-receipt-ink-faint">
                {completedReceipt.date}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-3xs uppercase font-bold text-receipt-ink-faint">
                {isMs ? "Dikeluarkan Kepada" : "Issued To"}
              </div>
              <div className="font-bold text-receipt-ink text-sm">
                {completedReceipt.donorName}
              </div>
              <div className="text-receipt-ink-muted">{completedReceipt.donorEmail}</div>
              {completedReceipt.donorPhone && (
                <div className="text-receipt-ink-muted">
                  {completedReceipt.donorPhone}
                </div>
              )}
              {completedReceipt.taxIdOrIc && (
                <div className="text-receipt-ink-muted font-mono">
                  IC/SSM: {completedReceipt.taxIdOrIc}
                </div>
              )}
            </div>

            <div>
              <div className="text-3xs uppercase font-bold text-receipt-ink-faint">
                {isMs ? "Peruntukan Penajaan" : "Sponsorship Allocation"}
              </div>
              <div className="font-bold text-receipt-ink text-sm">
                {completedReceipt.tierName}
              </div>
              {completedReceipt.targetPetName && (
                <div className="text-receipt-ink-soft font-medium">
                  🐾 {isMs ? "Dedikasi Haiwan" : "Dedicated Pet"}:{" "}
                  {completedReceipt.targetPetName}
                </div>
              )}
              <div className="text-receipt-ink-faint">
                Payment: DuitNow National Instant Rail
              </div>
              {completedReceipt.frequency && (
                <div className="text-receipt-ink-faint uppercase text-3xs">
                  Type: {completedReceipt.frequency.replace("_", " ")}
                </div>
              )}
            </div>
          </div>

          {completedReceipt.notes && (
            <div className="p-3 receipt-panel border rounded-md text-xs italic">
              &ldquo;{completedReceipt.notes}&rdquo;
            </div>
          )}

          <div className="border-t border-b border-receipt-rule py-3 flex items-center justify-between font-heading">
            <span className="text-sm font-bold text-receipt-ink">
              {isMs
                ? "Jumlah Sumbangan Diterima"
                : "Total Contribution Received"}
            </span>
            <span className="text-2xl font-extrabold receipt-accent">
              RM {completedReceipt.amountMYR}.00
            </span>
          </div>

          <div className="text-3xs text-receipt-ink-faint leading-relaxed italic">
            *{" "}
            {t(
              "donations.receiptSubtitle",
              "Approved Under Subsection 44(6) Income Tax Act 1967 • Ref: {taxRef}",
              { taxRef: LHDN_TAX_DEDUCTIBLE_REF }
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleReset}
            className="gap-1.5 cursor-pointer rounded-xl"
          >
            <RotateCcw className="size-3.5" />
            {isMs ? "Buat Sumbangan Lain" : "Make Another Donation"}
          </Button>

          <Button
            size="sm"
            onClick={handlePrintReceipt}
            className="gap-1.5 cursor-pointer rounded-xl"
          >
            <Printer className="size-3.5" />
            {t("donations.printReceiptBtn", "Print Official e-Receipt")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card p-6 sm:p-8 lg:p-10 rounded-2xl shadow-sm space-y-8">
      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive font-medium rounded-xl flex items-center gap-2">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {/* 1. Giving Frequency */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">
              1. {isMs ? "Pilih Kekerapan Sumbangan" : "Choose Giving Frequency"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isMs
                ? "Pilih sumbangan sekali sahaja atau sertai keluarga penaja bulanan kami."
                : "Select one-time support or join our monthly recurring rescue circle."}
            </p>
          </div>

          <div className="inline-flex p-1 bg-muted rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setFrequency("one_time")}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all cursor-pointer ${
                frequency === "one_time"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("donations.frequencyOneTime", "One-Time Gift")}
            </button>
            <button
              type="button"
              onClick={() => setFrequency("monthly")}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                frequency === "monthly"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <RotateCw className="size-3.5" />
              {t("donations.frequencyMonthly", "Monthly Rescue Hero")}
            </button>
          </div>
        </div>
      </div>

      {/* 2. Interactive Pet Chooser Carousel (FE-06) */}
      <div className="border-b border-border pb-6">
        <PetChooserCarousel
          pets={pets}
          selectedPetId={selectedPet ? selectedPet.id : "general"}
          onSelectPet={handleSelectPet}
        />
      </div>

      {/* 3. Select Tier or Custom Amount */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-foreground">
            3. {t("donations.selectTierLabel", "Choose Sponsorship Tier or Amount")}
          </h3>
          <span className="text-xs font-semibold text-muted-foreground">
            {isMs ? "Dipilih:" : "Selected:"}{" "}
            <strong className="text-primary font-mono text-sm">
              RM {finalAmount}.00 {frequency === "monthly" ? (isMs ? "/ bln" : "/ mo") : ""}
            </strong>
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {SPONSORSHIP_TIERS.map((tier) => {
            const isSelected = !isCustomTier && selectedTier.id === tier.id;
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => handleSelectTier(tier)}
                className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary shadow-sm"
                    : "border-border bg-background hover:bg-muted/40"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between gap-1 mb-2">
                    <span className="font-heading text-xl font-bold text-foreground">
                      RM {tier.amount}
                    </span>
                    <span className="text-3xs font-bold px-2 py-0.5 bg-secondary text-secondary-foreground rounded-md border border-border">
                      {tier.badgeText}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-foreground">
                    {tier.name}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                    {tier.description}
                  </div>
                </div>

                <div className="mt-4 pt-2.5 border-t border-border/60 text-xs text-primary font-medium">
                  {tier.impactMetrics}
                </div>
              </button>
            );
          })}
        </div>

        {/* Custom Amount Entry */}
        <div
          className={`p-4 rounded-2xl border transition-all ${
            isCustomTier
              ? "border-primary bg-primary/5 ring-2 ring-primary"
              : "border-border bg-background hover:bg-muted/20"
          }`}
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <input
                type="radio"
                id="widgetCustomRadio"
                name="widgetTierOption"
                checked={isCustomTier}
                onChange={handleSelectCustom}
                className="size-4.5 accent-primary cursor-pointer"
              />
              <div>
                <label
                  htmlFor="widgetCustomRadio"
                  className="text-sm font-bold text-foreground cursor-pointer"
                >
                  {t("donations.customAmountLabel", "Or Enter Custom Amount (MYR)")}
                </label>
                <p className="text-xs text-muted-foreground">
                  {isMs
                    ? "Tentukan sebarang jumlah melebihi RM 5.00"
                    : "Specify any amount above RM 5.00"}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="font-bold text-base text-foreground">RM</span>
              <Input
                type="number"
                min="5"
                max="100000"
                placeholder="100"
                value={customAmount}
                onFocus={handleSelectCustom}
                onChange={(e) => {
                  handleSelectCustom();
                  setCustomAmount(e.target.value);
                }}
                className="w-36 font-bold font-mono h-10 bg-background text-base rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* RM30/mo Rescue Companion Tier Highlights (FE-06) */}
        {(frequency === "monthly" || selectedTier.id === "kibble") && (
          <div className="border border-primary/30 bg-primary/5 p-4 sm:p-5 rounded-2xl space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-primary" />
              <h4 className="font-heading text-sm font-bold text-foreground">
                {t("donations.companionTierTitle", "Rescue Companion & Updates")} — {selectedPet ? selectedPet.name : (isMs ? "Haiwan Perlindungan" : "Shelter Rescues")}
              </h4>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
              <div className="p-2.5 bg-background border border-primary/20 rounded-xl space-y-0.5">
                <span className="font-bold text-foreground text-2xs block">
                  📸 {isMs ? "Kemas Kini Bulanan" : "Monthly Care Reports"}
                </span>
                <span className="text-3xs text-muted-foreground leading-tight block">
                  {t("donations.perkMonthlyUpdates", "Monthly Photo & Video Progress Report")}
                </span>
              </div>

              <div className="p-2.5 bg-background border border-primary/20 rounded-xl space-y-0.5">
                <span className="font-bold text-foreground text-2xs block">
                  🏅 {isMs ? "Sijil Penajaan" : "Digital Certificate"}
                </span>
                <span className="text-3xs text-muted-foreground leading-tight block">
                  {t("donations.perkDigitalCertificate", "Personalized Digital Sponsorship Certificate")}
                </span>
              </div>

              <div className="p-2.5 bg-background border border-primary/20 rounded-xl space-y-0.5">
                <span className="font-bold text-foreground text-2xs block">
                  🐾 {isMs ? "Lawatan Santuari" : "Sanctuary Visits"}
                </span>
                <span className="text-3xs text-muted-foreground leading-tight block">
                  {t("donations.perkSanctuaryVisits", "Invitation to arrange occasional visits")}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Malaysian Payment Rail Standard */}
      <div className="border border-border bg-muted/30 p-6 sm:p-7 rounded-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" />
            <h3 className="font-heading text-base font-bold text-foreground">
              4.{" "}
              {isMs
                ? "Kaedah Pembayaran Malaysia: DuitNow QR / Pindahan Bank"
                : "Malaysian Payment Rail: DuitNow National QR / Maybank Transfer"}
            </h3>
          </div>
          <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-3 py-1 rounded-md">
            Pay: RM {finalAmount}.00{" "}
            {frequency === "monthly" ? (isMs ? "/ bulan" : "/ month") : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* DuitNow Pink Frame */}
          <div className="md:col-span-5 border-2 border-brand-duitnow bg-receipt-paper text-receipt-ink p-5 rounded-xl flex flex-col items-center justify-center text-center shadow-xs">
            <div className="text-xs font-extrabold uppercase tracking-widest text-brand-duitnow mb-0.5">
              DuitNow QR
            </div>
            <div className="text-3xs text-receipt-ink-muted font-semibold mb-2.5">
              National QR Standard (PayNet Malaysia)
            </div>

            <div className="w-40 h-40 border border-receipt-rule p-2 bg-receipt-paper flex items-center justify-center relative rounded-md">
              <svg
                viewBox="0 0 100 100"
                className="w-full h-full text-receipt-ink fill-current"
              >
                <rect x="0" y="0" width="30" height="30" fill="var(--receipt-ink)" />
                <rect x="5" y="5" width="20" height="20" fill="white" />
                <rect x="10" y="10" width="10" height="10" fill="var(--receipt-ink)" />

                <rect x="70" y="0" width="30" height="30" fill="var(--receipt-ink)" />
                <rect x="75" y="5" width="20" height="20" fill="white" />
                <rect x="80" y="10" width="10" height="10" fill="var(--receipt-ink)" />

                <rect x="0" y="70" width="30" height="30" fill="var(--receipt-ink)" />
                <rect x="5" y="75" width="20" height="20" fill="white" />
                <rect x="10" y="80" width="10" height="10" fill="var(--receipt-ink)" />

                <rect x="40" y="10" width="10" height="10" fill="var(--receipt-ink)" />
                <rect x="55" y="15" width="10" height="10" fill="var(--receipt-ink)" />
                <rect x="35" y="35" width="30" height="30" fill="var(--brand-duitnow)" />
                <rect x="42" y="42" width="16" height="16" fill="white" />
                <rect x="46" y="46" width="8" height="8" fill="var(--brand-duitnow)" />
                <rect x="70" y="45" width="10" height="10" fill="var(--receipt-ink)" />
                <rect x="45" y="75" width="10" height="10" fill="var(--receipt-ink)" />
                <rect x="65" y="75" width="25" height="15" fill="var(--receipt-ink)" />
              </svg>
            </div>

            <div className="text-xs font-bold text-receipt-ink-soft mt-2.5">
              Hope for Strays Shelter Selangor
            </div>
            <div className="text-3xs text-receipt-ink-faint font-mono mt-0.5">
              {t(
                "donations.duitNowInstructions",
                "Scan using Maybank MAE, CIMB Clicks, Touch 'n Go eWallet, Public Bank, or any Malaysian banking app."
              )}
            </div>
          </div>

          {/* Account Details */}
          <div className="md:col-span-7 space-y-3.5 text-xs">
            <div className="p-4 border border-border bg-card rounded-xl space-y-1.5">
              <div className="eyebrow flex items-center gap-1">
                <Building2 className="size-3.5" /> Beneficiary Organization
              </div>
              <div className="font-bold text-foreground text-sm">
                Pertubuhan Kebajikan Hope for Strays
              </div>
              <div className="text-2xs text-muted-foreground">
                ROS Reg: {PUBLIC_ROS_REGISTRATION_NO}
              </div>
            </div>

            <div className="p-4 border border-border bg-card rounded-xl space-y-2">
              <div className="eyebrow">
                Maybank Corporate Current Account
              </div>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="font-mono font-bold text-foreground text-base tracking-wider block">
                    5140 1234 5678
                  </span>
                  <span className="text-3xs text-muted-foreground">
                    Malayan Banking Berhad (PJ Branch)
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMaybank}
                  className="h-8 px-3 text-xs font-semibold gap-1.5 rounded-lg cursor-pointer"
                >
                  {copiedBank ? (
                    <CheckCircle2 className="size-3.5 text-success-accent" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  {copiedBank
                    ? t("donations.copiedBtn", "Copied!")
                    : t("donations.copyAccountBtn", "Copy")}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2.5 text-xs text-muted-foreground bg-success-surface p-3 rounded-xl border border-success-accent/30">
              <ShieldCheck className="size-4 text-success-accent shrink-0" />
              <span>
                Official LHDN Tax-Exempt Reference:{" "}
                <strong className="text-success-text ">
                  {LHDN_TAX_DEDUCTIBLE_REF}
                </strong>
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 5. Official Donor Dossier Form */}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div className="space-y-4">
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">
              5. {isMs ? "Maklumat Penderma (Untuk e-Resit Rasmi LHDN)" : "Donor Details (For Official Tax-Exempt e-Receipt)"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t(
                "donations.taxReliefNoticeDesc",
                "Provide your Full Name and Malaysian IC / Passport / SSM number to receive an official e-Receipt valid for tax deductions."
              )}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="widgetDonorName" className="text-xs font-semibold">
                {t("donations.donorNameLabel", "Donor Full Name *")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="widgetDonorName"
                required
                placeholder="e.g. Nurul Huda binti Ahmad / Apex Logistics Sdn Bhd"
                value={donorName}
                onChange={(e) => setDonorName(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="widgetDonorEmail" className="text-xs font-semibold">
                {t("donations.donorEmailLabel", "Email Address *")}{" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                id="widgetDonorEmail"
                type="email"
                required
                placeholder="nurul.huda@example.com"
                value={donorEmail}
                onChange={(e) => setDonorEmail(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="widgetDonorPhone" className="text-xs font-semibold">
                {t("donations.donorPhoneLabel", "Phone Number (WhatsApp receipt updates)")}
              </Label>
              <Input
                id="widgetDonorPhone"
                placeholder="012-345 6789"
                value={donorPhone}
                onChange={(e) => setDonorPhone(e.target.value)}
                className="rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="widgetTaxIdOrIc" className="text-xs font-semibold">
                {t("donations.donorIcLabel", "Malaysian IC / Passport / SSM No. *")}
              </Label>
              <Input
                id="widgetTaxIdOrIc"
                placeholder="e.g. 920512-10-5432 / 202101012345"
                value={taxIdOrIc}
                onChange={(e) => setTaxIdOrIc(e.target.value)}
                className="rounded-xl font-mono"
              />
            </div>

            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="widgetNotes" className="text-xs font-semibold">
                {t("donations.donorNotesLabel", "Special Message / Donor Wishes (Optional)")}
              </Label>
              <Textarea
                id="widgetNotes"
                rows={2}
                placeholder="Leave a message for our shelter team..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="rounded-xl"
              />
            </div>
          </div>
        </div>

        {/* Submit */}
        <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="text-xs text-muted-foreground">
            {t(
              "donations.taxReliefNoticeTitle",
              "LHDN Tax Exemption (Subsek 44(6) ACP 1967)"
            )}
          </div>

          <Button
            type="submit"
            disabled={isProcessing}
            size="lg"
            className="gap-2 font-bold px-8 rounded-xl cursor-pointer shadow-xs"
          >
            <Gift className="size-4" />
            {isProcessing
              ? t("donations.pledgeProcessing", "Recording Tax-Deductible Pledge...")
              : `${t("donations.pledgeBtn", "Complete Donation Pledge")} — RM ${finalAmount}`}
            <ArrowRight className="size-4" />
          </Button>
        </div>
      </form>
    </div>
  );
}
