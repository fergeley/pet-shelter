"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  HeartHandshake,
  QrCode,
  CheckCircle2,
  Copy,
  Printer,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
} from "lucide-react";
import { useSponsorshipController, UseSponsorshipControllerProps } from "@/hooks/useSponsorshipController";

export function SponsorshipModal(props: UseSponsorshipControllerProps) {
  const { open, onOpenChange, targetPet } = props;
  const { state, handlers } = useSponsorshipController(props);
  const {
    selectedTier,
    donorName,
    donorEmail,
    donorPhone,
    copiedBank,
    isProcessing,
    completedReceipt,
    finalAmount,
    tiers,
  } = state;
  const {
    setSelectedTier,
    setDonorName,
    setDonorEmail,
    setDonorPhone,
    handleCopyMaybank,
    handleCompleteDonation,
    handleReset,
    handlePrintReceipt,
  } = handlers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto p-0 border border-border bg-card">
        {/* Header */}
        <div className="bg-primary text-primary-foreground p-6 sm:p-8">
          <div className="flex items-center gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-bold uppercase tracking-wider bg-primary-foreground/15 text-primary-foreground">
              <HeartHandshake className="size-3.5" />
              Rescue Giving & Sponsorship
            </span>
          </div>
          <DialogHeader className="text-left">
            <DialogTitle className="font-heading text-2xl sm:text-3xl font-bold tracking-tight text-primary-foreground">
              {targetPet ? `Sponsor ${targetPet.name}'s Care` : "Sponsor a Rescue Animal"}
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/80 text-sm mt-1">
              Every Ringgit goes directly to veterinary operations, core vaccinations, and food supplies in Petaling Jaya, Selangor.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Content */}
        <div className="p-6 sm:p-8 space-y-6">
          {!completedReceipt ? (
            <form onSubmit={handleCompleteDonation} className="space-y-6">
              {/* 1. Select Sponsorship Tier */}
              <div className="space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground block">
                  1. Choose a Rescue Sponsorship Package
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tiers.map((tier) => {
                    const isSelected = selectedTier.id === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedTier(tier)}
                        className={`p-4 border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-1 ring-primary"
                            : "border-border bg-card hover:bg-muted/60"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <span className="font-heading text-lg font-bold text-foreground">
                              RM {tier.amount}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-secondary text-secondary-foreground border border-border">
                              {tier.badgeText}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-foreground mt-1">{tier.name}</div>
                          <div className="text-[11px] text-muted-foreground mt-1 leading-snug">{tier.description}</div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-border/60 text-[10px] text-primary font-medium">
                          {tier.impactMetrics}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2. Malaysian Payment Rail: DuitNow QR & Direct Banking */}
              <div className="border border-border bg-muted/30 p-5 space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-2">
                  <div className="flex items-center gap-2">
                    <QrCode className="size-4 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      2. Instant Payment: DuitNow QR / Instant Transfer
                    </span>
                  </div>
                  <span className="text-xs font-bold font-mono text-primary">
                    Total: RM {finalAmount}.00
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* DuitNow Visual Standard Frame */}
                  <div className="border-2 border-[#ed008c] bg-white text-zinc-900 p-4 flex flex-col items-center justify-center text-center shadow-xs">
                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-[#ed008c] mb-1">
                      DuitNow QR
                    </div>
                    <div className="text-[10px] text-zinc-600 font-semibold mb-2">
                      National QR Standard (PayNet)
                    </div>

                    {/* QR Code SVG Mock */}
                    <div className="w-36 h-36 border border-zinc-300 p-2 bg-white flex items-center justify-center relative">
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

                        {/* Pixel pattern */}
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

                    <div className="text-[10px] font-bold text-zinc-800 mt-2">
                      Hope for Strays Shelter Selangor
                    </div>
                    <div className="text-[9px] text-zinc-500 font-mono">
                      Scan with any Malaysian Banking App or TNG eWallet
                    </div>
                  </div>

                  {/* Manual Bank Account Details */}
                  <div className="space-y-3 text-xs">
                    <div className="p-3 border border-border bg-card space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Beneficiary Name</div>
                      <div className="font-bold text-foreground">Pertubuhan Kebajikan Hope for Strays</div>
                      <div className="text-[10px] text-muted-foreground">Reg: PPM-021-10-18082021</div>
                    </div>

                    <div className="p-3 border border-border bg-card space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Maybank Account</div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-mono font-bold text-foreground text-sm">5140 1234 5678</span>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopyMaybank}
                          className="h-7 px-2 text-[11px] gap-1"
                        >
                          {copiedBank ? <CheckCircle2 className="size-3 text-emerald-600" /> : <Copy className="size-3" />}
                          {copiedBank ? "Copied" : "Copy"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <ShieldCheck className="size-3.5 text-emerald-600 shrink-0" />
                      <span>Official Tax-Exempt Ref: LHDN.01/35/42/51/179-6</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Donor Details for Tax-Exempt Receipt */}
              <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground block">
                  3. Donor Information (For Official Receipt)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="donorName" className="text-xs font-semibold">
                      Full Name / Company Name <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="donorName"
                      required
                      placeholder="e.g. Cheryl Tan"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="donorEmail" className="text-xs font-semibold">
                      Email Address (For e-Receipt) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="donorEmail"
                      type="email"
                      required
                      placeholder="e.g. cheryl.tan@example.com"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="donorPhone" className="text-xs font-semibold">
                      Phone Number (Optional - for WhatsApp receipt dispatch)
                    </Label>
                    <Input
                      id="donorPhone"
                      placeholder="e.g. +6012-345 6789"
                      value={donorPhone}
                      onChange={(e) => setDonorPhone(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Submit & Cancel */}
              <div className="flex items-center justify-between border-t border-border pt-4">
                <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isProcessing} size="sm" className="gap-2 font-bold">
                  {isProcessing ? "Verifying Transaction..." : `Confirm Sponsorship of RM ${finalAmount}`}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </form>
          ) : (
            /* E-Receipt View */
            <div className="space-y-6">
              <div className="bg-emerald-900/10 border border-emerald-600/30 p-4 flex items-start gap-3">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-heading text-sm font-bold text-foreground">
                    Sponsorship Confirmed! Thank You for Saving Lives.
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Your contribution of <strong className="text-foreground">RM {completedReceipt.amountMYR}.00</strong> has been allocated to {completedReceipt.tierName}.
                  </p>
                </div>
              </div>

              {/* Printable Official Receipt Dossier */}
              <div id="donation-receipt-print" className="border-2 border-border bg-white text-zinc-900 p-6 sm:p-8 space-y-5 font-sans">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-zinc-900 pb-4">
                  <div>
                    <h3 className="font-heading text-xl font-extrabold uppercase tracking-tight text-zinc-900">
                      Hope for Strays Sanctuary
                    </h3>
                    <p className="text-xs text-zinc-600">
                      No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia
                    </p>
                    <p className="text-[11px] text-zinc-500">
                      PPM Reg: {completedReceipt.shelterRegistrationNo} • Tax Exemption: {completedReceipt.taxDeductibleRef}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="inline-block px-2.5 py-1 bg-zinc-900 text-white font-mono text-xs font-bold uppercase">
                      Official e-Receipt
                    </span>
                    <div className="font-mono text-xs font-bold text-zinc-800 mt-1">
                      {completedReceipt.receiptNumber}
                    </div>
                    <div className="text-[11px] text-zinc-500">{completedReceipt.date}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-zinc-500">Issued To</div>
                    <div className="font-bold text-zinc-900">{completedReceipt.donorName}</div>
                    <div className="text-zinc-600">{completedReceipt.donorEmail}</div>
                    {completedReceipt.donorPhone && <div className="text-zinc-600">{completedReceipt.donorPhone}</div>}
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-bold text-zinc-500">Sponsorship Allocation</div>
                    <div className="font-bold text-zinc-900">{completedReceipt.tierName}</div>
                    {completedReceipt.targetPetName && (
                      <div className="text-zinc-700">Dedicated Pet: {completedReceipt.targetPetName}</div>
                    )}
                    <div className="text-zinc-500">Payment: DuitNow Instant Rail</div>
                  </div>
                </div>

                <div className="border-t border-b border-zinc-200 py-3 flex items-center justify-between font-heading">
                  <span className="text-sm font-bold text-zinc-900">Total Contribution Received</span>
                  <span className="text-xl font-extrabold text-zinc-900">RM {completedReceipt.amountMYR}.00</span>
                </div>

                <div className="text-[10px] text-zinc-500 leading-relaxed italic">
                  * This receipt is computer generated and valid without signature under Malaysian Inland Revenue Board (LHDN) Section 44(6) Guidelines.
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
                <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                  <RotateCcw className="size-3.5" />
                  Make Another Contribution
                </Button>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handlePrintReceipt}
                    className="gap-1.5"
                  >
                    <Printer className="size-3.5" />
                    Print Receipt
                  </Button>
                  <Button size="sm" onClick={() => onOpenChange(false)}>
                    Done
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
