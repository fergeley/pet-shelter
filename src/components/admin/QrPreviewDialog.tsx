"use client";

import React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { DonationQrPanel } from "@/components/features/donations/DonationQrPanel";
import { resolveDonationQr } from "@/lib/domain/qrCode";
import { AlertTriangle, Info } from "lucide-react";

/**
 * Shows the pending QR exactly as a donor will see it.
 *
 * This renders the real `DonationQrPanel` — the same component the public
 * `/donate` widget and the pet sponsorship modal use — rather than a mock-up of
 * it. A preview built from separate markup would be free to drift away from
 * what actually ships, which would make it worse than no preview at all.
 */

interface QrPreviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Pending (possibly unsaved) shelter QR image URL. Leave undefined — never
   * coerce to "" — so `DonationQrPanel` falls back to `DonationQrProvider`.
   * The pet dialog passes nothing here and must still preview the shelter's
   * live QR, which is what a donor would actually see for that animal.
   */
  shelterQrUrl?: string;
  /** Pending (possibly unsaved) payment payload. Same nullish contract. */
  paymentPayload?: string;
  /** Pending Touch 'n Go code, so the preview can offer that rail. */
  tngQrUrl?: string;
  /** Pending bank-transfer code. */
  bankQrUrl?: string;
  /** Pending shelter name, used for the caption under the code. */
  shelterName?: string;
  /** Pending per-animal QR, when previewing from the pet dialog. */
  petCustomQrUrl?: string;
  petName?: string;
  /** True when the values shown have not been saved yet. */
  dirty?: boolean;
}

const SOURCE_EXPLANATION: Record<string, string> = {
  "pet-image": "This animal's dedicated fund-drive QR. It overrides the shelter default wherever this animal's sponsorship modal appears.",
  "shelter-image": "The shelter's uploaded QR image, shown on every public donation surface.",
  generated: "Generated from the payment payload. No image was uploaded, so the code is rendered from the DuitNow string.",
  placeholder: "No QR image and no payment payload are configured, so donors see the decorative sample with a warning.",
};

export function QrPreviewDialog({
  open,
  onOpenChange,
  shelterQrUrl,
  paymentPayload,
  tngQrUrl,
  bankQrUrl,
  shelterName,
  petCustomQrUrl,
  petName,
  dirty = false,
}: QrPreviewDialogProps) {
  // Only build an override when the caller actually supplied shelter-level
  // values. The pet dialog passes none, and must keep falling back to the
  // live provider config so it previews the code a donor would really get.
  const configOverride =
    shelterQrUrl === undefined &&
    paymentPayload === undefined &&
    tngQrUrl === undefined &&
    bankQrUrl === undefined
      ? undefined
      : {
          duitNowQrUrl: shelterQrUrl ?? "",
          tngQrUrl: tngQrUrl ?? "",
          bankQrUrl: bankQrUrl ?? "",
          paymentPayload: paymentPayload ?? "",
          shelterName: shelterName ?? "",
        };
  const resolved = resolveDonationQr({
    petCustomQrUrl,
    petName,
    shelterQrUrl,
    paymentPayload,
    shelterName,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader className="mb-2 pb-2 border-b border-border">
          <DialogTitle className="font-heading text-xl font-bold text-foreground">
            Donor Preview
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            How this QR code will appear on the public donation modals.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center py-2">
          <DonationQrPanel
            compact
            petCustomQrUrl={petCustomQrUrl}
            petName={petName}
            configOverride={configOverride}
          />
        </div>

        <div className="flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
          <Info className="size-3.5 shrink-0 mt-0.5 text-muted-foreground" />
          <p className="text-3xs leading-relaxed text-muted-foreground">
            {SOURCE_EXPLANATION[resolved.kind]}
          </p>
        </div>

        {dirty && (
          <div className="flex items-start gap-2 rounded-lg border border-warning-border bg-warning-surface p-3">
            <AlertTriangle className="size-3.5 shrink-0 mt-0.5 text-warning-text" />
            <p className="text-3xs leading-relaxed text-warning-text font-medium">
              These changes are not saved yet. Donors still see the previously
              saved QR until you save.
            </p>
          </div>
        )}

        <div className="flex justify-end pt-1">
          <Button type="button" variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close preview
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
