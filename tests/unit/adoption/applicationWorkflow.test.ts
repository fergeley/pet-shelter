import { describe, it, expect, vi } from "vitest";
import {
  generateReferenceCode,
  normalizeReferenceCode,
  isReferenceCode,
  REFERENCE_CODE_PATTERN,
  deriveApplicationProgress,
  combineInterviewDateTime,
  splitInterviewDateTime,
  APPLICATION_MILESTONES,
} from "@/lib/domain/applicationWorkflow";
import { lookupApplicationStatusAction, submitApplication } from "@/actions/applications";
import { insertServerApplication } from "@/lib/server/applicationRepository";
import { insertServerPet } from "@/lib/server/petRepository";
import { AdoptionApplicationRecord } from "@/types/application";
import { Pet } from "@/types/pet";
import { SessionUser } from "@/lib/security/session";

const ADMIN: SessionUser = {
  id: "admin-1",
  name: "Admin User",
  email: "admin@hopeforstrays.org",
  role: "ADMIN",
  expiresAt: Date.now() + 86_400_000,
};

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

function makePet(id: string): Pet {
  return {
    id,
    name: "Milo",
    species: "dog",
    breed: "Golden Retriever Mix",
    age: "2 years",
    ageCategory: "adult",
    gender: "Male",
    size: "Large",
    weight: "22 kg",
    status: "Available",
    adoptionFee: "Free",
    description: "Friendly and social dog.",
    rescueStory: "Rescued from SS2 Petaling Jaya.",
    image: "https://example.com/milo.jpg",
    galleryImages: [],
    tags: ["Friendly"],
    featured: false,
    intakeDate: "2026-06-01",
    isArchived: false,
    deletedAt: null,
    medical: { vaccinated: true, microchipped: true, spayedNeutered: true },
    compatibility: {
      goodWithDogs: true,
      goodWithCats: true,
      goodWithKids: true,
      energyLevel: "Moderate",
    },
  } as Pet;
}

const VALID_FORM = {
  petId: "pet-workflow-1",
  petName: "Milo",
  applicantName: "Ahmad Razak",
  email: "ahmad.razak@example.com",
  phone: "012-3456789",
  identification: "880101-14-5678",
  address: "No. 24, Jalan SS 2/10, Petaling Jaya",
  housingType: "landed_terrace" as const,
  hasFencedYard: "yes" as const,
  landlordApproval: "owner_occupied" as const,
  currentPets: "dogs" as const,
  householdExperience: "experienced" as const,
  vetClinic: "Klinik Haiwan SS2",
  dailyAloneHours: "4_to_8" as const,
};

describe("reference codes", () => {
  it("builds HFS-APP-YYYYMM-XXXX from the given month", () => {
    const code = generateReferenceCode(new Date(Date.UTC(2026, 8, 8)), () => 0);

    expect(code).toBe("HFS-APP-202609-2222");
    expect(REFERENCE_CODE_PATTERN.test(code)).toBe(true);
  });

  it("pads a single-digit month", () => {
    expect(generateReferenceCode(new Date(Date.UTC(2027, 0, 31)), () => 0)).toBe(
      "HFS-APP-202701-2222"
    );
  });

  it("never emits a glyph that is ambiguous when transcribed by hand", () => {
    // Walk the whole alphabet through the suffix positions. Only the suffix is
    // drawn from the alphabet — the YYYYMM segment is a date and legitimately
    // contains digits the alphabet excludes.
    let cursor = 0;
    const everySuffix = Array.from({ length: 40 }, () =>
      generateReferenceCode(new Date(Date.UTC(2026, 8, 8)), (bound) => cursor++ % bound).slice(-4)
    ).join("");

    expect(everySuffix).not.toMatch(/[01ILOU]/);
    // And the walk really did cover the alphabet, so the assertion has teeth.
    expect(new Set(everySuffix).size).toBe(30);
  });

  it("generates codes that satisfy its own pattern across many draws", () => {
    for (let i = 0; i < 200; i += 1) {
      expect(isReferenceCode(generateReferenceCode())).toBe(true);
    }
  });

  it("normalises what an applicant actually types", () => {
    const canonical = "HFS-APP-202609-K7QM";

    expect(normalizeReferenceCode("hfs-app-202609-k7qm")).toBe(canonical);
    expect(normalizeReferenceCode("  HFS-APP-202609-K7QM  ")).toBe(canonical);
    expect(normalizeReferenceCode("HFSAPP202609K7QM")).toBe(canonical);
    expect(normalizeReferenceCode("202609K7QM")).toBe(canonical);
    expect(normalizeReferenceCode("hfs app 202609 k7qm")).toBe(canonical);
  });

  it("passes an unrecognised value through so it can still be tried as a legacy id", () => {
    expect(normalizeReferenceCode("  app-1234567  ")).toBe("APP-1234567");
    expect(isReferenceCode("APP-1234567")).toBe(false);
  });
});

