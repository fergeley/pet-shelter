import { describe, it, expect, beforeEach, vi } from "vitest";
import { UnauthorizedError } from "@/lib/security/rbac";

/**
 * A suspended or deleted member's still-valid session cookie authorizes no content action.
 *
 * The session cookie lives for 24 hours and carries its own role. The DAL
 * (`getVerifiedSession`) re-reads status on every request so a suspension takes effect at
 * once — but the transparency actions and FAQ editing asked `getCurrentSession()` instead,
 * which checks only the signature. So after the production lockdown suspended the seeded
 * accounts, a Super Admin cookie issued before it could still write the public expense
 * ledger and edit FAQs. See `tasks/decisions/2026-09-18-content-actions-honour-suspension.md`.
 */

vi.mock("@/lib/server/memberStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/memberStore")>()),
  findMemberAuthStateById: vi.fn(),
}));

vi.mock("@/lib/server/userStore", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/server/userStore")>()),
  findUserById: vi.fn(),
}));

vi.mock("next/server", () => ({ after: vi.fn() }));

const MEMBER = {
  id: "usr-director-01",
  email: "director@hopeforstrays.org",
  name: "Shelter Director",
  role: "SUPER_ADMIN" as const,
};

const REFUSED = new UnauthorizedError().message;

async function memberRowIs(state: "SUSPENDED" | "DELETED" | "ACTIVE") {
  const { findMemberAuthStateById } = await import("@/lib/server/memberStore");
  const { findUserById } = await import("@/lib/server/userStore");
  vi.mocked(findMemberAuthStateById).mockResolvedValue(
    state === "DELETED" ? null : { role: MEMBER.role, status: state, name: MEMBER.name, email: MEMBER.email }
  );
  // What the in-memory fallback would say about an id no store holds.
  vi.mocked(findUserById).mockResolvedValue(null);
}

describe("content actions refuse a member the database no longer vouches for", () => {
  beforeEach(async () => {
    vi.clearAllMocks();
    // A cookie signed exactly as sign-in signs it, still inside its 24 hours.
    const { setSessionCookie } = await import("@/lib/security/session");
    await setSessionCookie(MEMBER);
  });

  for (const state of ["SUSPENDED", "DELETED"] as const) {
    describe(`when the member is ${state.toLowerCase()}`, () => {
      beforeEach(() => memberRowIs(state));

      it("refuses the transparency snapshot, which includes unpublished drafts", async () => {
        const { getAdminTransparencySnapshotAction } = await import("@/actions/transparency");

        const res = await getAdminTransparencySnapshotAction();

        expect(res).toEqual({ success: false, error: REFUSED });
      });

      it("refuses a new expense entry in the public ledger", async () => {
        const { createExpenseItemAction } = await import("@/actions/transparency");

        const res = await createExpenseItemAction({
          category: "MEDICAL",
          title: "Vaccination batch",
          amountSen: 12_000,
          date: "2026-09-18",
        });

        expect(res).toEqual({ success: false, error: REFUSED });
      });

      it("refuses a new financial report", async () => {
        const { createFinancialReportAction } = await import("@/actions/transparency");

        const res = await createFinancialReportAction({} as never);

        expect(res).toEqual({ success: false, error: REFUSED });
      });

      it("refuses a new FAQ entry", async () => {
        const { createFaqAction } = await import("@/actions/faqs");

        const res = await createFaqAction({} as never);

        expect(res).toEqual({ success: false, error: REFUSED });
      });
    });
  }

  it("still serves an active member", async () => {
    await memberRowIs("ACTIVE");
    const { getAdminTransparencySnapshotAction } = await import("@/actions/transparency");

    const res = await getAdminTransparencySnapshotAction();

    expect(res.success).toBe(true);
  });
});
