import { describe, it, expect, vi, afterEach } from "vitest";
import {
  LHDN_TAX_DEDUCTIBLE_REF,
  PUBLIC_ROS_REGISTRATION_NO,
  SHELTER_LEGAL_NAME,
  STATUTORY_ROS_REGISTRATION_NO,
  currentIssuerIdentity,
} from "@/lib/domain/shelterIdentity";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("statutory identifiers", () => {
  it("exposes the LHDN Subsection 44(6) approval reference", () => {
    expect(LHDN_TAX_DEDUCTIBLE_REF).toBe("LHDN.01/35/42/51/179-6.4912");
  });

  it("keeps the registered society name as filed with the ROS", () => {
    expect(SHELTER_LEGAL_NAME).toBe("Persatuan Harapan Haiwan Terbiar Selangor");
  });

  it("preserves the registration number that issued receipts already carry", () => {
    // Centralising these constants must not silently change what lands on a tax
    // document. This pins the value that `src/actions/donations.ts` emitted before
    // the constants were collapsed into one module.
    expect(STATUTORY_ROS_REGISTRATION_NO).toBe("PPM-021-10-18082021");
  });
});

describe("the unresolved ROS registration discrepancy (P2)", () => {
  it("still has two deliberately divergent values", () => {
    // ── READ THIS BEFORE "FIXING" THE FAILURE ────────────────────────────────
    // Two digit-transposed ROS numbers are in use: one on public pages, one on
    // statutory receipts and ROS exports. Which is correct is BLOCKED on someone
    // checking the physical ROS certificate — see
    // docs/tasks/HANDOFF_SECURITY_REHAB_AND_HISTORY.md (P2).
    //
    // This assertion exists so the divergence cannot be "tidied up" by aligning
    // one constant to the other without that check. When the certificate is
    // confirmed: unify the constants in src/lib/domain/shelterIdentity.ts and
    // DELETE this test, in the same change.
    expect(STATUTORY_ROS_REGISTRATION_NO).not.toBe(PUBLIC_ROS_REGISTRATION_NO);
    expect(PUBLIC_ROS_REGISTRATION_NO).toBe("PPM-012-10-18042016");
  });

  it("can be corrected by configuration, without a code deploy", async () => {
    vi.resetModules();
    vi.stubEnv("ROS_REGISTRATION_NO", "PPM-012-10-18042016");

    const reloaded = await import("@/lib/domain/shelterIdentity");

    expect(reloaded.STATUTORY_ROS_REGISTRATION_NO).toBe("PPM-012-10-18042016");
    expect(reloaded.currentIssuerIdentity().shelterRegistrationNo).toBe(
      "PPM-012-10-18042016"
    );
  });
});

describe("currentIssuerIdentity", () => {
  it("captures the identifiers a receipt is stamped with at issue time", () => {
    expect(currentIssuerIdentity()).toEqual({
      taxDeductibleRef: LHDN_TAX_DEDUCTIBLE_REF,
      shelterRegistrationNo: STATUTORY_ROS_REGISTRATION_NO,
    });
  });

  it("returns a fresh object each call, so a stored snapshot cannot be mutated later", () => {
    const first = currentIssuerIdentity();
    const second = currentIssuerIdentity();

    expect(first).not.toBe(second);
    expect(first).toEqual(second);
  });
});
