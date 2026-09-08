import { describe, it, expect, beforeEach, vi } from "vitest";

/**
 * Hoisted above the imports below, so the Server Actions under test resolve the
 * mock rather than the real cookie-reading session.
 *
 * `tests/unit/petSponsorship.test.ts` covers the same reconciliation arithmetic
 * but deliberately stops short of the action, commenting that a unit test "has
 * no way to hold" an RBAC session. This suite is that missing half, and only
 * that half: the authorization guard, its ordering relative to the irreversible
 * receipt, and the coordinator queue the dashboard reads.
 *
 * Explicitly NOT repeated here, because that file already asserts them: the
 * summary/aggregation arithmetic, and the ledger's `already_reconciled` branch
 * (`petSponsorship.test.ts`). The idempotence test below exercises the
 * *action's* pre-check, which returns before the ledger is reached at all — a
 * different guard on the same hazard, not a second copy of that one.
 */
const sessionMock = vi.hoisted(() => ({ getCurrentSession: vi.fn() }));
vi.mock("@/lib/security/session", () => sessionMock);

/**
 * The member row behind the cookie.
 *
 * Both actions resolve their session through `getVerifiedSession`, which reads
 * this row and returns `null` when the account is no longer ACTIVE — that is
 * what makes a suspension take effect on the next request instead of whenever
 * the 24-hour cookie happens to expire.
 *
 * Mocked here because without it that re-read is invisible to this suite:
 * `prisma` is unmocked in the unit lane and `DATABASE_URL` is unset, so the
 * query rejects and `dal.ts` falls back to the cookie's own claims. Every test
 * would then pass against `getCurrentSession` just as happily, and the guard
 * would be asserted by nothing.
 */
const memberStoreMock = vi.hoisted(() => ({ findMemberAuthStateById: vi.fn() }));
vi.mock("@/lib/server/memberStore", () => memberStoreMock);

import { senFromRinggit } from "@/lib/domain/money";
import { generatePledgeRef } from "@/lib/domain/petSponsorship";
import {
  findSponsorshipByPledgeRef,
  listPendingSponsorships,
  recordSponsorshipPledge,
  type SponsorshipDraft,
} from "@/lib/server/sponsorshipLedger";
import {
  findDonationByReceiptNumber,
  isLedgerPersistent,
  listDonations,
} from "@/lib/server/donationLedger";
import {
  getPendingSponsorshipsAction,
  reconcilePetSponsorshipAction,
} from "@/actions/sponsorships";

const ADMIN = {
  id: "usr-admin-01",
  email: "admin@hopeforstrays.org",
  name: "Siti Admin",
  role: "SUPER_ADMIN" as const,
  expiresAt: Date.now() + 3_600_000,
};
const COORDINATOR = {
  ...ADMIN,
  id: "usr-coord-01",
  email: "coordinator@hopeforstrays.org",
  role: "VOLUNTEER_COORDINATOR" as const,
};
const CONTENT_EDITOR = { ...ADMIN, id: "usr-editor-01", role: "CONTENT_EDITOR" as const };
const STAFF = { ...ADMIN, id: "usr-staff-01", role: "STAFF" as const };

let serial = 0;

/**
 * A commitment in the state the public checkout leaves it: PENDING_PAYMENT, no
 * receipt. `now` is stepped a day per pledge so ordering assertions are about
 * the query and not about how fast the test ran.
 */
async function givenPendingPledge(overrides: Partial<SponsorshipDraft> = {}) {
  serial += 1;
  return recordSponsorshipPledge(
    {
      petId: `pet-${String(serial).padStart(3, "0")}`,
      petName: "Milo",
      sponsorName: "Aisyah Rahman",
      sponsorEmail: `aisyah+${serial}@example.com`,
      tierId: "vaccine",
      tierName: "Core Vaccination & Deworming",
      frequency: "one_time",
      amountSen: senFromRinggit(50),
      paymentMethod: "duitnow_qr",
      pledgeRef: generatePledgeRef(),
      ...overrides,
    },
    { now: new Date(Date.UTC(2026, 8, serial, 9, 0, 0)) }
  );
}

/** The numeric tail of `HFS-DON-YYYYMM-NNNN`. */
function receiptSerial(receiptNumber: string): number {
  return Number(receiptNumber.split("-").at(-1));
}

beforeEach(() => {
  serial = 0;
  sessionMock.getCurrentSession.mockResolvedValue(COORDINATOR);
  // No row: `dal.ts` falls through to the cookie's claims, which is the
  // in-memory/demo path the rest of these tests want. Cases that care about the
  // re-read override it.
  memberStoreMock.findMemberAuthStateById.mockResolvedValue(null);
});

