"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import {
  AlertCircle,
  BadgeCheck,
  Ban,
  CheckCircle2,
  HandCoins,
  Inbox,
  Receipt,
  RotateCw,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  listPendingSponsorshipsAction,
  reconcilePetSponsorshipAction,
  rejectPetSponsorshipAction,
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

/** The row the coordinator has opened for a second step, and which step. */
interface RowIntent {
  pledgeRef: string;
  action: "confirm" | "dismiss";
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
    // A denial lands here too, as the guard's own message: the action asserts the
    // permission inside its try, so a STAFF account that typed the URL is told it
    // may not reconcile payments rather than that the shelter is down.
    return { error: result.error ?? "Could not load the pending commitments." };
  } catch {
    // The call itself failed. Deliberately no cause: a stale action id after a deploy
    // lands here too, and the server was reached fine in that case. A reload cures
    // both; Refresh Queue cures only the outage.
    return {
      error:
        "The pending commitments could not be loaded. Reload the page and try again. This is a read failure, not an empty queue.",
    };
  }
}

/** Literal class strings, so the design-system guards can see every tone used. */
const NOTICE_TONE = {
  danger: "tone-soft tone-danger",
  warning: "tone-soft tone-warning",
  info: "tone-soft tone-info",
} as const;

/** One banner shape for the three things the queue has to say above the rows. */
function Notice({
  role,
  tone,
  icon: Icon,
  children,
}: {
  role: "alert" | "status";
  tone: keyof typeof NOTICE_TONE;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <div
      role={role}
      className={`${NOTICE_TONE[tone]} flex items-start gap-3 rounded-xl border p-4 text-sm`}
    >
      <Icon className="size-4 shrink-0 mt-0.5" />
      <p>{children}</p>
    </div>
  );
}

/**
 * The coordinator's reconciliation queue.
 *
 * Confirming a row is what turns a commitment into a statutory document: it draws a
 * number from the same gapless monthly series every other receipt uses and emails it
 * to the supporter. That is irreversible — `Donation` is append-only and a receipt
 * cannot be withdrawn, only offset — so the button asks once before firing.
 *
 * Dismissing a row is the other way out: a claim no transfer ever backed leaves the
 * queue as `CANCELLED`, nothing is issued, and the reason goes to the audit log. It
 * also asks once, because a dismissed pledge cannot be confirmed afterwards.
 */
