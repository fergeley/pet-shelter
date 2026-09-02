import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * The donation flow's obligation to the sponsor portal.
 *
 * Before this change `submitDonationPledgeAction` produced a receipt, wrote an audit line
 * and sent an email — none of which is queryable as a donor's giving history. Every
 * feature in the portal reads the ledger, so these tests pin the contract that a pledge
 * becomes a ledger row.
 */

const cookieStore = new Map<string, { name: string; value: string }>();

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => cookieStore.get(name),
    set: (name: string, value: string, options: Record<string, unknown>) => {
      if (options?.maxAge === 0) cookieStore.delete(name);
      else cookieStore.set(name, { name, value });
    },
    delete: (name: string) => cookieStore.delete(name),
  }),
}));

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

import { submitDonationPledgeAction } from "@/actions/donations";
import {
  __resetSponsorStoreForTests,
  findContributionByReceipt,
  listContributionsByEmail,
} from "@/lib/sponsorStore";
import { getSponsorDashboard } from "@/lib/domain/sponsorAccess";
import { registerSponsorAction, sponsorLoginAction } from "@/actions/sponsors";
import { resetRateLimitStore } from "@/lib/security/rateLimit";

describe("Donation pledges reach the sponsorship ledger", () => {
  beforeEach(async () => {
    cookieStore.clear();
    await __resetSponsorStoreForTests();
    resetRateLimitStore();
  });

  it("records a pledge as a ledger row addressable by its receipt number", async () => {
    const result = await submitDonationPledgeAction({
      donorName: "Aisha Karim",
      donorEmail: "Aisha.Karim@Example.com",
      tierId: "vaccine",
      amountMYR: 50,
      frequency: "one_time",
      paymentMethod: "duitnow_qr",
    });

    expect(result.success).toBe(true);

    const contribution = await findContributionByReceipt(result.data!.receiptNumber);
    expect(contribution).not.toBeNull();
    expect(contribution!.amountMYR).toBe(50);
    expect(contribution!.tierId).toBe("vaccine");
    expect(contribution!.donorEmail).toBe("aisha.karim@example.com");
  });

  it("carries the sponsored pet's id, not just its display name", async () => {
    // "My Rescues" joins on the id. A name alone cannot survive a rename and cannot
    // distinguish two pets called Luna.
    const result = await submitDonationPledgeAction({
      donorName: "Aisha Karim",
      donorEmail: "aisha.karim@example.com",
      tierId: "emergency_medical",
      amountMYR: 250,
      targetPetId: "pet-003",
      targetPetName: "Luna",
      paymentMethod: "duitnow_qr",
    });

    const contribution = await findContributionByReceipt(result.data!.receiptNumber);
    expect(contribution!.targetPetId).toBe("pet-003");
    expect(contribution!.targetPetName).toBe("Luna");
  });

  it("records the Sponsor Wall opt-in given at checkout", async () => {
    const optedIn = await submitDonationPledgeAction({
      donorName: "Aisha Karim",
      donorEmail: "aisha.karim@example.com",
      tierId: "kibble",
      amountMYR: 30,
      displayOnWall: true,
      paymentMethod: "duitnow_qr",
    });

    const optedOut = await submitDonationPledgeAction({
      donorName: "Ben Lee",
      donorEmail: "ben.lee@example.com",
      tierId: "kibble",
      amountMYR: 30,
      paymentMethod: "duitnow_qr",
    });

    expect((await findContributionByReceipt(optedIn.data!.receiptNumber))!.displayOnWall).toBe(
      true
    );
    expect(
      (await findContributionByReceipt(optedOut.data!.receiptNumber))!.displayOnWall
    ).toBe(false);
  });

  it("leaves a pledge unattached when the donor has no account, ready to be claimed", async () => {
    const result = await submitDonationPledgeAction({
      donorName: "Aisha Karim",
      donorEmail: "aisha.karim@example.com",
      tierId: "spay_neuter",
      amountMYR: 120,
      targetPetId: "pet-005",
      paymentMethod: "duitnow_qr",
    });

    const contribution = await findContributionByReceipt(result.data!.receiptNumber);
    expect(contribution!.sponsorId).toBeNull();

    const claim = await registerSponsorAction({
      name: "Aisha Karim",
      email: "aisha.karim@example.com",
      password: "correct-horse-battery",
      receiptNumber: result.data!.receiptNumber,
      displayOnWall: false,
    });

    expect(claim.success).toBe(true);
    expect((await getSponsorDashboard())!.rescues.map((r) => r.petId)).toContain("pet-005");
  });

  it("attaches a pledge to an existing account made with the same email", async () => {
    await submitDonationPledgeAction({
      donorName: "Datin Sofia Rahman",
      donorEmail: "gold@example.com",
      tierId: "emergency_medical",
      amountMYR: 250,
      targetPetId: "pet-004",
      paymentMethod: "duitnow_qr",
    });

    await sponsorLoginAction({ email: "gold@example.com", password: "gold123" });
    const dashboard = await getSponsorDashboard();

    expect(dashboard!.rescues.map((rescue) => rescue.petId)).toContain("pet-004");
  });

  it("raises a new donor's standing to Silver on a recurring pledge", async () => {
    const result = await submitDonationPledgeAction({
      donorName: "Ben Lee",
      donorEmail: "ben.lee@example.com",
      tierId: "kibble",
      amountMYR: 25,
      frequency: "monthly",
      paymentMethod: "duitnow_qr",
    });

    await registerSponsorAction({
      name: "Ben Lee",
      email: "ben.lee@example.com",
      password: "correct-horse-battery",
      receiptNumber: result.data!.receiptNumber,
      displayOnWall: false,
    });

    const dashboard = await getSponsorDashboard();
    expect(dashboard!.tier).toBe("SILVER");
    expect(dashboard!.recognisedMYR).toBe(300);
    expect(dashboard!.hasActiveRecurring).toBe(true);
  });

  it("does not write a ledger row for a rejected pledge", async () => {
    const before = (await listContributionsByEmail("ben.lee@example.com")).length;

    const result = await submitDonationPledgeAction({
      donorName: "Ben Lee",
      donorEmail: "ben.lee@example.com",
      tierId: "kibble",
      amountMYR: 1,
      paymentMethod: "duitnow_qr",
    });

    expect(result.success).toBe(false);
    expect(await listContributionsByEmail("ben.lee@example.com")).toHaveLength(before);
  });
});
