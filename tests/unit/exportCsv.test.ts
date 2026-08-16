import { describe, it, expect } from "vitest";
import {
  formatCsvField,
  generateReceiptsCsvString,
  generateAuditLogsCsvString,
  generateApplicationsCsvString,
  generatePetsCsvString,
} from "@/lib/exportCsv";
import { DonationReceipt } from "@/types/sponsorship";
import { AuditEntry } from "@/lib/domain/auditLog";
import { AdoptionApplicationRecord } from "@/types/application";
import { Pet } from "@/types/pet";

describe("CSV Export Formatting & Security Engine (RFC-4180)", () => {
  it("should escape commas, quotes, and newlines properly", () => {
    expect(formatCsvField("Tan Sri Dr. Lim, Jr.")).toBe('"Tan Sri Dr. Lim, Jr."');
    expect(formatCsvField('He said "Hello"')).toBe('"He said ""Hello"""');
    expect(formatCsvField("Line 1\nLine 2")).toBe('"Line 1\nLine 2"');
    expect(formatCsvField("SimpleText")).toBe('"SimpleText"');
    expect(formatCsvField(null)).toBe('""');
    expect(formatCsvField(undefined)).toBe('""');
    expect(formatCsvField(120)).toBe('"120"');
  });

  it("should mitigate CSV formula injection attacks on strings (=, +, -, @, \\t, \\r)", () => {
    expect(formatCsvField("=SUM(A1:A10)")).toBe("\"'=SUM(A1:A10)\"");
    expect(formatCsvField("+12345")).toBe("\"'+12345\"");
    expect(formatCsvField("-50.00")).toBe("\"'-50.00\"");
    expect(formatCsvField("@cmd")).toBe("\"'@cmd\"");
    expect(formatCsvField("\tTabInjection")).toBe("\"'\tTabInjection\"");
  });

  it("should treat numbers and booleans cleanly", () => {
    expect(formatCsvField(50)).toBe('"50"');
    expect(formatCsvField(true)).toBe('"true"');
    expect(formatCsvField(false)).toBe('"false"');
  });
});

describe("LHDN Donation Receipt CSV Generator", () => {
  it("should generate standard CSV headers and rows for DonationReceipt records", () => {
    const mockReceipts: DonationReceipt[] = [
      {
        receiptNumber: "HFS-DON-202608-1234",
        date: "16 Aug 2026, 10:00 AM",
        donorName: "Dr. Cheryl Tan",
        donorEmail: "cheryl.tan@example.com",
        donorPhone: "012-345 6789",
        tierId: "vaccine",
        tierName: "Core Vaccination & Deworming",
        amountMYR: 50,
        frequency: "one_time",
        paymentMethod: "duitnow_qr",
        targetPetName: "Milo",
        taxIdOrIc: "920512-10-5432",
        taxDeductibleRef: "LHDN.01/35/42/51/179-6.4912",
        shelterRegistrationNo: "PPM-021-10-18082021",
      },
    ];

    const csv = generateReceiptsCsvString(mockReceipts);
    expect(csv).toContain("Official Receipt No");
    expect(csv).toContain("Tax ID / IC / Passport");
    expect(csv).toContain("LHDN Exemption Ref");
    expect(csv).toContain("HFS-DON-202608-1234");
    expect(csv).toContain('"Dr. Cheryl Tan"');
    expect(csv).toContain('"cheryl.tan@example.com"');
    expect(csv).toContain('"920512-10-5432"');
    expect(csv).toContain('"50.00"');
    expect(csv).toContain('"LHDN.01/35/42/51/179-6.4912"');
    expect(csv).toContain('"PPM-021-10-18082021"');
  });

  it("should parse donation audit log entries into valid receipt CSV rows", () => {
    const auditLogs: AuditEntry[] = [
      {
        id: "audit-123",
        actorId: "donor_public",
        actorEmail: "donor@example.com",
        actorRole: "DONOR",
        action: "DONATION_RECEIVED",
        entity: "DonationReceipt",
        entityId: "HFS-DON-202608-5678",
        createdAt: "2026-08-16T08:00:00.000Z",
        details: {
          receiptNumber: "HFS-DON-202608-5678",
          donorName: "Ahmad Farhan",
          donorPhone: "017-888 9999",
          amountMYR: 120,
          tierName: "Spay / Neuter Surgery Sponsorship",
          paymentMethod: "duitnow_qr",
          taxIdOrIc: "891101-14-1122",
          targetPetName: "Bella",
        },
      },
    ];

    const csv = generateReceiptsCsvString(auditLogs);
    expect(csv).toContain("HFS-DON-202608-5678");
    expect(csv).toContain('"Ahmad Farhan"');
    expect(csv).toContain('"891101-14-1122"');
    expect(csv).toContain('"120.00"');
    expect(csv).toContain('"Spay / Neuter Surgery Sponsorship"');
  });
});

