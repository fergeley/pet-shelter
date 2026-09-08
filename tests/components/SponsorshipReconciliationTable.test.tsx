import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";

/**
 * The table calls this Server Action directly. Importing the real module pulls
 * `@/lib/server/prisma` — and through it `pg` — into jsdom, which is both slow
 * and beside the point: Tier 4 owns what the table does with the action's
 * *answer*, and Tier 3 owns whether the action is right.
 *
 * Hoisted above the component import so the component closes over the double.
 * `PendingSponsorshipDTO` is imported for its type only (in `./support/
 * sponsorships`), so the factory needs no second export to satisfy it.
 */
const reconcilePetSponsorshipAction = vi.hoisted(() => vi.fn());
vi.mock("@/actions/sponsorships", () => ({ reconcilePetSponsorshipAction }));

import { SponsorshipReconciliationTable } from "@/components/features/sponsors/SponsorshipReconciliationTable";
// `next/navigation` is already doubled by the global harness; `useRouter()`
// returns this object, and `resetNextMocks()` clears its spies before every
// test. A second `vi.mock("next/navigation", ...)` here would override the
// harness for this file and hand the component a different router than the one
// asserted on — the failure mode the harness exists to prevent.
import { routerMock } from "../setup/nextMocks";
import { setupUser } from "./support/render";
import { makePendingSponsorship } from "./support/sponsorships";

const RECEIPT_NUMBER = "HFS-DON-202609-0007";

function renderQueue(pending = [makePendingSponsorship()]) {
  const result = render(<SponsorshipReconciliationTable pending={pending} />);
  return { ...result, pending, user: setupUser() };
}

/** The per-row trigger, addressed by the aria-label that names its pledge. */
const verifyButton = (pledgeRef: string) =>
  screen.getByRole("button", { name: new RegExp(`verify and activate ${pledgeRef}`, "i") });

/** The dialog's confirm button — the only control that reaches the action. */
const confirmButton = () =>
  within(screen.getByRole("dialog")).getByRole("button", {
    name: /issue receipt & activate/i,
  });

beforeEach(() => {
  reconcilePetSponsorshipAction.mockReset();
});