export function SponsorshipReconciliation() {
  const [rows, setRows] = useState<PendingSponsorshipDTO[]>([]);
  const [settled, setSettled] = useState<SettledRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  // Distinct from "no rows". A read failure must never render as an empty queue.
  const [loadError, setLoadError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowNotice, setRowNotice] = useState<string | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [intent, setIntent] = useState<RowIntent | null>(null);
  const [dismissReason, setDismissReason] = useState("");

  const apply = useCallback((outcome: QueueOutcome) => {
    if (outcome.rows) {
      // `[]` is a successful empty queue, not a failure — the check is on the field
      // being present, never on its length.
      setRows(outcome.rows);
      setLoadError(null);
    } else {
      setLoadError(outcome.error ?? "Could not load the pending commitments.");
      // Drop the stale queue with it. Leaving the previous rows on screen puts live
      // Confirm buttons directly beneath a banner saying the read failed — the screen
      // would be asserting pending work at the one moment it has just said not to
      // trust it, and another coordinator may have settled those rows already.
      setRows([]);
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
    setRowNotice(null);
    setIntent(null);
    apply(await fetchPending());
    setIsLoading(false);
  }, [apply]);

  const openIntent = (pledgeRef: string, action: RowIntent["action"]) => {
    setDismissReason("");
    setIntent({ pledgeRef, action });
  };

  const confirm = async (row: PendingSponsorshipDTO) => {
    setBusyRef(row.pledgeRef);
    setRowError(null);
    setRowNotice(null);
    setIntent(null);

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
        "The outcome is unconfirmed. Reload the queue before trying again."
      );
    } finally {
      setBusyRef(null);
    }
  };

  const dismiss = async (row: PendingSponsorshipDTO) => {
    const reason = dismissReason;
    setBusyRef(row.pledgeRef);
    setRowError(null);
    setRowNotice(null);
    setIntent(null);
    setDismissReason("");

    try {
      const result = await rejectPetSponsorshipAction(row.pledgeRef, reason);

      if (result.success) {
        setRows((prev) => prev.filter((r) => r.pledgeRef !== row.pledgeRef));
        setRowNotice(
          `${row.pledgeRef} for ${row.sponsorName} was dismissed. No receipt was issued.`
        );
      } else {
        setRowError(result.error ?? "The pledge could not be dismissed.");
      }
    } catch {
      setRowError(
        "The outcome is unconfirmed. Reload the queue before trying again."
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
              Confirm a transfer has landed to issue the supporter&apos;s official receipt. Match
              the <span className="font-mono font-semibold">HFS-PLG</span> reference
              against your bank statement — a pledge reference is not a receipt number. Dismiss a
              pledge that no transfer ever backed.
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
        <Notice role="alert" tone="danger" icon={AlertCircle}>
          {loadError}
        </Notice>
      )}

      {rowError && (
        <Notice role="alert" tone="warning" icon={AlertCircle}>
          {rowError}
        </Notice>
      )}

      {rowNotice && (
        <Notice role="status" tone="info" icon={Ban}>
          {rowNotice}
        </Notice>
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
            const rowIntent = intent?.pledgeRef === row.pledgeRef ? intent.action : null;
            const cancelButton = (
              <Button
                variant="outline"
                size="xs"
                onClick={() => setIntent(null)}
                disabled={isBusy}
                className="text-xs"
              >
                Cancel
              </Button>
            );

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

                <div className="flex flex-col sm:flex-row sm:items-center gap-3 shrink-0">
                  <span className="text-base font-bold font-mono text-foreground">
                    {row.amountDisplay}
                  </span>

                  {rowIntent === "confirm" ? (
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
                      {cancelButton}
                    </div>
                  ) : rowIntent === "dismiss" ? (
                    <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                      <Input
                        value={dismissReason}
                        onChange={(event) => setDismissReason(event.target.value)}
                        placeholder="Reason (optional), e.g. no transfer after 30 days"
                        aria-label={`Reason for dismissing ${row.pledgeRef}`}
                        maxLength={500}
                        disabled={isBusy}
                        className="h-8 text-xs sm:w-64"
                      />
                      <Button
                        variant="destructive"
                        size="xs"
                        onClick={() => void dismiss(row)}
                        disabled={isBusy}
                        className="text-xs font-bold gap-1.5"
                        // Two steps because a dismissed pledge cannot be confirmed afterwards.
                        title="Remove this pledge from the queue. Nothing is issued."
                      >
                        <Ban className="size-3.5" />
                        {isBusy ? "Dismissing…" : "Dismiss pledge"}
                      </Button>
                      {cancelButton}
                    </div>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="xs"
                        onClick={() => openIntent(row.pledgeRef, "confirm")}
                        disabled={isBusy || busyRef !== null}
                        className="text-xs gap-1.5 font-semibold tone-soft tone-success hover:bg-success-surface"
                        // Two steps because the receipt cannot be withdrawn once issued.
                        title="Confirm this transfer has landed and issue the official receipt"
                      >
                        <CheckCircle2 className="size-3.5" />
                        Confirm payment received
                      </Button>
                      <Button
                        variant="ghost"
                        size="xs"
                        onClick={() => openIntent(row.pledgeRef, "dismiss")}
                        disabled={isBusy || busyRef !== null}
                        className="text-xs gap-1.5 text-muted-foreground"
                        title="Dismiss a pledge that no transfer ever backed"
                      >
                        <Ban className="size-3.5" />
                        Dismiss
                      </Button>
                    </div>
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
