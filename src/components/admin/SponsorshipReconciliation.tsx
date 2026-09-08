"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertCircle,
  BadgeCheck,
  CheckCircle2,
  HandCoins,
  Inbox,
  Receipt,
  RotateCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  listPendingSponsorshipsAction,
  reconcilePetSponsorshipAction,
  type PendingSponsorshipDTO,
} from "@/actions/sponsorships";

/** A pledge that has just been settled, kept on screen so the number is readable. */
interface SettledRow {
  pledgeRef: string;
  sponsorName: string;
  receiptNumber: string;
}

const PAYMENT_LABELS: Record<PendingSponsorshipDTO["paymentMethod"], string> = {
  duitnow_qr: "DuitNow QR (PayNet)",
  online_banking: "Direct Bank Transfer",
  card: "Credit / Debit Card",
};

/** What one attempt at the queue produced. Exactly one field is ever set. */
interface QueueOutcome {
  rows?: PendingSponsorshipDTO[];
  error?: string;
}

/**
 * Module-level and state-free on purpose.
 *
 * The mount effect and the refresh button both need this, and lifting it out is
 * what lets them share one implementation without the effect calling a state
 * setter synchronously — which `react-hooks/set-state-in-effect` rejects, and
 * rightly: a synchronous set in an effect is a second render before paint.
 */
async function fetchPending(): Promise<QueueOutcome> {
  try {
    const result = await listPendingSponsorshipsAction();
    if (result.success && result.data) return { rows: result.data };
    return { error: result.error ?? "Could not load the pending commitments." };
  } catch {
    return {
      error:
        "Could not reach the shelter to load pending commitments. This is a read failure, not an empty queue.",
    };
  }
}

/**
 * The coordinator's reconciliation queue.
 *
 * Confirming a row is what turns a commitment into a statutory document: it draws a
 * number from the same gapless monthly series every other receipt uses and emails it
 * to the supporter. That is irreversible — `Donation` is append-only and a receipt
 * cannot be withdrawn, only offset — so the button asks once before firing.
 */