describe("interview date and time", () => {
  it("round-trips a date and time without drifting by timezone", () => {
    const iso = combineInterviewDateTime("2026-09-20", "14:30");

    expect(iso).toBe("2026-09-20T14:30:00.000Z");
    expect(splitInterviewDateTime(iso!)).toEqual({ date: "2026-09-20", time: "14:30" });
  });

  it("pads a single-digit hour", () => {
    expect(combineInterviewDateTime("2026-09-20", "9:05")).toBe("2026-09-20T09:05:00.000Z");
  });

  it("returns null rather than an Invalid Date for unusable input", () => {
    expect(combineInterviewDateTime("20-09-2026", "14:30")).toBeNull();
    expect(combineInterviewDateTime("2026-09-20", "soon")).toBeNull();
    expect(combineInterviewDateTime("", "")).toBeNull();
    expect(splitInterviewDateTime("not-a-date")).toBeNull();
  });
});

describe("milestone progression", () => {
  it("starts at RECEIVED for a freshly submitted application", () => {
    const progress = deriveApplicationProgress({ status: "SUBMITTED" });

    expect(progress.currentMilestone).toBe("RECEIVED");
    expect(progress.currentIndex).toBe(0);
    expect(progress.isDecided).toBe(false);
  });

  it("advances to REVIEW once the coordinator picks it up", () => {
    expect(deriveApplicationProgress({ status: "UNDER_REVIEW" }).currentMilestone).toBe("REVIEW");
  });

  it("advances to INTERVIEW when a meet & greet is on the record", () => {
    const progress = deriveApplicationProgress({
      status: "UNDER_REVIEW",
      interviewAt: "2026-09-20T14:30:00.000Z",
    });

    expect(progress.currentMilestone).toBe("INTERVIEW");
    expect(progress.currentIndex).toBe(2);
  });

  it("advances to HOME_VISIT when a home visit is on the record", () => {
    const progress = deriveApplicationProgress({
      status: "UNDER_REVIEW",
      interviewAt: "2026-09-20T14:30:00.000Z",
      homeVisitAt: "2026-09-25T10:00:00.000Z",
    });

    expect(progress.currentMilestone).toBe("HOME_VISIT");
    expect(progress.currentIndex).toBe(3);
  });

  it("reaches DECISION on approval, and reports every earlier milestone as reached", () => {
    const progress = deriveApplicationProgress({ status: "APPROVED" });

    expect(progress.currentMilestone).toBe("DECISION");
    expect(progress.currentIndex).toBe(APPLICATION_MILESTONES.length - 1);
    expect(progress.reached).toEqual([...APPLICATION_MILESTONES]);
    expect(progress.isDecided).toBe(true);
    expect(progress.isRejected).toBe(false);
  });

  it("treats rejection as a decision, not as a stalled review", () => {
    const progress = deriveApplicationProgress({ status: "REJECTED" });

    expect(progress.isRejected).toBe(true);
    expect(progress.isDecided).toBe(true);
    expect(progress.currentMilestone).toBe("DECISION");
  });

  it("backfills earlier milestones rather than showing a later step with a dark earlier one", () => {
    // A home visit logged while the row is somehow still SUBMITTED: progress is
    // monotonic, so REVIEW counts as reached even though status alone denies it.
    const progress = deriveApplicationProgress({
      status: "SUBMITTED",
      homeVisitAt: "2026-09-25T10:00:00.000Z",
    });

    expect(progress.currentIndex).toBe(3);
    expect(progress.reached).toContain("REVIEW");
    expect(progress.reached).toContain("INTERVIEW");
  });
});

