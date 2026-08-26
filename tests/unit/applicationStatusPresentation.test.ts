import { describe, it, expect } from "vitest";

import {
  APPLICATION_STATUS_SEQUENCE,
  buildApplicationStatusFilterOptions,
  getApplicationStatusPresentation,
} from "@/lib/applicationStatusPresentation";
import { APPLICATION_TRANSITION_GRAPH } from "@/lib/domain/stateMachine";
import { ApplicationStatus } from "@/types/application";

const ALL: ApplicationStatus[] = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "REJECTED"];

describe("getApplicationStatusPresentation", () => {
  // The table used to print `status.replace("_", " ")`, which is the storage value with a
  // space in it rather than a label anyone chose.
  it("supplies a written label instead of the raw union member", () => {
    expect(getApplicationStatusPresentation("UNDER_REVIEW").label).toBe("Under Review");
    expect(getApplicationStatusPresentation("SUBMITTED").label).toBe("Submitted");
  });

  it("gives every status its own tone", () => {
    const tones = ALL.map((s) => getApplicationStatusPresentation(s).tone);
    expect(new Set(tones).size).toBe(ALL.length);
  });

  it("gives every status its own chip and pill treatment", () => {
    expect(new Set(ALL.map((s) => getApplicationStatusPresentation(s).chipClass)).size).toBe(4);
    expect(new Set(ALL.map((s) => getApplicationStatusPresentation(s).pillClass)).size).toBe(4);
  });

  // Both shells come from `globals.css` and carry their own metrics and per-theme text
  // colour, so a raw palette utility or a hand-written `dark:` override here means the
  // status colours have started drifting from the design system again.
  it("builds both treatments from design-system tone classes, not raw hues", () => {
    for (const status of ALL) {
      const { toneClass, chipClass, pillClass } =
        getApplicationStatusPresentation(status);
      expect(toneClass).toMatch(/^tone-[a-z]+$/);
      expect(chipClass).toBe(`tone-chip ${toneClass}`);
      expect(pillClass).toBe(`tone-pill ${toneClass}`);
      for (const classes of [chipClass, pillClass]) {
        expect(classes).not.toMatch(/\bdark:/);
        expect(classes).not.toMatch(
          /\b(bg|text|border|ring)-(emerald|amber|sky|blue|red|rose|zinc)-\d{2,3}\b/
        );
      }
    }
  });

  // The decision buttons read as verbs ("Approve"), the badges as states ("Approved").
  it("carries a verb for the decision buttons alongside the state label", () => {
    expect(getApplicationStatusPresentation("APPROVED").actionLabel).toBe("Approve");
    expect(getApplicationStatusPresentation("REJECTED").actionLabel).toBe("Reject");
  });
});

describe("APPLICATION_STATUS_SEQUENCE", () => {
  // The guard against the defect this module exists to prevent: a status added to the
  // domain but forgotten by the controls that list them.
  it("covers every status the transition graph knows about", () => {
    expect([...APPLICATION_STATUS_SEQUENCE].sort()).toEqual(
      Object.keys(APPLICATION_TRANSITION_GRAPH).sort()
    );
  });
});

describe("buildApplicationStatusFilterOptions", () => {
  it("offers one option per status in review order", () => {
    expect(buildApplicationStatusFilterOptions([]).map((o) => o.value)).toEqual([
      "SUBMITTED",
      "UNDER_REVIEW",
      "APPROVED",
      "REJECTED",
    ]);
  });

  it("produces counts that sum to the number of applications passed in", () => {
    const applications = ALL.map((status) => ({ status }));
    const total = buildApplicationStatusFilterOptions(applications).reduce(
      (sum, option) => sum + option.count,
      0
    );
    expect(total).toBe(applications.length);
  });

  it("counts repeats of one status into the same bucket", () => {
    const options = buildApplicationStatusFilterOptions([
      { status: "APPROVED" },
      { status: "APPROVED" },
      { status: "REJECTED" },
    ]);
    expect(options.find((o) => o.value === "APPROVED")?.count).toBe(2);
    expect(options.find((o) => o.value === "SUBMITTED")?.count).toBe(0);
  });
});
