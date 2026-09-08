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
 * Extracts the Kuala Lumpur calendar date from a UTC instant.
 *
 * Two separate bugs are being avoided, and only one of them is hydration.
 *
 * `toLocaleDateString` with no `timeZone` renders in the *runtime's* zone — UTC
 * on the server, UTC+8 in a Malaysian browser — so the two passes disagree.
 * Formatting in UTC instead fixes that mismatch and keeps the second bug: a
 * pledge made at 01:00 MYT is 17:00 UTC the previous day, so every pledge
 * between midnight and 08:00 MYT would be shown a day early. On a screen whose
 * entire purpose is matching rows against a Malaysian bank statement, that is
 * the coordinator skipping a real transfer.
 *
 * `receiptScopeFor` in the donation ledger pins this same zone for the same
 * reason, and says so: "which month a receipt falls in is a local-calendar
 * question with tax consequences".
 *
 * Composed through `formatTimestampDate` rather than through a localized
 * pattern so the month name comes from the repo's own table. `Intl` month
 * abbreviations can differ across ICU versions, and Node's and the browser's
 * need not match — which would put the hydration mismatch straight back.
 */
const KUALA_LUMPUR_PARTS = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Kuala_Lumpur",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function pledgedOn(isoTimestamp: string): string {
  const when = new Date(isoTimestamp);
  if (Number.isNaN(when.getTime())) return isoTimestamp;

  const parts = KUALA_LUMPUR_PARTS.formatToParts(when);
  const part = (type: string) => parts.find((p) => p.type === type)?.value ?? "";

  return formatTimestampDate(`${part("year")}-${part("month")}-${part("day")}`);
}

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
        //
        // The wording deliberately does NOT claim no receipt was issued. The
        // action mints the receipt and THEN attaches it, so a connection blip
        // between those two steps rejects with a permanent receipt already in
        // the ledger. A coordinator told "nothing happened" clicks again, and
        // the pre-check still sees PENDING_PAYMENT — a second number from a
        // gapless statutory series for one payment. Unknown is the honest
        // answer from here, and the reloaded queue is how it gets resolved.
        setError(
          "The reconciliation did not complete, and it is not clear from here whether a receipt was issued. Reload this page and check whether this pledge is still listed before trying again — retrying blindly can issue a second receipt for the same payment."
        );
        router.refresh();
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
                <th scope="col" className="p-3.5 text-left sm:p-4">
                  Pledge reference
                </th>
                <th scope="col" className="p-3.5 text-left sm:p-4">
                  Supporter
                </th>
                <th scope="col" className="p-3.5 text-left sm:p-4">
                  Animal
                </th>
                <th scope="col" className="p-3.5 text-right sm:p-4">
                  Amount
                </th>
                {/* Names the payment method too. The cell carries both, and a
                    screen reader announcing an unlabelled "DuitNow QR" after a
                    date is the column header's omission, not the cell's. */}
                <th scope="col" className="p-3.5 text-left sm:p-4">
                  Pledged / method
                </th>
                <th scope="col" className="p-3.5 text-right sm:p-4">
                  Action
                </th>
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
                    <p className="font-mono text-xs text-muted-foreground">
                      {pledgedOn(row.createdAt)}
                    </p>
                    <p className="text-xs text-muted-foreground">{row.paymentMethodLabel}</p>
                  </td>

                  <td className="p-3.5 text-right sm:p-4">
                    {/* Every row is disabled while any one is settling, not
                        just the busy row. That is deliberate: each click issues
                        an irreversible statutory receipt, and serialising them
                        is worth more than letting a coordinator start a second
                        one before the first has reported. */}
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

      {/* Kept alongside the button spinner and the dimmed table rather than
          removed as a third indicator: those two are purely visual, and this is
          the only one a screen reader announces. `role="status"` is what makes
          it carry that weight instead of just repeating them. */}
      {isPending && (
        <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
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