describe("Audit Trail CSV Generator (ROS AGM Compliance)", () => {
  it("should format audit log entries into CSV string with timestamp and details snapshot", () => {
    const auditLogs: AuditEntry[] = [
      {
        id: "audit-999",
        actorId: "usr-admin-01",
        actorEmail: "admin@hopeforstrays.org",
        actorRole: "ADMIN",
        action: "APPLICATION_APPROVED",
        entity: "AdoptionApplication",
        entityId: "app-2026-001",
        createdAt: "2026-08-16T09:00:00.000Z",
        details: { approvedBy: "admin@hopeforstrays.org", petName: "Luna" },
      },
    ];

    const csv = generateAuditLogsCsvString(auditLogs);
    expect(csv).toContain("Audit Log ID");
    expect(csv).toContain("Timestamp (UTC)");
    expect(csv).toContain("Actor Email");
    expect(csv).toContain("Action Event");
    expect(csv).toContain("audit-999");
    expect(csv).toContain("APPLICATION_APPROVED");
    expect(csv).toContain("admin@hopeforstrays.org");
  });
});

describe("Applications and Pets CSV Generators", () => {
  it("should generate adoption application CSV with applicant details", () => {
    const mockApp: AdoptionApplicationRecord = {
      id: "app-test-1",
      petId: "pet-1",
      petName: "Milo",
      petBreed: "Malaysian Domestic Dog",
      applicantName: "Ken Tan",
      email: "ken@example.com",
      phone: "0123456789",
      address: "SS2 Petaling Jaya",
      housingType: "Landed",
      hasFencedYard: "Yes",
      currentPets: "None",
      householdExperience: "Owned dogs for 10 years",
      status: "UNDER_REVIEW",
      createdAt: "2026-08-16T08:00:00.000Z",
      updatedAt: "2026-08-16T08:00:00.000Z",
    };

    const csv = generateApplicationsCsvString([mockApp]);
    expect(csv).toContain("Application ID");
    expect(csv).toContain("app-test-1");
    expect(csv).toContain("Ken Tan");
    expect(csv).toContain("ken@example.com");
  });

  it("should generate pet inventory CSV with medical details", () => {
    const mockPet: Pet = {
      id: "pet-1",
      name: "Barnaby",
      species: "dog",
      breed: "Mixed Breed",
      age: "2 years",
      ageCategory: "adult",
      gender: "Male",
      size: "Medium",
      weight: "16 kg",
      status: "Available",
      adoptionFee: "Free",
      description: "Friendly dog",
      rescueStory: "Rescued from SS2",
      image: "https://example.com/pet.jpg",
      intakeDate: "2026-01-01",
      tags: ["Friendly", "Good with Kids"],
      medical: {
        vaccinated: true,
        microchipped: true,
        spayedNeutered: true,
      },
      compatibility: {
        goodWithDogs: true,
        goodWithCats: false,
        goodWithKids: true,
        energyLevel: "Moderate",
      },
    };

    const csv = generatePetsCsvString([mockPet]);
    expect(csv).toContain("Pet ID");
    expect(csv).toContain("Barnaby");
    expect(csv).toContain("Spayed/Neutered");
    expect(csv).toContain("Yes");
  });
});
