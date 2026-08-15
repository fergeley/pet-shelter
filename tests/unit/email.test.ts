import { describe, it, expect, vi } from "vitest";
import {
  sendApplicationConfirmationEmail,
  sendStaffApplicationAlert,
} from "@/lib/email";
import { AdoptionApplicationRecord } from "@/types/application";

describe("Transactional Email Service", () => {
  const sampleApplication: AdoptionApplicationRecord = {
    id: "app-test-999",
    petId: "pet-001",
    petName: "Kopi",
    applicantName: "Tan Ah Kow",
    email: "tahkow@example.com",
    phone: "012-3456789",
    address: "123 Jalan SS2, Petaling Jaya",
    housingType: "landed_terrace",
    hasFencedYard: "yes",
    currentPets: "none",
    householdExperience: "experienced",
    applicantNotes: "Very excited to adopt Kopi!",
    status: "SUBMITTED",
    createdAt: "2026-08-15",
    updatedAt: "2026-08-15",
  };

  it("dispatches adopter confirmation email in simulation mode when RESEND_API_KEY is unset", async () => {
    const result = await sendApplicationConfirmationEmail(sampleApplication);
    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.messageId).toContain("sim-");
  });

  it("dispatches shelter staff alert email in simulation mode when RESEND_API_KEY is unset", async () => {
    const result = await sendStaffApplicationAlert(sampleApplication);
    expect(result.success).toBe(true);
    expect(result.simulated).toBe(true);
    expect(result.messageId).toContain("sim-");
  });

  it("handles network failure gracefully without crashing or throwing", async () => {
    // Temporarily simulate RESEND_API_KEY present and fetch rejection
    const originalEnv = process.env.RESEND_API_KEY;
    process.env.RESEND_API_KEY = "test_key";

    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network connection reset"));

    const result = await sendApplicationConfirmationEmail(sampleApplication);
    expect(result.success).toBe(false);
    expect(result.error).toContain("Network connection reset");

    fetchSpy.mockRestore();
    if (originalEnv) {
      process.env.RESEND_API_KEY = originalEnv;
    } else {
      delete process.env.RESEND_API_KEY;
    }
  });
});
