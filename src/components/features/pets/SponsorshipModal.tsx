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
import { Textarea } from "@/components/ui/textarea";
import {
  HeartHandshake,
  QrCode,
  CheckCircle2,
  Copy,
  Printer,
  ShieldCheck,
  ArrowRight,
  RotateCcw,
  RotateCw,
  Heart,
  Building2,
  Sparkles,
} from "lucide-react";
import {
  useSponsorshipController,
  UseSponsorshipControllerProps,
} from "@/hooks/useSponsorshipController";

export function SponsorshipModal(props: UseSponsorshipControllerProps) {
  const { open, onOpenChange, targetPet } = props;
  const { state, handlers } = useSponsorshipController(props);
  const {
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
    tiers,
  } = state;
  const {
    setSelectedTier,
    setIsCustomTier,
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
  } = handlers;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[95vw] sm:max-w-3xl lg:max-w-4xl max-h-[92vh] overflow-y-auto p-0 border border-border bg-card shadow-2xl rounded-2xl">
        {/* Header Banner */}
        <div className="bg-primary text-primary-foreground p-6 sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold uppercase tracking-wider bg-primary-foreground/15 text-primary-foreground rounded-md">
              <HeartHandshake className="size-3.5" />
              Rescue Giving & Sponsorship
            </span>

            {targetPet && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold bg-white/20 px-2.5 py-0.5 rounded-sm">
                <Heart className="size-3 fill-current" />
                Dedicated Pet: {targetPet.name} ({targetPet.breed})
              </span>
            )}
          </div>

          <DialogHeader className="text-left">
            <DialogTitle className="font-heading text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight text-primary-foreground">
              {targetPet ? `Sponsor ${targetPet.name}'s Recovery` : "Sponsor a Rescue Animal"}
            </DialogTitle>
            <DialogDescription className="text-primary-foreground/85 text-sm sm:text-base mt-1.5 max-w-2xl leading-relaxed">
              100% of your tax-deductible contribution funds critical veterinary surgery, core immunisations, and nutrition in Petaling Jaya, Selangor.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Modal Body */}
        <div className="p-6 sm:p-8 lg:p-9 space-y-7">
          {errorMessage && (
            <div className="bg-destructive/10 border border-destructive/30 p-4 text-sm text-destructive font-medium rounded-lg flex items-center gap-2">
              <span>⚠️ {errorMessage}</span>
            </div>
          )}

          {!completedReceipt ? (
            <form onSubmit={handleCompleteDonation} className="space-y-7">
              {/* Frequency Toggle */}
              <div className="flex items-center justify-between flex-wrap gap-3 pb-2 border-b border-border">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground">
                  1. Giving Frequency
                </label>
                <div className="inline-flex p-1 bg-muted rounded-lg border border-border">
                  <button
                    type="button"
                    onClick={() => setFrequency("one_time")}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all ${
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
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                      frequency === "monthly"
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <RotateCw className="size-3" />
                    Monthly Rescue Partner
                  </button>
                </div>
              </div>

              {/* 1. Select Sponsorship Tier */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-foreground block">
                    2. Choose Sponsorship Package or Custom Amount
                  </label>
                  <span className="text-xs font-semibold text-muted-foreground">
                    Selected Total: <strong className="text-primary font-mono text-sm">RM {finalAmount}.00</strong>
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {tiers.map((tier) => {
                    const isSelected = !isCustomTier && selectedTier.id === tier.id;
                    return (
                      <button
                        key={tier.id}
                        type="button"
                        onClick={() => setSelectedTier(tier)}
                        className={`p-4 rounded-xl border text-left flex flex-col justify-between transition-all cursor-pointer ${
                          isSelected
                            ? "border-primary bg-primary/5 ring-2 ring-primary shadow-xs"
                            : "border-border bg-card hover:bg-muted/50"
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between gap-1 mb-1">
                            <span className="font-heading text-lg font-bold text-foreground">
                              RM {tier.amount}
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 bg-secondary text-secondary-foreground rounded-md border border-border">
                              {tier.badgeText}
                            </span>
                          </div>
                          <div className="text-xs font-bold text-foreground line-clamp-1">{tier.name}</div>
                          <div className="text-[11px] text-muted-foreground mt-1 leading-snug line-clamp-2">
                            {tier.description}
                          </div>
                        </div>

                        <div className="mt-3 pt-2 border-t border-border/60 text-[10px] text-primary font-medium">
                          {tier.impactMetrics}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Custom Amount Option */}
                <div
                  className={`p-4 rounded-xl border transition-all ${
                    isCustomTier
                      ? "border-primary bg-primary/5 ring-2 ring-primary"
                      : "border-border bg-muted/20"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        id="customRadio"
                        name="tierOption"
                        checked={isCustomTier}
                        onChange={setIsCustomTier}
                        className="size-4.5 accent-primary"
                      />
                      <label htmlFor="customRadio" className="text-xs font-bold uppercase tracking-wider text-foreground cursor-pointer">
                        Custom Rescue Amount (RM)
                      </label>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">RM</span>
                      <Input
                        type="number"
                        min="5"
                        max="50000"
                        placeholder="e.g. 100"
                        value={customAmount}
                        onFocus={setIsCustomTier}
                        onChange={(e) => {
                          setIsCustomTier();
                          setCustomAmount(e.target.value);
                        }}
                        className="w-32 font-bold font-mono h-9 bg-background"
                      />
                      <span className="text-xs text-muted-foreground">(Min RM 5)</span>
                    </div>
                  </div>
                </div>

                {/* RM30/mo Rescue Companion Tier Highlights */}
                {(frequency === "monthly" || selectedTier.id === "kibble") && (
                  <div className="border border-primary/30 bg-primary/5 p-4 rounded-xl space-y-2.5">
                    <div className="flex items-center gap-1.5 font-heading text-xs font-bold text-foreground">
                      <Sparkles className="size-3.5 text-primary" />
                      <span>Rescue Companion Perks — {targetPet ? targetPet.name : "Shelter Rescues"}</span>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <div className="p-2.5 bg-background border border-primary/20 rounded-lg space-y-0.5">
                        <span className="font-bold text-foreground text-[11px] block">📸 Monthly Updates</span>
                        <span className="text-[10px] text-muted-foreground leading-tight block">WhatsApp & Email progress reports</span>
                      </div>
                      <div className="p-2.5 bg-background border border-primary/20 rounded-lg space-y-0.5">
                        <span className="font-bold text-foreground text-[11px] block">🏅 Digital Certificate</span>
                        <span className="text-[10px] text-muted-foreground leading-tight block">Official e-Certificate of Sponsorship</span>
                      </div>
                      <div className="p-2.5 bg-background border border-primary/20 rounded-lg space-y-0.5">
                        <span className="font-bold text-foreground text-[11px] block">🐾 Sanctuary Visits</span>
                        <span className="text-[10px] text-muted-foreground leading-tight block">Arranged visiting privileges</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 2. Malaysian Payment Rail (DuitNow QR + Direct Bank Transfer) */}
              <div className="border border-border bg-muted/30 p-5 sm:p-6 rounded-xl space-y-4">
                <div className="flex items-center justify-between border-b border-border pb-3">
                  <div className="flex items-center gap-2">
                    <QrCode className="size-4.5 text-primary" />
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      3. Official Payment Rail: DuitNow National QR / Maybank Transfer
                    </span>
                  </div>
                  <span className="text-xs font-bold font-mono text-primary bg-primary/10 px-2.5 py-1 rounded-md">
                    Amount: RM {finalAmount}.00 {frequency === "monthly" ? "/ month" : ""}
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-center">
                  {/* DuitNow QR Visual Box */}
                  <div className="border-2 border-brand-duitnow bg-receipt-paper text-receipt-ink p-4 rounded-xl flex flex-col items-center justify-center text-center shadow-sm">
                    <div className="text-[11px] font-extrabold uppercase tracking-widest text-brand-duitnow mb-0.5">
                      DuitNow QR
                    </div>
                    <div className="text-[10px] text-receipt-ink-muted font-semibold mb-2">
                      National QR Standard (PayNet Malaysia)
                    </div>

                    {/* QR Code SVG */}
                    <div className="w-36 h-36 border border-receipt-rule p-2 bg-receipt-paper flex items-center justify-center relative rounded-md">
                      <svg viewBox="0 0 100 100" className="w-full h-full text-receipt-ink fill-current">
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

                    <div className="text-[10px] font-bold text-receipt-ink-soft mt-2">
                      Hope for Strays Shelter Selangor
                    </div>
                    <div className="text-[9px] text-receipt-ink-faint font-mono">
                      Scan with Maybank MAE, CIMB, TNG eWallet, Public Bank, etc.
                    </div>
                  </div>

                  {/* Manual Bank Account Details */}
                  <div className="space-y-3 text-xs">
                    <div className="p-3.5 border border-border bg-card rounded-lg space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold flex items-center gap-1">
                        <Building2 className="size-3" /> Beneficiary Organization
                      </div>
                      <div className="font-bold text-foreground text-sm">Pertubuhan Kebajikan Hope for Strays</div>
                      <div className="text-[11px] text-muted-foreground">ROS Registration: PPM-021-10-18082021</div>
                    </div>

                    <div className="p-3.5 border border-border bg-card rounded-lg space-y-1">
                      <div className="text-[10px] text-muted-foreground uppercase font-bold">Maybank Account Details</div>
                      <div className="flex items-center justify-between gap-2">
                        <div>
                          <span className="font-mono font-bold text-foreground text-base tracking-wider block">5140 1234 5678</span>
                          <span className="text-[10px] text-muted-foreground">Malayan Banking Berhad (PJ Branch)</span>
                        </div>
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={handleCopyMaybank}
                          className="h-8 px-3 text-xs font-semibold gap-1.5"
                        >
                          {copiedBank ? <CheckCircle2 className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                          {copiedBank ? "Copied!" : "Copy"}
                        </Button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-muted-foreground bg-emerald-950/10 dark:bg-emerald-950/40 p-2.5 rounded-md border border-emerald-600/20">
                      <ShieldCheck className="size-4 text-emerald-600 shrink-0" />
                      <span>Official LHDN Tax-Exempt Reference: <strong>LHDN.01/35/42/51/179-6.4912</strong></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* 3. Donor Information for Official Tax Receipt */}
              <div className="space-y-4">
                <label className="text-xs font-bold uppercase tracking-wider text-foreground block">
                  4. Donor Details (For Official Tax-Exempt e-Receipt)
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="donorName" className="text-xs font-semibold">
                      Full Name / Corporate Entity <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="donorName"
                      required
                      placeholder="e.g. Rachel Lim / Apex Sdn Bhd"
                      value={donorName}
                      onChange={(e) => setDonorName(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="donorEmail" className="text-xs font-semibold">
                      Email Address (For e-Receipt Dispatch) <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="donorEmail"
                      type="email"
                      required
                      placeholder="rachel.lim@example.com"
                      value={donorEmail}
                      onChange={(e) => setDonorEmail(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="donorPhone" className="text-xs font-semibold">
                      WhatsApp / Mobile Phone (Optional)
                    </Label>
                    <Input
                      id="donorPhone"
                      placeholder="012-345 6789"
                      value={donorPhone}
                      onChange={(e) => setDonorPhone(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="taxIdOrIc" className="text-xs font-semibold">
                      NRIC / Passport / SSM No. (Optional - for LHDN deduction filing)
                    </Label>
                    <Input
                      id="taxIdOrIc"
                      placeholder="e.g. 920512-10-5432 / 202101012345"
                      value={taxIdOrIc}
                      onChange={(e) => setTaxIdOrIc(e.target.value)}
                    />
                  </div>

                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="notes" className="text-xs font-semibold">
                      Message of Encouragement to Sanctuary Caregivers (Optional)
                    </Label>
                    <Textarea
                      id="notes"
                      rows={2}
                      placeholder="Leave a message for our shelter team..."
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Submit & Cancel */}
              <div className="flex flex-col-reverse sm:flex-row sm:items-center justify-between gap-3 border-t border-border pt-5">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isProcessing} className="gap-2 font-bold px-7">
                  {isProcessing ? "Generating Official Receipt..." : `Confirm Sponsorship of RM ${finalAmount}`}
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </form>
          ) : (
            /* E-Receipt View */
            <div className="space-y-6">
              <div className="bg-emerald-900/10 border border-emerald-600/30 p-4 rounded-xl flex items-start gap-3">
                <CheckCircle2 className="size-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-heading text-sm font-bold text-foreground">
                    Sponsorship Confirmed! Thank You for Saving Rescue Lives.
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    An official tax-exempt receipt for <strong className="text-foreground">RM {completedReceipt.amountMYR}.00</strong> has been generated and dispatched to <strong>{completedReceipt.donorEmail}</strong>.
                  </p>
                </div>
              </div>

              {/* Printable Official Receipt Dossier */}
              <div id="donation-receipt-print" className="receipt p-6 sm:p-8 space-y-5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b-2 border-receipt-ink pb-4">
                  <div>
                    <h3 className="font-heading text-xl sm:text-2xl font-extrabold uppercase tracking-tight text-receipt-ink">
                      Hope for Strays Animal Sanctuary
                    </h3>
                    <p className="text-xs text-receipt-ink-muted">
                      No. 18, Jalan SS 2/72, 47300 Petaling Jaya, Selangor, Malaysia
                    </p>
                    <p className="text-[11px] text-receipt-ink-faint">
                      ROS Reg: {completedReceipt.shelterRegistrationNo} • Tax Exemption: {completedReceipt.taxDeductibleRef}
                    </p>
                  </div>

                  <div className="text-left sm:text-right">
                    <span className="inline-block px-2.5 py-1 bg-receipt-ink text-receipt-paper font-mono text-xs font-bold uppercase rounded-sm">
                      Official e-Receipt
                    </span>
                    <div className="font-mono text-xs font-bold text-receipt-ink-soft mt-1">
                      {completedReceipt.receiptNumber}
                    </div>
                    <div className="text-[11px] text-receipt-ink-faint">{completedReceipt.date}</div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div>
                    <div className="text-[10px] uppercase font-bold text-receipt-ink-faint">Issued To</div>
                    <div className="font-bold text-receipt-ink text-sm">{completedReceipt.donorName}</div>
                    <div className="text-receipt-ink-muted">{completedReceipt.donorEmail}</div>
                    {completedReceipt.donorPhone && <div className="text-receipt-ink-muted">{completedReceipt.donorPhone}</div>}
                    {completedReceipt.taxIdOrIc && <div className="text-receipt-ink-muted font-mono">IC/SSM: {completedReceipt.taxIdOrIc}</div>}
                  </div>

                  <div>
                    <div className="text-[10px] uppercase font-bold text-receipt-ink-faint">Sponsorship Allocation</div>
                    <div className="font-bold text-receipt-ink text-sm">{completedReceipt.tierName}</div>
                    {completedReceipt.targetPetName && (
                      <div className="text-receipt-ink-soft font-medium">🐾 Dedicated Pet: {completedReceipt.targetPetName}</div>
                    )}
                    <div className="text-receipt-ink-faint">Payment: DuitNow National Instant Rail</div>
                    {completedReceipt.frequency && (
                      <div className="text-receipt-ink-faint uppercase text-[10px]">Type: {completedReceipt.frequency.replace("_", " ")}</div>
                    )}
                  </div>
                </div>

                {completedReceipt.notes && (
                  <div className="p-3 receipt-panel border rounded-md text-xs italic">
                    &ldquo;{completedReceipt.notes}&rdquo;
                  </div>
                )}

                <div className="border-t border-b border-receipt-rule py-3 flex items-center justify-between font-heading">
                  <span className="text-sm font-bold text-receipt-ink">Total Contribution Received</span>
                  <span className="text-2xl font-extrabold receipt-accent">RM {completedReceipt.amountMYR}.00</span>
                </div>

                <div className="text-[10px] text-receipt-ink-faint leading-relaxed italic">
                  * This receipt is computer-generated and valid for income tax deduction under Subsection 44(6) of the Malaysian Income Tax Act 1967.
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
                    Print / Save Receipt
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
