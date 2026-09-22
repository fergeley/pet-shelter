import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/**
 * A bad pledge reference must fail the same way in both storage modes.
 *
 * `assertGiftRefString` exists because Prisma's string inputs also accept filter
 * objects, so `{ not: "" }` as a `pledgeRef` would match every row rather than
 * one. It runs inside `transitionPending` — but on the Postgres path that is
 * *inside* `withReceiptTransaction`, whose catch-all turns every
 * non-unique-violation into `ReceiptIssuanceError`. So the assertion fired, and
 * the caller was told "we could not confirm whether reconciliation completed":
 * an outage message for a programming error, and the opposite of what the memory
 * branch reports for the same argument.
 *
 * No other unit test could see it, because the memory branch asserts before the
 * transaction and every unit suite runs in memory mode. The Tier 3b probe would
 * have caught it, and could not run — see
 * `tasks/open/donation-pledges-table-is-unapplied-and-its-postgres-probe-unrun.md`.
 * This file is the cheap standing guard that does not need a server.
 */

const prismaDouble = vi.hoisted(() => ({
  // Runs `work` against a transaction client double, exactly as an interactive
  // transaction does — so the real `withReceiptTransaction` wrapping is exercised
  // rather than mocked away. Mocking the ledger instead would remove the very
  // behaviour under test.
  $transaction: vi.fn(async (work: (tx: unknown) => Promise<unknown>) => work({})),
}));

vi.mock("@/lib/server/prisma", () => ({
  prisma: prismaDouble,
  disconnectPrisma: vi.fn(),
}));

beforeEach(() => {
  // Declared mode, not a mocked predicate: `isLedgerPersistent()` reads this, and
  // the point of the test is the branch the real function selects.
  vi.stubEnv("DATABASE_URL", "postgresql://probe:probe@localhost:5432/probe");
  prismaDouble.$transaction.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("a malformed pledge reference fails as a TypeError on the Postgres path", () => {
  it("rejects a filter object without reporting an unconfirmed transaction", async () => {
    const { isLedgerPersistent } = await import("@/lib/server/donationLedger");
    const { ReceiptIssuanceError } = await import("@/lib/server/donationLedger");
    const { settleDonationPledge } = await import("@/lib/server/donationPledgeLedger");

    // The control: without this the test would be asserting the memory branch.
    expect(isLedgerPersistent()).toBe(true);

    const attempt = settleDonationPledge(
      { not: "" } as unknown as string,
      { taxDeductibleRef: "ref", shelterRegistrationNo: "reg" },
      "coordinator@example.test"
    );

    await expect(attempt).rejects.toThrow(TypeError);
    await expect(attempt).rejects.not.toBeInstanceOf(ReceiptIssuanceError);

    // The guard runs before the transaction is opened at all, so no receipt
    // series was touched on the way to refusing the argument.
    expect(prismaDouble.$transaction).not.toHaveBeenCalled();
  });

  it("rejects the same argument as a TypeError in memory mode too", async () => {
    vi.stubEnv("DATABASE_URL", "");
    const { settleDonationPledge } = await import("@/lib/server/donationPledgeLedger");

    await expect(
      settleDonationPledge(
        { not: "" } as unknown as string,
        { taxDeductibleRef: "ref", shelterRegistrationNo: "reg" },
        "coordinator@example.test"
      )
    ).rejects.toThrow(TypeError);
  });
});