/**
 * KC1 from `tasks/open/CLAIM-admin-sponsorship-reconciliation.md`.
 *
 * `reconcilePetSponsorshipAction` issues a statutory receipt and calls
 * `sendDonationReceiptEmail` without awaiting it. Both are one-way doors
 * (`.claude/templates/triage-rules.md` §1 and §3): with `DATABASE_URL` set the
 * write lands on the production Neon branch, and with `RESEND_API_KEY` set the
 * mail reaches a real donor and cannot be recalled.
 *
 * The `unit` vitest project loads no env file — only `integration-db` does, via
 * `tests/setup/integrationEnv.ts`. These two assertions are what makes every
 * other test in this file safe to run, so they are asserted rather than assumed.
 */
describe("harness preconditions: this suite cannot reach production or send mail", () => {
  it("has no RESEND_API_KEY, so receipt mail takes the simulation branch", () => {
    expect(process.env.RESEND_API_KEY).toBeUndefined();
  });

  it("has no DATABASE_URL, so the ledger is in memory and not the production branch", () => {
    expect(process.env.DATABASE_URL).toBeUndefined();
    expect(isLedgerPersistent()).toBe(false);
  });
});

describe("pledge lifecycle: a commitment starts unverified", () => {
  it("opens as PENDING_PAYMENT with a pledge reference and no receipt", async () => {
    const pledge = await givenPendingPledge();

    expect(pledge.status).toBe("PENDING_PAYMENT");
    expect(pledge.receiptNumber).toBeNull();
    // HFS-PLG, not HFS-DON: a coordinator reading a bank statement must be able
    // to tell an unverified claim from an issued receipt.
    expect(pledge.pledgeRef).toMatch(/^HFS-PLG-\d{8}-\d{6}$/);
  });

  it("issues no donation row until a coordinator confirms it", async () => {
    await givenPendingPledge();
    expect(await listDonations()).toHaveLength(0);
  });
});

describe("the coordinator queue", () => {
  it("lists pending commitments oldest first, because it is a work queue", async () => {
    const first = await givenPendingPledge({ sponsorName: "First Waiting" });
    const second = await givenPendingPledge({ sponsorName: "Second Waiting" });

    const queue = await listPendingSponsorships();

    expect(queue.map((row) => row.pledgeRef)).toEqual([first.pledgeRef, second.pledgeRef]);
  });

  it("drops a commitment once it has been reconciled", async () => {
    const pledge = await givenPendingPledge();
    await reconcilePetSponsorshipAction(pledge.pledgeRef);

    const queue = await listPendingSponsorships();
    expect(queue.map((row) => row.pledgeRef)).not.toContain(pledge.pledgeRef);
  });

  it("does not project the supporter's tax identifier to the browser", async () => {
    await givenPendingPledge({ taxIdOrIc: "880101-14-5566", notes: "Ref: MBB 4471" });

    const [row] = await getPendingSponsorshipsAction();

    // A Server Action's return value is serialised to the client. The screen
    // needs the pledge reference and the contact details; it never needs an
    // NRIC, and reconciliation reads that server-side from the ledger.
    expect(row).not.toHaveProperty("taxIdOrIc");
    expect(JSON.stringify(row)).not.toContain("880101-14-5566");
    // The supporter's own note survives — it is the closest thing to a payment
    // reference a coordinator has.
    expect(row.notes).toBe("Ref: MBB 4471");
  });

  it("preformats the amount server-side so the table cannot drift from the ledger", async () => {
    await givenPendingPledge({ amountSen: senFromRinggit(80) });

    const [row] = await getPendingSponsorshipsAction();

    expect(row.amountSen).toBe(8000);
    expect(row.amountDisplay).toBe("RM 80.00");
  });

  it("preformats the payment rail, so no coordinator reads a raw enum", async () => {
    await givenPendingPledge({ paymentMethod: "online_banking" });

    const [row] = await getPendingSponsorshipsAction();

    expect(row.paymentMethodLabel).toBe("Bank transfer");
    // The raw value is still carried, for callers that need to branch on it.
    expect(row.paymentMethod).toBe("online_banking");
  });
});