describe("SponsorshipReconciliationTable", () => {
  /**
   * The queue is read against a Malaysian bank statement, so the date shown has
   * to be the Kuala Lumpur calendar date, not the UTC one.
   *
   * The fixture's instant is 17:00 UTC, which is 01:00 the following day in
   * MYT — inside the eight-hour window where the two disagree. Rendering in UTC
   * (or in the runtime's zone, which is UTC under jsdom here) shows the 2nd; the
   * correct answer is the 3rd. `donationLedger.receiptScopeFor` pins the same
   * zone for the same reason, and its comment spells out the consequence: a
   * local-calendar question with tax consequences.
   */
  it("renders the Kuala Lumpur calendar date, not the UTC one", () => {
    renderQueue([
      makePendingSponsorship({ createdAt: "2026-09-02T17:00:00.000Z" }),
    ]);

    expect(screen.getByText("3 September 2026")).toBeInTheDocument();
    expect(screen.queryByText("2 September 2026")).not.toBeInTheDocument();
  });

  it("renders a pending row with the preformatted amount and rail label, never the raw enum", () => {
    const row = makePendingSponsorship({
      pledgeRef: "SPN-2026-0100",
      sponsorName: "Nurul Huda binti Ahmad",
      sponsorEmail: "nurul@example.com",
      petName: "Tiger",
      amountDisplay: "RM 120.00",
      amountSen: 12000,
      paymentMethod: "online_banking",
      paymentMethodLabel: "Bank transfer",
    });

    renderQueue([row]);

    expect(screen.getByText("SPN-2026-0100")).toBeInTheDocument();
    expect(screen.getByText("Nurul Huda binti Ahmad")).toBeInTheDocument();
    expect(screen.getByText("nurul@example.com")).toBeInTheDocument();
    expect(screen.getByText("Tiger")).toBeInTheDocument();
    expect(screen.getByText("RM 120.00")).toBeInTheDocument();
    expect(screen.getByText("Bank transfer")).toBeInTheDocument();

    // Asserted against the whole rendered tree rather than with `queryByText`:
    // the enum leaking through any cell, title or aria-label is the defect, not
    // only its appearance in the one cell this test happens to name.
    expect(document.body.textContent).not.toContain("online_banking");
    // The display string is the ledger's own rounding. A table that recomputed
    // from `amountSen` would most likely land on the bare number.
    expect(document.body.textContent).not.toContain("12000");
  });

  it("shows an empty state and no action buttons when nothing is pending", () => {
    renderQueue([]);

    expect(screen.getByText(/nothing is waiting to be reconciled/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /verify and activate/i })).toBeNull();
  });

  it("opens a confirmation dialog instead of calling the action", async () => {
    const row = makePendingSponsorship({ amountDisplay: "RM 250.00" });
    const { user } = renderQueue([row]);

    await user.click(verifyButton(row.pledgeRef));

    // The whole point of the dialog: a misclick must not be able to mint a
    // permanent, gapless statutory receipt.
    expect(reconcilePetSponsorshipAction).not.toHaveBeenCalled();

    const dialog = await screen.findByRole("dialog");
    // Both facts a coordinator needs to recognise a wrong row before confirming:
    // who gets emailed a tax document, and for how much.
    expect(within(dialog).getByText(new RegExp(row.sponsorEmail))).toBeInTheDocument();
    expect(within(dialog).getByText("RM 250.00")).toBeInTheDocument();
  });

  it("confirming reconciles that row once, banners the receipt, and refreshes the queue", async () => {
    reconcilePetSponsorshipAction.mockResolvedValue({
      success: true,
      receiptNumber: RECEIPT_NUMBER,
    });

    const first = makePendingSponsorship({ pledgeRef: "SPN-2026-0200" });
    const second = makePendingSponsorship({ pledgeRef: "SPN-2026-0201" });
    const { user } = renderQueue([first, second]);

    // The second row, so "the row that was clicked" is a real claim rather than
    // one the fixture would satisfy either way.
    await user.click(verifyButton("SPN-2026-0201"));
    await user.click(confirmButton());

    await waitFor(() => {
      expect(reconcilePetSponsorshipAction).toHaveBeenCalledTimes(1);
    });
    expect(reconcilePetSponsorshipAction).toHaveBeenCalledWith("SPN-2026-0201");

    expect(await screen.findByText(RECEIPT_NUMBER)).toBeInTheDocument();
    expect(screen.getByText(/has been issued/i)).toBeInTheDocument();

    // `reconcilePetSponsorshipAction` does not `revalidatePath`, so this is the
    // only thing that takes the settled row out of the queue.
    await waitFor(() => {
      expect(routerMock.refresh).toHaveBeenCalledTimes(1);
    });
  });

  it("treats an already-reconciled pledge as settled, not as an error", async () => {
    // What the losing side of the race gets back: the ledger returned
    // `already_reconciled` and handed over the number that already exists rather
    // than minting a second one for the same money. Rendering that as a failure
    // would send a coordinator hunting for a fault that is the guard working.
    reconcilePetSponsorshipAction.mockResolvedValue({
      success: true,
      receiptNumber: RECEIPT_NUMBER,
    });

    const row = makePendingSponsorship();
    const { user } = renderQueue([row]);

    await user.click(verifyButton(row.pledgeRef));
    await user.click(confirmButton());

    expect(await screen.findByText(RECEIPT_NUMBER)).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("renders a soft failure as an alert and shows no settled banner", async () => {
    reconcilePetSponsorshipAction.mockResolvedValue({
      success: false,
      error: "No sponsorship found for pledge SPN-2026-0300",
    });

    const row = makePendingSponsorship({ pledgeRef: "SPN-2026-0300" });
    const { user } = renderQueue([row]);

    await user.click(verifyButton(row.pledgeRef));
    await user.click(confirmButton());

    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("No sponsorship found for pledge SPN-2026-0300");

    // Not `queryByRole("status")`: the transient "Issuing receipt…" line claims
    // that role too, so the settled banner has to be identified by its wording.
    expect(screen.queryByText(/has been issued/i)).toBeNull();
    expect(screen.queryByText(RECEIPT_NUMBER)).toBeNull();
  });

  it("recovers from a rejected action without claiming that no receipt was issued", async () => {
    // `assertAuthorized` throws rather than returning, and the session cookie
    // lives 24 hours, so a console left open overnight rejects here. There is no
    // `error.tsx` under `src/app` to catch it.
    reconcilePetSponsorshipAction.mockRejectedValue(new Error("Authentication required."));

    const row = makePendingSponsorship({ pledgeRef: "SPN-2026-0400" });
    const { user } = renderQueue([row]);

    await user.click(verifyButton(row.pledgeRef));
    await user.click(confirmButton());

    const alert = await screen.findByRole("alert");

    // The receipt is minted and *then* attached, so a blip between those two
    // steps rejects with a permanent number already in the ledger. Telling a
    // coordinator "nothing happened" is what produces a second number from a
    // gapless statutory series for one payment.
    expect(alert.textContent ?? "").not.toMatch(/no receipt was issued/i);
    expect(alert).toHaveTextContent(/not clear from here whether a receipt was issued/i);

    // The `finally` clearing `busyRef`, and the transition ending: without them
    // the row spins forever and the queue is unusable until a manual reload.
    await waitFor(() => {
      expect(verifyButton("SPN-2026-0400")).toBeEnabled();
    });
  });

  it("calls nothing when the dialog is cancelled", async () => {
    const row = makePendingSponsorship();
    const { user } = renderQueue([row]);

    await user.click(verifyButton(row.pledgeRef));
    const dialog = await screen.findByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^cancel$/i }));

    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(reconcilePetSponsorshipAction).not.toHaveBeenCalled();
    expect(routerMock.refresh).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
