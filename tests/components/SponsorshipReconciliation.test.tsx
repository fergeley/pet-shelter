import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";

vi.mock("@/actions/sponsorships", () => ({
  listPendingSponsorshipsAction: vi.fn(),
  reconcilePetSponsorshipAction: vi.fn(),
  rejectPetSponsorshipAction: vi.fn(),
}));

import {
  listPendingSponsorshipsAction,
  reconcilePetSponsorshipAction,
  rejectPetSponsorshipAction,
} from "@/actions/sponsorships";
import { SponsorshipReconciliation } from "@/components/admin/SponsorshipReconciliation";
import { renderWithLanguage, setupUser } from "./support/render";

const mockedListPending = vi.mocked(listPendingSponsorshipsAction);
const mockedReconcile = vi.mocked(reconcilePetSponsorshipAction);
const mockedReject = vi.mocked(rejectPetSponsorshipAction);

const pendingPledge = {
  pledgeRef: "HFS-PLG-20260914-ABCD",
  petName: "Bella",
  sponsorName: "Aisyah Rahman",
  sponsorEmail: "aisyah@example.com",
  tierName: "Core Vaccination & Deworming",
  amountDisplay: "RM 50.00",
  frequency: "one_time" as const,
  paymentMethod: "duitnow_qr" as const,
  createdAt: "2026-09-14T12:00:00.000Z",
};

function renderQueue() {
  return renderWithLanguage(<SponsorshipReconciliation />);
}

async function waitForPledge() {
  return screen.findByText(pendingPledge.pledgeRef);
}

function expectUnconfirmedOutcome(alert: HTMLElement) {
  expect(alert).toHaveTextContent(/outcome (?:is|remains) unconfirmed/i);
  expect(alert).toHaveTextContent(/reload.*before (?:trying|you try|retrying)/i);
  expect(alert).not.toHaveTextContent(/nothing was issued/i);
  expect(alert).not.toHaveTextContent(/still pending/i);
}

describe("SponsorshipReconciliation uncertain action outcomes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListPending.mockResolvedValue({
      success: true,
      data: [pendingPledge],
    });
    mockedReconcile.mockResolvedValue({
      success: false,
      error: "stubbed confirmation",
    });
    mockedReject.mockResolvedValue({
      success: false,
      error: "stubbed dismissal",
    });
  });

  it("treats a rejected confirmation promise as unconfirmed and requires a reload before retry", async () => {
    mockedReconcile.mockRejectedValue(new Error("connection lost after dispatch"));
    renderQueue();
    const user = setupUser();

    await waitForPledge();
    await user.click(
      screen.getByRole("button", { name: /confirm payment received/i }),
    );
    await user.click(screen.getByRole("button", { name: /issue receipt/i }));

    const alert = await screen.findByRole("alert");
    expectUnconfirmedOutcome(alert);
    expect(mockedReconcile).toHaveBeenCalledWith(pendingPledge.pledgeRef);
  });

  it("treats a rejected dismissal promise as unconfirmed and requires a reload before retry", async () => {
    mockedReject.mockRejectedValue(new Error("connection lost after dispatch"));
    renderQueue();
    const user = setupUser();

    await waitForPledge();
    await user.click(screen.getByRole("button", { name: /^dismiss$/i }));
    await user.click(screen.getByRole("button", { name: /dismiss pledge/i }));

    const alert = await screen.findByRole("alert");
    expectUnconfirmedOutcome(alert);
    expect(mockedReject).toHaveBeenCalledWith(pendingPledge.pledgeRef, "");
  });
});

describe("SponsorshipReconciliation receipt copy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedListPending.mockResolvedValue({
      success: true,
      data: [pendingPledge],
    });
  });

  it("does not label an identifier-free pledge receipt as LHDN, Section 44, or tax", async () => {
    const { container } = renderQueue();

    await waitForPledge();

    // PendingSponsorshipDTO intentionally does not expose the supporter's tax
    // identifier. The queue therefore cannot truthfully promise tax treatment.
    expect(container).not.toHaveTextContent(/LHDN|Section 44\(6\)|tax(?:-| )?receipt/i);
    expect(
      screen
        .getByRole("button", { name: /confirm payment received/i })
        .getAttribute("title"),
    ).not.toMatch(/LHDN|Section 44\(6\)|\btax\b/i);
  });
});