describe("tracking portal authorization", () => {
  it("issues a reference code on submission and finds the application by it", async () => {
    await insertServerPet(makePet("pet-workflow-1"), ADMIN);

    const submitted = await submitApplication(VALID_FORM);
    expect(submitted.success).toBe(true);

    const referenceCode = submitted.data!.referenceCode!;
    expect(isReferenceCode(referenceCode)).toBe(true);

    const found = await lookupApplicationStatusAction({
      referenceId: referenceCode,
      email: VALID_FORM.email,
    });

    expect(found.success).toBe(true);
    expect(found.data!.referenceCode).toBe(referenceCode);
    expect(found.data!.petName).toBe("Milo");
  });

  it("accepts the reference code lowercased and unpunctuated, as applicants type it", async () => {
    await insertServerPet(makePet("pet-workflow-1"), ADMIN);
    const submitted = await submitApplication(VALID_FORM);
    const referenceCode = submitted.data!.referenceCode!;

    const found = await lookupApplicationStatusAction({
      referenceId: referenceCode.toLowerCase().replace(/-/g, ""),
      email: VALID_FORM.email,
    });

    expect(found.success).toBe(true);
    expect(found.data!.referenceCode).toBe(referenceCode);
  });

  it("still finds an application submitted before reference codes existed, by its id", async () => {
    await insertServerPet(makePet("pet-workflow-1"), ADMIN);
    const submitted = await submitApplication(VALID_FORM);

    const found = await lookupApplicationStatusAction({
      referenceId: submitted.data!.id,
      email: VALID_FORM.email,
    });

    expect(found.success).toBe(true);
    expect(found.data!.id).toBe(submitted.data!.id);
  });

  it("refuses a correct reference code with the wrong email", async () => {
    await insertServerPet(makePet("pet-workflow-1"), ADMIN);
    const submitted = await submitApplication(VALID_FORM);

    const found = await lookupApplicationStatusAction({
      referenceId: submitted.data!.referenceCode!,
      email: "someone.else@example.com",
    });

    expect(found.success).toBe(false);
    expect(found.data).toBeUndefined();
  });

  it("gives the same answer for a wrong email and an unknown code, so codes cannot be probed", async () => {
    await insertServerPet(makePet("pet-workflow-1"), ADMIN);
    const submitted = await submitApplication(VALID_FORM);

    const wrongEmail = await lookupApplicationStatusAction({
      referenceId: submitted.data!.referenceCode!,
      email: "someone.else@example.com",
    });
    const unknownCode = await lookupApplicationStatusAction({
      referenceId: "HFS-APP-202609-ZZZZ",
      email: VALID_FORM.email,
    });

    expect(wrongEmail.success).toBe(false);
    expect(unknownCode.success).toBe(false);
    expect(wrongEmail.error).toBe(unknownCode.error);
  });

  it("never publishes NRIC, phone or address to the public tracking portal", async () => {
    await insertServerPet(makePet("pet-workflow-1"), ADMIN);
    const submitted = await submitApplication(VALID_FORM);

    const found = await lookupApplicationStatusAction({
      referenceId: submitted.data!.referenceCode!,
      email: VALID_FORM.email,
    });

    expect(found.success).toBe(true);
    const serialized = JSON.stringify(found.data);

    expect(serialized).not.toContain(VALID_FORM.identification);
    expect(serialized).not.toContain(VALID_FORM.phone);
    expect(serialized).not.toContain(VALID_FORM.address);
    expect(found.data).not.toHaveProperty("identification");
  });
});

describe("tracking portal step progression", () => {
  async function trackRecord(overrides: Partial<AdoptionApplicationRecord>) {
    const record: AdoptionApplicationRecord = {
      id: "app-progression-1",
      referenceCode: "HFS-APP-202609-K7QM",
      petId: "pet-workflow-1",
      petName: "Milo",
      applicantName: "Ahmad Razak",
      email: "ahmad.razak@example.com",
      phone: "012-3456789",
      address: "Petaling Jaya",
      housingType: "landed_terrace",
      hasFencedYard: "yes",
      currentPets: "none",
      householdExperience: "experienced",
      status: "UNDER_REVIEW",
      createdAt: "2026-09-08",
      updatedAt: "2026-09-08",
      ...overrides,
    };

    await insertServerApplication(record);

    return lookupApplicationStatusAction({
      referenceId: record.referenceCode!,
      email: record.email,
    });
  }

  it("reports REVIEW for an application under review with no milestones logged", async () => {
    const result = await trackRecord({});

    expect(result.success).toBe(true);
    expect(result.data!.milestone).toBe("REVIEW");
    expect(result.data!.milestoneIndex).toBe(1);
  });

  it("advances the portal to INTERVIEW once an interview is recorded in its own columns", async () => {
    const result = await trackRecord({
      interviewAt: "2026-09-20T14:30:00.000Z",
      interviewLocation: "Hope for Strays sanctuary, PJ",
      interviewMeetingType: "in_person",
    });

    expect(result.data!.milestone).toBe("INTERVIEW");
    expect(result.data!.interviewDetails).toEqual({
      interviewDate: "2026-09-20",
      interviewTime: "14:30",
      location: "Hope for Strays sanctuary, PJ",
      meetingType: "in_person",
    });
  });

  it("advances to HOME_VISIT once a home visit is recorded", async () => {
    const result = await trackRecord({
      interviewAt: "2026-09-20T14:30:00.000Z",
      homeVisitAt: "2026-09-25T10:00:00.000Z",
    });

    expect(result.data!.milestone).toBe("HOME_VISIT");
    expect(result.data!.milestoneIndex).toBe(3);
  });

  it("reads an interview out of a legacy note when the milestone columns are empty", async () => {
    // Applications scheduled before the milestone columns existed carry the
    // interview only in adminReviewNotes. The portal must still light step 3.
    const result = await trackRecord({
      adminReviewNotes:
        "[Meet & Greet Scheduled: 2026-09-20 at 14:30 (In-Person Visit) - Location: Sanctuary PJ] Bring your IC.",
    });

    expect(result.data!.milestone).toBe("INTERVIEW");
    expect(result.data!.interviewDetails?.location).toBe("Sanctuary PJ");
    expect(result.data!.interviewDetails?.meetingType).toBe("in_person");
  });

  it("reaches DECISION when the application is approved", async () => {
    const result = await trackRecord({ status: "APPROVED" });

    expect(result.data!.milestone).toBe("DECISION");
    expect(result.data!.milestoneIndex).toBe(APPLICATION_MILESTONES.length - 1);
  });
});
