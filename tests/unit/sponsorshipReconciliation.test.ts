import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  CANONICAL_ROLES,
  PERMISSIONS,
  ROLES,
  normalizeRole,
  roleHasPermission,
} from "@/lib/security/permissions";
import { senFromInteger } from "@/lib/domain/money";
// Type-only, so it is erased before the harness's dynamic-import rule applies:
// nothing here instantiates the repository ahead of a file's own vi.mock.
import type { SponsorshipDraft } from "@/lib/server/sponsorshipLedger";

/**
 * The sponsor portal shipped inert.
 *
 * `reconcilePetSponsorshipAction` was exported, RBAC-guarded and audited from PR #6,
 * and nothing called it. Every commitment stayed `PENDING_PAYMENT`, so no
 * `receiptNumber` was ever assigned — and the portal's account-claim challenge
 * requires one, which meant nobody could register an account at all. See
 * `tasks/open/sponsor-portal-is-inert-until-reconciliation-is-reachable.md` §1.
 *
 * These cover the read half that makes the mutation reachable, and the guard
 * equivalence the admin nav depends on.
 */

const currentRole = { value: null as string | null };

vi.mock("@/lib/security/session", () => ({
  getCurrentSession: vi.fn(async () =>
    currentRole.value === null
      ? null
      : {
          id: "actor-1",
          email: "coordinator@hopeforstrays.org",
          name: "Test Coordinator",
          role: currentRole.value,
          expiresAt: Date.now() + 3_600_000,
        }
  ),
}));

vi.mock("next/cache", () => ({ revalidatePath: vi.fn(), revalidateTag: vi.fn() }));

/**
 * Mirrors the tier catalogue's shape without depending on its prices.
 *
 * `amountSen` goes through `senFromInteger` because `Sen` is branded — a bare
 * `number` is deliberately not assignable, which is what stops a ringgit figure
 * being stored as if it were sen.
 */
function pledge(overrides: Partial<SponsorshipDraft> = {}): SponsorshipDraft {
  return {
    petId: "pet-1",
    petName: "Barnaby",
    sponsorName: "Nurul Huda binti Ahmad",
    sponsorEmail: "nurul.huda@example.com",
    tierId: "vaccine",
    tierName: "Core Vaccination & Deworming",
    frequency: "one_time",
    amountSen: senFromInteger(5000),
    paymentMethod: "online_banking",
    pledgeRef: "HFS-PLG-000001",
    ...overrides,
  };
}

describe("the reconciliation guard admits exactly who the mutation admits", () => {
  /**
   * K2 from the build gate, kept as a permanent guard rather than a one-off spike.
   *
   * The admin nav gates `/admin/donations` on RECONCILE_SPONSORSHIPS while
   * `reconcilePetSponsorshipAction` still enforces `[ROLES.ADMIN, ROLES.COORDINATOR]`.
   * If those two sets ever diverge, a coordinator sees a button whose mutation
   * rejects them — a failure that only shows up at the moment money is confirmed.
   */
  it("grants RECONCILE_SPONSORSHIPS to precisely the roles the legacy allow-list admits", () => {
    const permissionHolders = (CANONICAL_ROLES as readonly string[]).filter((role) =>
      roleHasPermission(role, PERMISSIONS.RECONCILE_SPONSORSHIPS)
    );

    const legacyAdmits = (CANONICAL_ROLES as readonly string[]).filter((role) =>
      [ROLES.ADMIN, ROLES.COORDINATOR].some(
        (allowed) => normalizeRole(allowed) === normalizeRole(role)
      )
    );

    expect(permissionHolders).toEqual(legacyAdmits);
    expect(permissionHolders).toEqual(["SUPER_ADMIN", "VOLUNTEER_COORDINATOR"]);
  });

  it("does not hand receipt issuance to an editorial role", () => {
    // The reason this is its own permission rather than a reuse of MANAGE_CONTENT:
    // minting a statutory document from a gapless series is not content editing.
    expect(roleHasPermission(ROLES.CONTENT_EDITOR, PERMISSIONS.RECONCILE_SPONSORSHIPS)).toBe(
      false
    );
    expect(roleHasPermission(ROLES.ANIMAL_MANAGER, PERMISSIONS.RECONCILE_SPONSORSHIPS)).toBe(
      false
    );
    expect(roleHasPermission(ROLES.STAFF, PERMISSIONS.RECONCILE_SPONSORSHIPS)).toBe(false);
  });
});