export function SponsorshipReconciliation() {
  const [rows, setRows] = useState<PendingSponsorshipDTO[]>([]);
  const [settled, setSettled] = useState<SettledRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Distinct from "no rows". A read failure must never render as an empty queue.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [confirmingRef, setConfirmingRef] = useState<string | null>(null);

  const apply = useCallback((outcome: QueueOutcome) => {
    if (outcome.rows) {
      setRows(outcome.rows);
      setLoadError(null);
    } else {
      setLoadError(outcome.error ?? "Could not load the pending commitments.");
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    void (async () => {
      const outcome = await fetchPending();
      // `isLoading` starts true, so the first load needs no synchronous set here.
      if (ignore) return;
      apply(outcome);
      setIsLoading(false);
    })();
    return () => {
      ignore = true;
    };
  }, [apply]);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    setRowError(null);
    apply(await fetchPending());
    setIsLoading(false);
  }, [apply]);

  const confirm = async (row: PendingSponsorshipDTO) => {
    setBusyRef(row.pledgeRef);
    setRowError(null);
    setConfirmingRef(null);

    try {
      const result = await reconcilePetSponsorshipAction(row.pledgeRef);

      if (result.success && result.receiptNumber) {
        // `already_reconciled` also lands here, carrying the number that already
        // exists. Two coordinators clicking at once is a settled outcome, not an
        // error, and rendering it as one would send someone hunting a failure that
        // did not happen.
        setSettled((prev) => [
          { pledgeRef: row.pledgeRef, sponsorName: row.sponsorName, receiptNumber: result.receiptNumber! },
          ...prev,
        ]);
        setRows((prev) => prev.filter((r) => r.pledgeRef !== row.pledgeRef));
      } else {
        setRowError(result.error ?? "The confirmation did not complete.");
      }
    } catch {
      setRowError(
        "We could not confirm that commitment. Nothing was issued — please reload and try again."
      );
    } finally {
      setBusyRef(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="border border-border bg-background p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center bg-info-solid text-info-on-solid">
            <HandCoins className="size-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">
              Sponsorship Payment Reconciliation
            </h2>
            <p className="text-xs text-muted-foreground">
              Confirm a transfer has landed to issue the supporter&apos;s LHDN Section 44(6)
              receipt. Match the <span className="font-mono font-semibold">HFS-PLG</span> reference
              against your bank statement — a pledge reference is not a receipt number.
            </p>
          </div>
        </div>

        <Button
          variant="outline"
          size="xs"
          onClick={() => void refresh()}
          disabled={isLoading}
          className="text-xs gap-1.5 font-semibold"
        >
          <RotateCw className={`size-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Refresh Queue
        </Button>
      </div>

      {loadError && (
        <div
          role="alert"
          className="tone-soft tone-danger flex items-start gap-3 rounded-xl border p-4 text-sm"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <p>{loadError}</p>
        </div>
      )}

      {rowError && (
        <div
          role="alert"
          className="tone-soft tone-warning flex items-start gap-3 rounded-xl border p-4 text-sm"
        >
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <p>{rowError}</p>
        </div>
      )}

      {settled.length > 0 && (
        <div className="tone-soft tone-success rounded-xl border p-4 space-y-2">
          <p className="eyebrow flex items-center gap-1.5">
            <BadgeCheck className="size-3.5" />
            Receipts issued this session
          </p>
          <ul className="space-y-1 text-sm">
            {settled.map((s) => (
              <li key={s.pledgeRef} className="flex flex-wrap items-center gap-x-2">
                <Receipt className="size-3.5 shrink-0" />
                <span className="font-semibold">{s.sponsorName}</span>
                <span className="font-mono text-xs">{s.pledgeRef}</span>
                <span aria-hidden>&rarr;</span>
                <span className="font-mono text-xs font-bold">{s.receiptNumber}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {isLoading && rows.length === 0 && !loadError && (
        <p className="text-sm text-muted-foreground p-4">Loading pending commitments…</p>
      )}

      {!isLoading && !loadError && rows.length === 0 && (
        <div className="border border-border bg-background p-8 text-center space-y-2">
          <Inbox className="size-6 mx-auto text-muted-foreground" />
          <p className="text-sm font-semibold text-foreground">Nothing awaiting confirmation</p>
          <p className="text-xs text-muted-foreground">
            Every commitment has been reconciled. New pledges appear here as supporters complete
            checkout.
          </p>
        </div>
      )}

      {rows.length > 0 && (
        <div className="border border-border bg-background divide-y divide-border">
          {rows.map((row) => {
            const isBusy = busyRef === row.pledgeRef;
            const isConfirming = confirmingRef === row.pledgeRef;

            return (
              <div
                key={row.pledgeRef}
                className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-sm font-bold text-foreground">
                      {row.pledgeRef}
                    </span>
                    <span className="tone-chip tone-warning">Pending payment</span>
                  </div>
                  <p className="text-sm text-foreground">
                    <span className="font-semibold">{row.sponsorName}</span>
                    <span className="text-muted-foreground"> · {row.sponsorEmail}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {row.tierName} for {row.petName} ·{" "}
                    {row.frequency === "monthly" ? "Monthly" : "One-time"} ·{" "}
                    {PAYMENT_LABELS[row.paymentMethod]} · pledged{" "}
                    {new Date(row.createdAt).toLocaleDateString("en-MY", {
                      timeZone: "Asia/Kuala_Lumpur",
                      year: "numeric",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-base font-bold font-mono text-foreground">
                    {row.amountDisplay}
                  </span>

                  {isConfirming ? (
                    <div className="flex items-center gap-2">
                      <Button
                        size="xs"
                        onClick={() => void confirm(row)}
                        disabled={isBusy}
                        className="text-xs font-bold gap-1.5"
                      >
                        <CheckCircle2 className="size-3.5" />
                        {isBusy ? "Issuing…" : "Issue receipt"}
                      </Button>
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => setConfirmingRef(null)}
                        disabled={isBusy}
                        className="text-xs"
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="xs"
                      onClick={() => setConfirmingRef(row.pledgeRef)}
                      disabled={isBusy || busyRef !== null}
                      className="text-xs gap-1.5 font-semibold tone-soft tone-success hover:bg-success-surface"
                      // Two steps because the receipt cannot be withdrawn once issued.
                      title="Confirm this transfer has landed and issue the tax receipt"
                    >
                      <CheckCircle2 className="size-3.5" />
                      Confirm payment received
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
