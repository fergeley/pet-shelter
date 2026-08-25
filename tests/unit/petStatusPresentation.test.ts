import { describe, it, expect } from "vitest";

import {
  getPetStatusPresentation,
  getRehabStageLabel,
  getRehabProgressPercent,
  matchesStatusFilter,
} from "@/lib/petStatusPresentation";
import { PetStatus } from "@/types/pet";

describe("getPetStatusPresentation", () => {
  it("marks Available animals as adoptable", () => {
    const presentation = getPetStatusPresentation("Available");
    expect(presentation.tone).toBe("available");
    expect(presentation.isAdoptable).toBe(true);
    expect(presentation.isInRehabilitation).toBe(false);
  });

  it("marks animals under care as non-adoptable", () => {
    const presentation = getPetStatusPresentation("In Rehabilitation");
    expect(presentation.tone).toBe("rehabilitation");
    expect(presentation.isAdoptable).toBe(false);
    expect(presentation.isInRehabilitation).toBe(true);
  });

  // The legacy alias must be indistinguishable from the canonical spelling, or rehab
  // animals stored under one spelling render as ordinary unavailable cards.
  it("treats the legacy 'Rehabilitation' alias identically to 'In Rehabilitation'", () => {
    expect(getPetStatusPresentation("Rehabilitation")).toEqual(
      getPetStatusPresentation("In Rehabilitation")
    );
  });

  it("distinguishes Pending from rehabilitation", () => {
    const presentation = getPetStatusPresentation("Pending");
    expect(presentation.tone).toBe("pending");
    expect(presentation.isAdoptable).toBe(false);
    expect(presentation.isInRehabilitation).toBe(false);
  });

  it("gives Adopted its own tone rather than reusing Pending", () => {
    const presentation = getPetStatusPresentation("Adopted");
    expect(presentation.tone).toBe("adopted");
    expect(presentation.isAdoptable).toBe(false);
  });

  it("returns a distinct badge treatment per tone", () => {
    const statuses: PetStatus[] = ["Available", "In Rehabilitation", "Pending", "Adopted"];
    const badges = statuses.map((s) => getPetStatusPresentation(s).badgeClass);
    expect(new Set(badges).size).toBe(statuses.length);
  });

  it("supplies a translation key and an English fallback for every status", () => {
    const statuses: PetStatus[] = ["Available", "In Rehabilitation", "Rehabilitation", "Pending", "Adopted"];
    for (const status of statuses) {
      const { labelKey, labelFallback } = getPetStatusPresentation(status);
      expect(labelKey).toMatch(/^common\./);
      expect(labelFallback.length).toBeGreaterThan(0);
    }
  });
});

describe("getRehabStageLabel", () => {
  it("prefers the Malay stage when the language is Malay", () => {
    const label = getRehabStageLabel(
      { rehabStage: "Stage 2: Orthopaedic Recovery", rehabStageMs: "Peringkat 2: Pemulihan Ortopedik" },
      true
    );
    expect(label).toBe("Peringkat 2: Pemulihan Ortopedik");
  });

  it("falls back to English when no Malay stage was recorded", () => {
    const label = getRehabStageLabel({ rehabStage: "Stage 2: Orthopaedic Recovery" }, true);
    expect(label).toBe("Stage 2: Orthopaedic Recovery");
  });

  it("returns undefined when no stage is recorded at all", () => {
    expect(getRehabStageLabel({}, false)).toBeUndefined();
    expect(getRehabStageLabel({ rehabStage: "   " }, false)).toBeUndefined();
  });
});

describe("getRehabProgressPercent", () => {
  it("passes through a valid percentage", () => {
    expect(getRehabProgressPercent({ rehabProgressPercent: 55 })).toBe(55);
  });

  // A width of 150% or -5% breaks the progress bar layout; the store does not constrain this.
  it("clamps out-of-range values into 0-100", () => {
    expect(getRehabProgressPercent({ rehabProgressPercent: 150 })).toBe(100);
    expect(getRehabProgressPercent({ rehabProgressPercent: -5 })).toBe(0);
  });

  it("returns undefined when no progress is recorded", () => {
    expect(getRehabProgressPercent({})).toBeUndefined();
  });

  it("keeps an explicit zero rather than treating it as absent", () => {
    expect(getRehabProgressPercent({ rehabProgressPercent: 0 })).toBe(0);
  });
});

describe("matchesStatusFilter", () => {
  it("passes every animal through when the filter is 'all'", () => {
    expect(matchesStatusFilter("Available", "all")).toBe(true);
    expect(matchesStatusFilter("In Rehabilitation", "all")).toBe(true);
    expect(matchesStatusFilter("Adopted", "all")).toBe(true);
  });

  it("matches an exact status", () => {
    expect(matchesStatusFilter("Available", "Available")).toBe(true);
    expect(matchesStatusFilter("Available", "Pending")).toBe(false);
  });

  // The regression this predicate exists to prevent: the gallery filter previously
  // compared raw strings, so selecting one spelling dropped animals stored as the other.
  it("matches across both spellings of the rehabilitation status", () => {
    expect(matchesStatusFilter("Rehabilitation", "In Rehabilitation")).toBe(true);
    expect(matchesStatusFilter("In Rehabilitation", "Rehabilitation")).toBe(true);
  });

  it("does not match rehabilitation against unrelated statuses", () => {
    expect(matchesStatusFilter("In Rehabilitation", "Available")).toBe(false);
    expect(matchesStatusFilter("Pending", "In Rehabilitation")).toBe(false);
  });

  it("rejects an unrecognised filter value rather than matching everything", () => {
    expect(matchesStatusFilter("Available", "Nonsense")).toBe(false);
  });
});