describe("listPendingSponsorshipsAction", () => {
  beforeEach(() => {
    currentRole.value = null;
  });

  it("refuses an anonymous caller", async () => {
    const { listPendingSponsorshipsAction } = await import("@/actions/sponsorships");
    await expect(listPendingSponsorshipsAction()).rejects.toThrow(/Authentication required/i);
  });

  it.each([ROLES.CONTENT_EDITOR, ROLES.ANIMAL_MANAGER, ROLES.STAFF])(
    "refuses a %s",
    async (role) => {
      currentRole.value = role;
      const { listPendingSponsorshipsAction } = await import("@/actions/sponsorships");
      await expect(listPendingSponsorshipsAction()).rejects.toThrow(/RECONCILE_SPONSORSHIPS/);
    }
  );

  it("returns only commitments awaiting payment, oldest first", async () => {
    const { recordSponsorshipPledge, reconcileSponsorship } = await import(
      "@/lib/server/sponsorshipLedger"
    );
    const { listPendingSponsorshipsAction } = await import("@/actions/sponsorships");

    await recordSponsorshipPledge(pledge({ pledgeRef: "HFS-PLG-000001" }));
    await recordSponsorshipPledge(
      pledge({ pledgeRef: "HFS-PLG-000002", sponsorName: "Chong Wei" })
    );
    await recordSponsorshipPledge(
      pledge({ pledgeRef: "HFS-PLG-000003", sponsorName: "Already Paid" })
    );
    await reconcileSponsorship("HFS-PLG-000003", "HFS-DON-202609-0001", "coordinator@x.org");

    currentRole.value = ROLES.VOLUNTEER_COORDINATOR;
    const result = await listPendingSponsorshipsAction();

    expect(result.success).toBe(true);
    const refs = result.data!.map((r) => r.pledgeRef);
    // The settled one is gone; a reconciled commitment is not work.
    expect(refs).not.toContain("HFS-PLG-000003");
    expect(refs).toEqual(["HFS-PLG-000001", "HFS-PLG-000002"]);
  });

  it("is a work queue, so the longest-waiting supporter sorts first", async () => {
    const { recordSponsorshipPledge } = await import("@/lib/server/sponsorshipLedger");
    const { listPendingSponsorshipsAction } = await import("@/actions/sponsorships");

    await recordSponsorshipPledge(pledge({ pledgeRef: "HFS-PLG-000010" }));
    await recordSponsorshipPledge(pledge({ pledgeRef: "HFS-PLG-000011" }));

    currentRole.value = ROLES.SUPER_ADMIN;
    const result = await listPendingSponsorshipsAction();

    const timestamps = result.data!.map((r) => Date.parse(r.createdAt));
    // Every other list in the ledger is newest-first; this one is deliberately not.
    expect(timestamps).toEqual([...timestamps].sort((a, b) => a - b));
  });

  it("projects no tax identifier onto the coordinator's screen", async () => {
    const { recordSponsorshipPledge } = await import("@/lib/server/sponsorshipLedger");
    const { listPendingSponsorshipsAction } = await import("@/actions/sponsorships");

    await recordSponsorshipPledge(pledge({ taxIdOrIc: "920512-10-5432" }));

    currentRole.value = ROLES.VOLUNTEER_COORDINATOR;
    const result = await listPendingSponsorshipsAction();

    // Confirming a bank transfer landed does not require the supporter's NRIC, so
    // the DTO does not carry one. Serialising it to the browser would be a statutory
    // identifier on screen for no purpose.
    expect(result.data![0]).not.toHaveProperty("taxIdOrIc");
    expect(JSON.stringify(result.data)).not.toContain("920512-10-5432");
  });

  it("preformats money rather than shipping sen to the client", async () => {
    const { recordSponsorshipPledge } = await import("@/lib/server/sponsorshipLedger");
    const { listPendingSponsorshipsAction } = await import("@/actions/sponsorships");

    await recordSponsorshipPledge(pledge({ amountSen: senFromInteger(12050) }));

    currentRole.value = ROLES.VOLUNTEER_COORDINATOR;
    const result = await listPendingSponsorshipsAction();

    expect(result.data![0].amountDisplay).toContain("120.50");
  });
});

describe("a failed read is reported as a failure, never as an empty queue", () => {
  beforeEach(() => {
    currentRole.value = ROLES.VOLUNTEER_COORDINATOR;
  });

  it("returns success:false rather than [] when the ledger read throws", async () => {
    const ledger = await import("@/lib/server/sponsorshipLedger");
    const { listPendingSponsorshipsAction } = await import("@/actions/sponsorships");

    const spy = vi
      .spyOn(ledger, "listPendingSponsorships")
      .mockRejectedValueOnce(new Error("connection terminated unexpectedly"));

    const result = await listPendingSponsorshipsAction();

    // An empty array is a *claim* that every supporter has been settled, and a
    // coordinator who believes it stops looking. The two must not look alike.
    expect(result.success).toBe(false);
    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/not an empty queue/i);

    spy.mockRestore();
  });
});