describe("authorisation: only ADMIN and COORDINATOR may see or settle the queue", () => {
  it("rejects an unauthenticated read", async () => {
    sessionMock.getCurrentSession.mockResolvedValue(null);
    await expect(getPendingSponsorshipsAction()).rejects.toThrow(/Authentication required/i);
  });

  it("rejects a role that is not on the reconciliation allow-list", async () => {
    for (const user of [STAFF, CONTENT_EDITOR]) {
      sessionMock.getCurrentSession.mockResolvedValue(user);
      await expect(getPendingSponsorshipsAction()).rejects.toThrow(/not authorized/i);
    }
  });

  it("admits a coordinator and a super admin", async () => {
    await givenPendingPledge();

    for (const user of [COORDINATOR, ADMIN]) {
      sessionMock.getCurrentSession.mockResolvedValue(user);
      await expect(getPendingSponsorshipsAction()).resolves.toHaveLength(1);
    }
  });

  it("refuses to reconcile for an unauthorised caller", async () => {
    const pledge = await givenPendingPledge();
    sessionMock.getCurrentSession.mockResolvedValue(STAFF);

    await expect(reconcilePetSponsorshipAction(pledge.pledgeRef)).rejects.toThrow(
      /not authorized/i
    );
  });

  it("denies a coordinator whose member row was suspended, despite a live cookie", async () => {
    const pledge = await givenPendingPledge();
    sessionMock.getCurrentSession.mockResolvedValue(COORDINATOR);
    memberStoreMock.findMemberAuthStateById.mockResolvedValue({
      role: "VOLUNTEER_COORDINATOR",
      status: "SUSPENDED",
      name: "Suspended Coordinator",
      email: COORDINATOR.email,
    });

    // The cookie is intact and still claims COORDINATOR — this is the whole
    // point. A Server Action is a POST endpoint whose id the client already
    // holds, so a guard that only unseals the cookie would keep admitting a
    // suspended account for the rest of the cookie's 24-hour life.
    await expect(getPendingSponsorshipsAction()).rejects.toThrow(/Authentication required/i);
    await expect(reconcilePetSponsorshipAction(pledge.pledgeRef)).rejects.toThrow(
      /Authentication required/i
    );
    expect(await listDonations()).toHaveLength(0);
  });

  it("denies a coordinator demoted in the member row, despite the cookie's stale role", async () => {
    sessionMock.getCurrentSession.mockResolvedValue(COORDINATOR);
    memberStoreMock.findMemberAuthStateById.mockResolvedValue({
      role: "CONTENT_EDITOR",
      status: "ACTIVE",
      name: "Demoted Coordinator",
      email: COORDINATOR.email,
    });

    // Still ACTIVE, so the session survives — but with the role the database
    // holds, not the one the cookie was sealed with.
    await expect(getPendingSponsorshipsAction()).rejects.toThrow(/not authorized/i);
  });

  it("burns no receipt number on a refused reconciliation", async () => {
    const pledge = await givenPendingPledge();
    sessionMock.getCurrentSession.mockResolvedValue(STAFF);

    await expect(reconcilePetSponsorshipAction(pledge.pledgeRef)).rejects.toThrow();

    // The guard has to run BEFORE `issueDonationReceipt`, or a forbidden click
    // consumes a number from a gapless statutory series that cannot be reissued.
    expect(await listDonations()).toHaveLength(0);
    expect((await findSponsorshipByPledgeRef(pledge.pledgeRef))?.status).toBe(
      "PENDING_PAYMENT"
    );
  });
});

describe("reconciliation: confirming a transfer issues the receipt", () => {
  it("activates the commitment and attaches a gapless receipt number", async () => {
    const pledge = await givenPendingPledge();

    const result = await reconcilePetSponsorshipAction(pledge.pledgeRef);

    expect(result.success).toBe(true);
    expect(result.receiptNumber).toMatch(/^HFS-DON-\d{6}-\d{4}$/);

    const stored = await findSponsorshipByPledgeRef(pledge.pledgeRef);
    expect(stored?.status).toBe("ACTIVE");
    expect(stored?.receiptNumber).toBe(result.receiptNumber);
  });

  it("writes the receipt into the donation ledger, so it reaches the LHDN export", async () => {
    const pledge = await givenPendingPledge({ amountSen: senFromRinggit(150) });

    const result = await reconcilePetSponsorshipAction(pledge.pledgeRef);
    const donation = await findDonationByReceiptNumber(result.receiptNumber!);

    expect(donation).not.toBeNull();
    expect(donation?.amountSen).toBe(15000);
    expect(donation?.donorEmail).toBe(pledge.sponsorEmail);
  });

  it("draws consecutive numbers from the one series across two commitments", async () => {
    const first = await givenPendingPledge();
    const second = await givenPendingPledge();

    const a = await reconcilePetSponsorshipAction(first.pledgeRef);
    const b = await reconcilePetSponsorshipAction(second.pledgeRef);

    expect(receiptSerial(b.receiptNumber!) - receiptSerial(a.receiptNumber!)).toBe(1);
  });

  it("returns the existing number when the same pledge is settled twice", async () => {
    const pledge = await givenPendingPledge();

    const first = await reconcilePetSponsorshipAction(pledge.pledgeRef);
    const second = await reconcilePetSponsorshipAction(pledge.pledgeRef);

    // These calls are sequential, so the second returns at the action's own
    // pre-check and never reaches the ledger — this asserts that pre-check, not
    // the `already_reconciled` race branch underneath it, which
    // `petSponsorship.test.ts` covers. What matters either way is the last
    // line: one receipt for one payment. A genuine simultaneous race is settled
    // by the conditional UPDATE in `reconcileSponsorship`, which needs a real
    // database to exercise and has none on this machine.
    expect(second.success).toBe(true);
    expect(second.receiptNumber).toBe(first.receiptNumber);
    expect(await listDonations()).toHaveLength(1);
  });

  it("reports an unknown pledge reference without issuing anything", async () => {
    const result = await reconcilePetSponsorshipAction("HFS-PLG-20260908-000000");

    expect(result.success).toBe(false);
    expect(result.error).toMatch(/no sponsorship found/i);
    expect(await listDonations()).toHaveLength(0);
  });
});
