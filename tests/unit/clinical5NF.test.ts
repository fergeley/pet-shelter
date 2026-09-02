import { describe, it, expect, beforeEach } from "vitest";
import {
  getVeterinarians,
  getMedicalProcedureCategories,
  verifyClinical5NF,
  assignVetToPet,
  resetClinicalStore,
} from "@/lib/server/clinicalRepository";

describe("5NF Clinical Operations & Join Dependency Verification", () => {
  beforeEach(() => {
    resetClinicalStore();
  });

  it("retrieves registered veterinarians and standard medical procedure categories", async () => {
    const vets = await getVeterinarians();
    expect(vets.length).toBeGreaterThanOrEqual(3);
    expect(vets.find((v) => v.id === "vet-01")?.name).toBe("Dr. Sarah Tan");

    const categories = await getMedicalProcedureCategories();
    expect(categories.length).toBe(6);
    expect(categories.map((c) => c.id)).toContain("surgery");
    expect(categories.map((c) => c.id)).toContain("vaccination");
  });

  it("enforces 5NF: rejects clinical action when veterinarian lacks category specialization", async () => {
    // Dr. Lim Wei Ling (vet-03) is certified for intake, vaccination, clearance — but NOT surgery
    await assignVetToPet("vet-03", "pet-001");

    const verification = await verifyClinical5NF("vet-03", "surgery", "pet-001");
    expect(verification.isValid).toBe(false);
    expect(verification.hasSpecialization).toBe(false);
    expect(verification.hasAssignment).toBe(true);
    expect(verification.reason).toContain("not certified/specialized");
  });

  it("enforces 5NF: rejects clinical action when veterinarian is not assigned to pet", async () => {
    // Dr. Ramesh Kumar (vet-02) is a certified surgeon, but NOT assigned to pet-999
    const verification = await verifyClinical5NF("vet-02", "surgery", "pet-999");
    expect(verification.isValid).toBe(false);
    expect(verification.hasSpecialization).toBe(true);
    expect(verification.hasAssignment).toBe(false);
    expect(verification.reason).toContain("not formally assigned as attending physician");
  });

  it("enforces 5NF: allows clinical action when both specialization and pet assignment hold", async () => {
    // Assign Dr. Sarah Tan (vet-01, certified for all procedures) to pet-002
    await assignVetToPet("vet-01", "pet-002");

    const verification = await verifyClinical5NF("vet-01", "vaccination", "pet-002");
    expect(verification.isValid).toBe(true);
    expect(verification.hasSpecialization).toBe(true);
    expect(verification.hasAssignment).toBe(true);
    expect(verification.reason).toBeUndefined();
  });

  it("handles assignment updates idempotently", async () => {
    await assignVetToPet("vet-01", "pet-003", true);
    await assignVetToPet("vet-01", "pet-003", false);

    const verification = await verifyClinical5NF("vet-01", "treatment", "pet-003");
    expect(verification.isValid).toBe(true);
  });
});
