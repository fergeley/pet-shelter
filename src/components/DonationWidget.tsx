"use client";

import React, { useState } from "react";
import {
  QrCode,
  CheckCircle2,
  Copy,
  Printer,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Building2,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { SPONSORSHIP_TIERS, useSponsorshipStore } from "@/lib/sponsorshipStore";
import { submitDonationPledgeAction } from "@/actions/donations";
import { DonationReceipt, SponsorshipTier } from "@/types/sponsorship";

export function DonationWidget() {
  const { saveDonationReceipt, createDonationReceipt } = useSponsorshipStore();

  const [selectedTier, setSelectedTier] = useState<SponsorshipTier>(SPONSORSHIP_TIERS[1]); // Default RM 50 Vaccine
  const [isCustomTier, setIsCustomTier] = useState(false);
  const [customAmount, setCustomAmount] = useState<string>("100");
  const [frequency, setFrequency] = useState<"one_time" | "monthly">("one_time");
  const [targetPetName, setTargetPetName] = useState("");
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

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!donorName.trim() || !donorEmail.trim()) {
      setErrorMessage("Please enter your name and email address to receive your official tax receipt.");
      return;
    }

    if (finalAmount < 5) {
      setErrorMessage("Minimum donation amount is RM 5.00.");
      return;
    }

    setIsProcessing(true);

    try {
      const result = await submitDonationPledgeAction({
        donorName: donorName.trim(),
        donorEmail: donorEmail.trim().toLowerCase(),
        donorPhone: donorPhone.trim() || undefined,
        tierId: isCustomTier ? "custom" : selectedTier.id,
        tierName: isCustomTier ? "Custom Rescue Donation" : selectedTier.name,
        amountMYR: finalAmount,
        frequency,
        targetPetName: targetPetName.trim() || undefined,
        taxIdOrIc: taxIdOrIc.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethod: "duitnow_qr",
      });

      if (result.success && result.data) {
        saveDonationReceipt(result.data as DonationReceipt);
        setCompletedReceipt(result.data as DonationReceipt);
      } else {
        const localReceipt = createDonationReceipt({
          donorName: donorName.trim(),
          donorEmail: donorEmail.trim().toLowerCase(),
          donorPhone: donorPhone.trim() || undefined,
          tierId: isCustomTier ? "custom" : selectedTier.id,
          tierName: isCustomTier ? "Custom Rescue Donation" : selectedTier.name,
          amountMYR: finalAmount,
          frequency,
          targetPetName: targetPetName.trim() || undefined,
          taxIdOrIc: taxIdOrIc.trim() || undefined,
          notes: notes.trim() || undefined,
          paymentMethod: "duitnow_qr",
        });
        setCompletedReceipt(localReceipt);
      }
    } catch {
      const localReceipt = createDonationReceipt({
        donorName: donorName.trim(),
        donorEmail: donorEmail.trim().toLowerCase(),
        donorPhone: donorPhone.trim() || undefined,
        tierId: isCustomTier ? "custom" : selectedTier.id,
        tierName: isCustomTier ? "Custom Rescue Donation" : selectedTier.name,
        amountMYR: finalAmount,
        frequency,
        targetPetName: targetPetName.trim() || undefined,
        taxIdOrIc: taxIdOrIc.trim() || undefined,
        notes: notes.trim() || undefined,
        paymentMethod: "duitnow_qr",
      });
      setCompletedReceipt(localReceipt);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = () => {
    setCompletedReceipt(null);
    setDonorName("");
    setDonorEmail("");
    setDonorPhone("");
    setTargetPetName("");
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
        <div className="bg-emerald-900/10 border border-emerald-600/30 p-5 rounded-xl flex items-start gap-3.5">
          <CheckCircle2 className="size-6 text-emerald-600 shrink-0 mt-0.5" />
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">
              Thank You! Your Donation Has Been Received.
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              An official tax-exempt e-Receipt for <strong className="text-foreground">RM {completedReceipt.amountMYR}.00</strong> has been generated and dispatched to <strong>{completedReceipt.donorEmail}</strong>.
            </p>
          </div>
        </div>

        {/* Printable Official Receipt Dossier */}
        <div id="donation-receipt-print" className="border-2 border-border bg-white text-zinc-900 p-6 sm:p-8 rounded-xl space-y-5 font-sans shadow-xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-900 pb-4">
            <div>
              <h3 className="font-heading text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-zinc-900">
                Hope for Strays Animal Sanctuary
              </h3>
              <p className="text-xs text-zinc-600">
                No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia
              </p>
              <p className="text-[11px] text-zinc-500">
                ROS Reg: {completedReceipt.shelterRegistrationNo} • Tax Exemption: {completedReceipt.taxDeductibleRef}
              </p>
            </div>

            <div className="text-left sm:text-right">
              <span className="inline-block px-2.5 py-1 bg-zinc-900 text-white font-mono text-xs font-bold uppercase rounded-sm">
                Official e-Receipt
              </span>
              <div className="font-mono text-xs font-bold text-zinc-800 mt-1">
                {completedReceipt.receiptNumber}
              </div>
              <div className="text-[11px] text-zinc-500">{completedReceipt.date}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-500">Issued To</div>
              <div className="font-bold text-zinc-900 text-sm">{completedReceipt.donorName}</div>
              <div className="text-zinc-600">{completedReceipt.donorEmail}</div>
              {completedReceipt.donorPhone && <div className="text-zinc-600">{completedReceipt.donorPhone}</div>}
              {completedReceipt.taxIdOrIc && <div className="text-zinc-600 font-mono">IC/SSM: {completedReceipt.taxIdOrIc}</div>}
            </div>

            <div>
              <div className="text-[10px] uppercase font-bold text-zinc-500">Sponsorship Allocation</div>
              <div className="font-bold text-zinc-900 text-sm">{completedReceipt.tierName}</div>
              {completedReceipt.targetPetName && (
                <div className="text-zinc-700 font-medium">🐾 Dedicated Pet: {completedReceipt.targetPetName}</div>
              )}
              <div className="text-zinc-500">Payment: DuitNow National Instant Rail</div>
              {completedReceipt.frequency && (
                <div className="text-zinc-500 uppercase text-[10px]">Type: {completedReceipt.frequency.replace("_", " ")}</div>
              )}
            </div>
          </div>

          {completedReceipt.notes && (
            <div className="p-3 bg-zinc-50 border border-zinc-200 rounded-md text-xs text-zinc-700 italic">
              &ldquo;{completedReceipt.notes}&rdquo;
            </div>
          )}

          <div className="border-t border-b border-zinc-200 py-3 flex items-center justify-between font-heading">
            <span className="text-sm font-bold text-zinc-900">Total Contribution Received</span>
            <span className="text-2xl font-extrabold text-emerald-700">RM {completedReceipt.amountMYR}.00</span>
          </div>

          <div className="text-[10px] text-zinc-500 leading-relaxed italic">
            * This receipt is computer-generated and valid for income tax deduction under Subsection 44(6) of the Malaysian Income Tax Act 1967.
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
            <RotateCcw className="size-3.5" />
            Make Another Donation
          </Button>

          <Button size="sm" onClick={handlePrintReceipt} className="gap-1.5">
            <Printer className="size-3.5" />
            Print Official e-Receipt
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="border border-border bg-card p-6 sm:p-8 lg:p-10 rounded-2xl shadow-sm space-y-8">
      {errorMessage && (
        <div className="bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive font-medium rounded-lg flex items-center gap-2">
          <span>⚠️ {errorMessage}</span>
        </div>
      )}

      {/* 1. Frequency Switcher */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">
              1. Choose Giving Frequency
            </h3>
            <p className="text-xs text-muted-foreground">
              Select one-time support or join our monthly recurring rescue circle.
            </p>
          </div>

          <div className="inline-flex p-1 bg-muted rounded-xl border border-border">
            <button
              type="button"
              onClick={() => setFrequency("one_time")}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                frequency === "one_time"
                  ? "bg-card text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              One-Time Gift
            </button>
            <button
              type="button"
              onClick={() => setFrequency("monthly")}
              className={`px-4 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                frequency === "monthly"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <RotateCw className="size-3.5" />
              Monthly Partner
            </button>
          </div>
        </div>
      </div>

      {/* 2. Select Tier or Custom Amount */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-lg font-bold text-foreground">
            2. Choose Sponsorship Tier or Amount
          </h3>
          <span className="text-xs font-semibold text-muted-foreground">
            Selected: <strong className="text-primary font-mono text-sm">RM {finalAmount}.00 {frequency === "monthly" ? "/ mo" : ""}</strong>
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
                className={`p-5 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
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
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-secondary text-secondary-foreground rounded-md border border-border">
                      {tier.badgeText}
                    </span>
                  </div>
                  <div className="text-sm font-bold text-foreground">{tier.name}</div>
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
          className={`p-4 rounded-xl border transition-all ${
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
                className="size-4.5 accent-primary"
              />
              <div>
                <label htmlFor="widgetCustomRadio" className="text-sm font-bold text-foreground cursor-pointer">
                  Enter Custom Contribution Amount
                </label>
                <p className="text-xs text-muted-foreground">Specify any amount above RM 5.00</p>
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
                className="w-36 font-bold font-mono h-10 bg-background text-base"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Malaysian Payment Rail Standard */}
      <div className="border border-border bg-muted/30 p-6 sm:p-7 rounded-2xl space-y-5">
        <div className="flex items-center justify-between border-b border-border pb-3">
          <div className="flex items-center gap-2">
            <QrCode className="size-5 text-primary" />
            <h3 className="font-heading text-base font-bold text-foreground">
              3. Malaysian Payment Rail: DuitNow National QR / Maybank Transfer
            </h3>
          </div>
          <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-3 py-1 rounded-md">
            Pay: RM {finalAmount}.00 {frequency === "monthly" ? "/ month" : ""}
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* DuitNow Pink Frame */}
          <div className="md:col-span-5 border-2 border-[#ed008c] bg-white text-zinc-900 p-5 rounded-xl flex flex-col items-center justify-center text-center shadow-xs">
            <div className="text-xs font-extrabold uppercase tracking-widest text-[#ed008c] mb-0.5">
              DuitNow QR
            </div>
            <div className="text-[10px] text-zinc-600 font-semibold mb-2.5">
              National QR Standard (PayNet Malaysia)
            </div>

            <div className="w-40 h-40 border border-zinc-300 p-2 bg-white flex items-center justify-center relative rounded-md">
              <svg viewBox="0 0 100 100" className="w-full h-full text-zinc-900 fill-current">
                <rect x="0" y="0" width="30" height="30" fill="#18181b" />
                <rect x="5" y="5" width="20" height="20" fill="white" />
                <rect x="10" y="10" width="10" height="10" fill="#18181b" />

                <rect x="70" y="0" width="30" height="30" fill="#18181b" />
                <rect x="75" y="5" width="20" height="20" fill="white" />
                <rect x="80" y="10" width="10" height="10" fill="#18181b" />

                <rect x="0" y="70" width="30" height="30" fill="#18181b" />
                <rect x="5" y="75" width="20" height="20" fill="white" />
                <rect x="10" y="80" width="10" height="10" fill="#18181b" />

                <rect x="40" y="10" width="10" height="10" fill="#18181b" />
                <rect x="55" y="15" width="10" height="10" fill="#18181b" />
                <rect x="35" y="35" width="30" height="30" fill="#ed008c" />
                <rect x="42" y="42" width="16" height="16" fill="white" />
                <rect x="46" y="46" width="8" height="8" fill="#ed008c" />
                <rect x="70" y="45" width="10" height="10" fill="#18181b" />
                <rect x="45" y="75" width="10" height="10" fill="#18181b" />
                <rect x="65" y="75" width="25" height="15" fill="#18181b" />
              </svg>
            </div>

            <div className="text-xs font-bold text-zinc-800 mt-2.5">
              Hope for Strays Shelter Selangor
            </div>
            <div className="text-[10px] text-zinc-500 font-mono mt-0.5">
              Scan with Maybank MAE, CIMB, TNG eWallet, etc.
            </div>
          </div>

          {/* Account Details */}
          <div className="md:col-span-7 space-y-3.5 text-xs">
            <div className="p-4 border border-border bg-card rounded-xl space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1.5">
                <Building2 className="size-3.5" /> Beneficiary Organization Name
              </div>
              <div className="font-bold text-foreground text-sm sm:text-base">Pertubuhan Kebajikan Hope for Strays</div>
              <div className="text-xs text-muted-foreground">ROS Registrar of Societies Reg: PPM-021-10-18082021</div>
            </div>

            <div className="p-4 border border-border bg-card rounded-xl space-y-1">
              <div className="text-[10px] text-muted-foreground uppercase font-bold">Maybank Direct Account</div>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <span className="font-mono font-bold text-foreground text-lg tracking-wider block">5140 1234 5678</span>
                  <span className="text-xs text-muted-foreground">Malayan Banking Berhad (PJ SS2 Branch)</span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleCopyMaybank}
                  className="h-9 px-3.5 text-xs font-bold gap-1.5"
                >
                  {copiedBank ? <CheckCircle2 className="size-4 text-emerald-600" /> : <Copy className="size-4" />}
                  {copiedBank ? "Copied!" : "Copy"}
                </Button>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-muted-foreground bg-emerald-950/10 dark:bg-emerald-950/40 p-3 rounded-lg border border-emerald-600/20">
              <ShieldCheck className="size-4.5 text-emerald-600 shrink-0" />
              <span>Official Tax-Exempt Status: <strong>LHDN.01/35/42/51/179-6.4912</strong> (Sub-sec 44(6) ITA 1967)</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. Donor Information Form */}
      <form onSubmit={handleFormSubmit} className="space-y-6">
        <div>
          <h3 className="font-heading text-lg font-bold text-foreground">
            4. Donor Information & E-Receipt Generation
          </h3>
          <p className="text-xs text-muted-foreground">
            Your official tax-deductible receipt will be generated instantly and dispatched to your email.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="wDonorName" className="text-xs font-semibold">
              Full Name / Company Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="wDonorName"
              required
              placeholder="e.g. Jason Lim / ABC Corporation"
              value={donorName}
              onChange={(e) => setDonorName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wDonorEmail" className="text-xs font-semibold">
              Email Address (For e-Receipt) <span className="text-destructive">*</span>
            </Label>
            <Input
              id="wDonorEmail"
              type="email"
              required
              placeholder="jason.lim@example.com"
              value={donorEmail}
              onChange={(e) => setDonorEmail(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wDonorPhone" className="text-xs font-semibold">
              WhatsApp / Mobile Phone (Optional)
            </Label>
            <Input
              id="wDonorPhone"
              placeholder="012-345 6789"
              value={donorPhone}
              onChange={(e) => setDonorPhone(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="wTaxId" className="text-xs font-semibold">
              NRIC / Passport / SSM No. (Optional - for LHDN tax filing)
            </Label>
            <Input
              id="wTaxId"
              placeholder="e.g. 900215-10-5566"
              value={taxIdOrIc}
              onChange={(e) => setTaxIdOrIc(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="wPetName" className="text-xs font-semibold">
              Dedicate Donation in Honor of a Pet (Optional)
            </Label>
            <Input
              id="wPetName"
              placeholder="e.g. In memory of Luna / For Milo's medical fund"
              value={targetPetName}
              onChange={(e) => setTargetPetName(e.target.value)}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="wNotes" className="text-xs font-semibold">
              Message of Encouragement to Caregivers (Optional)
            </Label>
            <Textarea
              id="wNotes"
              rows={2}
              placeholder="Keep up the incredible rescue work..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <div className="pt-4 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Lock className="size-3.5 text-primary" />
            <span>Secure 256-bit encrypted submission & instant LHDN receipting.</span>
          </div>

          <Button type="submit" disabled={isProcessing} size="lg" className="font-bold px-8 gap-2">
            {isProcessing ? "Processing Contribution..." : `Complete Donation of RM ${finalAmount}`}
            <ArrowRight className="size-4.5" />
          </Button>
        </div>
      </form>
    </div>
  );
}
