"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, Inbox, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatTimestampDate } from "@/lib/domain/transparency";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  reconcilePetSponsorshipAction,
  type PendingSponsorshipDTO,
} from "@/actions/sponsorships";

/**
 * The coordinator's reconciliation queue.
 *
 * ## Why there is no client copy of the rows
 *
 * The queue arrives as a prop from the server page and is never lifted into
 * `useState`. `reconcilePetSponsorshipAction` does not `revalidatePath`, so
 * `router.refresh()` re-runs the page and hands down a fresh queue — the same
 * rule `useMemberTableController` states: client state survives a server
 * re-render, and a stale row in a payment queue is a supporter who gets paid
 * twice or not at all.
 *
 * ## Why confirming is a dialog and not a button
 *
 * Activation is the only path in the application that mints a statutory
 * receipt. `Donation` is append-only by database trigger, so the number cannot
 * be withdrawn, and the supporter is emailed a copy immediately. A misclick is
 * corrected by an offsetting accounting entry, not by an undo. The dialog
 * exists to name that, with the amount and the supporter in it.
 */
export function SponsorshipReconciliationTable({
  pending,
}: {
  pending: PendingSponsorshipDTO[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [candidate, setCandidate] = useState<PendingSponsorshipDTO | null>(null);
  const [busyRef, setBusyRef] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [settled, setSettled] = useState<{ pledgeRef: string; receiptNumber: string } | null>(
    null
  );

  function verify(row: PendingSponsorshipDTO) {
    setError(null);
    setSettled(null);
    setBusyRef(row.pledgeRef);

    startTransition(async () => {
      try {
        const result = await reconcilePetSponsorshipAction(row.pledgeRef);

        if (!result.success || !result.receiptNumber) {
          setError(result.error ?? "The sponsorship could not be reconciled.");
          // The server's view of this row has probably moved on — someone else
          // settled it, or it is gone. Refresh so the queue stops offering a
          // button that just failed.
          router.refresh();
          return;
        }

        // A second coordinator settling the same pledge comes back here too,
        // with the number that already exists. That is a success, not a
        // collision — the ledger returned `already_reconciled` and refused to
        // mint a second receipt for the same money. Rendering it as an error
        // would send someone hunting for a fault that is the guard working.
        setSettled({ pledgeRef: row.pledgeRef, receiptNumber: result.receiptNumber });
        router.refresh();
      } catch {
        // The action REJECTS rather than returning for anything its guard or a
        // database outage throws: `assertAuthorized` throws, and the session
        // cookie lives 24 hours, so a console left open overnight is the
        // ordinary case rather than an exotic one. Without this catch the row
        // would keep its spinner forever and the banner above would never
        // render, because there is no `error.tsx` anywhere under `src/app` to
        // pick the rejection up.
        setError(
          "The reconciliation could not be completed, and no receipt was issued. Your sign-in may have expired — reload this page and sign in again before retrying."
        );
      } finally {
        setBusyRef(null);
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 border border-danger-border bg-danger-surface p-3 text-sm text-danger-text"
        >
          <XCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p className="leading-relaxed">{error}</p>
        </div>
      )}

      {settled && (
        <div
          role="status"
          className="flex items-start gap-2 border border-success-border bg-success-surface p-3 text-sm text-success-text"
        >
          <CheckCircle2 className="mt-0.5 size-4 shrink-0" aria-hidden />
          {/* Says "issued", not "emailed". The receipt is written in the same
              request and is certain; the email is dispatched without being
              awaited, and an already-reconciled pledge sends none at all — so
              claiming delivery here would tell a coordinator something this
              screen has not observed. */}
          <p className="leading-relaxed">
            {settled.pledgeRef} is active. Receipt{" "}
            <span className="font-mono font-bold">{settled.receiptNumber}</span> has been issued.
            A copy is emailed to the supporter separately; delivery is not confirmed here.
          </p>
        </div>
      )}

      <div
        className={
          isPending
            ? "overflow-hidden border border-border bg-card opacity-60"
            : "overflow-hidden border border-border bg-card"
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border bg-muted/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="p-3.5 text-left sm:p-4">Pledge reference</th>
                <th className="p-3.5 text-left sm:p-4">Supporter</th>
                <th className="p-3.5 text-left sm:p-4">Animal</th>
                <th className="p-3.5 text-right sm:p-4">Amount</th>
                <th className="p-3.5 text-left sm:p-4">Pledged</th>
                <th className="p-3.5 text-right sm:p-4">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {pending.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-muted-foreground">
                    <Inbox className="mx-auto mb-2 size-6 text-muted-foreground/60" aria-hidden />
                    <p className="text-sm font-medium">Nothing is waiting to be reconciled.</p>
                    <p className="mt-1 text-xs leading-relaxed">
                      Commitments appear here the moment a supporter completes the sponsorship
                      form and before any money has been verified.
                    </p>
                  </td>
                </tr>
              )}

              {pending.map((row) => (
                <tr key={row.pledgeRef} className="transition-colors hover:bg-muted/30">
                  {/* Prominent and monospaced: this is the string the coordinator
                      is matching against a line on a bank statement. */}
                  <td className="p-3.5 sm:p-4">
                    <span className="font-mono text-sm font-bold text-foreground">
                      {row.pledgeRef}
                    </span>
                    <span className="mt-1 block">
                      <span className="tone-chip tone-warning">Pending payment</span>
                    </span>
                    {row.notes && (
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        “{row.notes}”
                      </p>
                    )}
                  </td>

                  <td className="p-3.5 sm:p-4">
                    <p className="text-sm font-medium text-foreground">{row.sponsorName}</p>
                    <p className="text-xs text-muted-foreground">{row.sponsorEmail}</p>
                    {row.sponsorPhone && (
                      <p className="text-xs text-muted-foreground">{row.sponsorPhone}</p>
                    )}
                  </td>

                  <td className="p-3.5 sm:p-4">
                    <p className="text-sm text-foreground">{row.petName}</p>
                    <p className="text-xs text-muted-foreground">{row.tierName}</p>
                  </td>

                  <td className="p-3.5 text-right sm:p-4">
                    <p className="font-mono text-sm font-bold text-foreground">
                      {row.amountDisplay}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {row.frequency === "monthly" ? "Monthly" : "One-time"}
                    </p>
                  </td>

                  <td className="p-3.5 sm:p-4">
                    {/* The shared UTC formatter, not `toLocaleDateString`: this
                        component is server-rendered and then hydrated, and a
                        runtime-zone format makes a UTC server and a UTC+8
                        browser disagree about the day for any pledge made after
                        16:00 UTC — a wrong date and a hydration mismatch. */}
                    <p className="font-mono text-xs text-muted-foreground">
                      {formatTimestampDate(row.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.paymentMethod}</p>
                  </td>

                  <td className="p-3.5 text-right sm:p-4">
                    <Button
                      size="xs"
                      onClick={() => setCandidate(row)}
                      disabled={isPending}
                      aria-label={`Verify and activate ${row.pledgeRef}`}
                    >
                      {busyRef === row.pledgeRef && (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden />
                      )}
                      Verify &amp; Activate
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isPending && (
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          Issuing receipt…
        </p>
      )}

      <Dialog
        open={!!candidate}
        onOpenChange={(open) => {
          if (!open) setCandidate(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm this transfer has landed?</DialogTitle>
            <DialogDescription className="leading-relaxed">
              Only do this once you have found{" "}
              <span className="font-mono font-bold">{candidate?.pledgeRef}</span> on a bank
              statement.
            </DialogDescription>
          </DialogHeader>

          {candidate && (
            <div className="space-y-3 text-sm">
              <dl className="space-y-1.5 border border-border bg-muted/40 p-3">
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Supporter</dt>
                  <dd className="text-right font-medium text-foreground">
                    {candidate.sponsorName}
                  </dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Animal</dt>
                  <dd className="text-right font-medium text-foreground">{candidate.petName}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-muted-foreground">Amount</dt>
                  <dd className="text-right font-mono font-bold text-foreground">
                    {candidate.amountDisplay}
                  </dd>
                </div>
              </dl>

              <div className="flex items-start gap-2 border border-warning-border bg-warning-surface p-3 text-warning-text">
                <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
                <p className="text-xs leading-relaxed">
                  This issues a numbered tax receipt and emails it to {candidate.sponsorEmail}.
                  Receipts are permanent records — a mistake here is corrected with an offsetting
                  entry by the treasurer, not by deleting it.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setCandidate(null)}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={isPending}
              onClick={() => {
                const target = candidate;
                setCandidate(null);
                if (target) verify(target);
              }}
            >
              {isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              Issue receipt &amp; activate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
