import { describe, it, expect } from "vitest";
import {
  getCategoryBadgeClasses,
  getCategoryToneClass,
} from "@/lib/presentation/medicalTimelinePresentation";

// The timeline's other half — how the events are assembled — is domain logic and is
// covered by tests/unit/medicalTimeline.test.ts.
describe("Medical Timeline Category Presentation", () => {
  it("should return a design-system tone class for every category", () => {
    expect(getCategoryToneClass("intake")).toBe("tone-info");
    expect(getCategoryToneClass("diagnostic")).toBe("tone-highlight");
    expect(getCategoryToneClass("treatment")).toBe("tone-warning");
    expect(getCategoryToneClass("vaccination")).toBe("tone-success");
    expect(getCategoryToneClass("surgery")).toBe("tone-danger");
    expect(getCategoryToneClass("clearance")).toBe("tone-success");
  });

  // Colour-only classes: the badge's padding, radius and type scale belong to the call
  // site, so a `tone-panel` shell leaking in here would double up on both.
  it("should return tone-soft colour classes without a panel shell", () => {
    for (const category of [
      "intake",
      "diagnostic",
      "treatment",
      "vaccination",
      "surgery",
      "clearance",
    ] as const) {
      const classes = getCategoryBadgeClasses(category);
      expect(classes).toContain("tone-soft");
      expect(classes).toContain(getCategoryToneClass(category));
      expect(classes).not.toContain("tone-panel ");
    }
  });

  // Clearance shares vaccination's tone, so the emphasised surface is the only thing
  // separating "vaccinated" from "cleared by a vet" at a glance.
  it("should distinguish clearance from vaccination by surface weight, not hue", () => {
    expect(getCategoryBadgeClasses("clearance")).toContain("tone-panel-strong");
    expect(getCategoryBadgeClasses("vaccination")).not.toContain("tone-panel-strong");
  });
});
