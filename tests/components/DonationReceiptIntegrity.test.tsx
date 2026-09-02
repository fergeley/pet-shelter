import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen } from "@testing-library/react";

vi.mock("@/actions/donations", () => ({ submitDonationPledgeAction: vi.fn() }));
vi.mock("@/actions/pets", () => ({ getPublicPets: vi.fn().mockResolvedValue([]) }));

import { DonationWidget } from "@/components/features/donations/DonationWidget";
import { submitDonationPledgeAction } from "@/actions/donations";
import { setMockLocation } from "../setup/nextMocks";
import { renderWithLanguage, setupUser, makePet } from "./support/render";

/**
 * A receipt number is allocated by `issueDonationReceipt` inside the same
 * transaction that writes the `Donation` row — that is what makes the series
 * gapless and what lets the LHDN export reconcile against the ledger.
 *
 * The widget used to answer a failed submission by minting its own
 * `HFS-DON-<month>-<random 4 digits>` in the browser and rendering it on the
 * printable receipt. The donor would then hold a tax document for a gift the
 * shelter has no record of, carrying a number that may already belong to a real
 * receipt. These tests exist so that fallback cannot come back.
 */
const RECEIPT_NUMBER = /HFS-DON-\d{6}-\d{4}/;

const mockedSubmit = vi.mocked(submitDonationPledgeAction);

function renderWidget() {
  setMockLocation("/donate", "");
  return renderWithLanguage(<DonationWidget initialPets={[makePet({ id: "pet-001", name: "Bella" })]} />);
}

async function submitAGift() {
  const user = setupUser();
  await user.type(screen.getByLabelText(/donor full name/i), "Aisyah Rahman");
  await user.type(screen.getByLabelText(/email address/i), "aisyah@example.com");
  await user.click(screen.getByRole("button", { name: /complete donation pledge/i }));
}

describe("the browser never invents a receipt number", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the server's error and no receipt when the ledger refuses the write", async () => {
    mockedSubmit.mockResolvedValue({
      success: false,
      error:
        "We could not record your donation just now, so no receipt was issued. Nothing has been charged — please try again in a moment.",
    });

    renderWidget();
    await submitAGift();

    expect(await screen.findByText(/no receipt was issued/i)).toBeInTheDocument();
    expect(screen.queryByText(RECEIPT_NUMBER)).toBeNull();
  });

  it("shows no receipt when the action throws outright", async () => {
    mockedSubmit.mockRejectedValue(new Error("network down"));

    renderWidget();
    await submitAGift();

    expect(await screen.findByText(/no receipt was issued/i)).toBeInTheDocument();
    expect(screen.queryByText(RECEIPT_NUMBER)).toBeNull();
  });

  it("renders the receipt number the ledger issued, unchanged", async () => {
    mockedSubmit.mockResolvedValue({
      success: true,
      data: {
        receiptNumber: "HFS-DON-202609-0007",
        date: "2 Sep 2026, 11:30 pm",
        donorName: "Aisyah Rahman",
        donorEmail: "aisyah@example.com",
        tierId: "vaccine",
        tierName: "Core Vaccination & Deworming",
        amountMYR: 50,
        frequency: "one_time",
        paymentMethod: "duitnow_qr",
        taxDeductibleRef: "LHDN.01/35/42/51/179-6.4912",
        shelterRegistrationNo: "PPM-021-10-18082021",
      },
    });

    renderWidget();
    await submitAGift();

    expect(await screen.findByText("HFS-DON-202609-0007")).toBeInTheDocument();
  });
});
