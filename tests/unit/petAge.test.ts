import { describe, it, expect } from "vitest";
import {
  computeAgeInMonths,
  computeAgeCategory,
  formatAgeString,
  approximateBirthDate,
  formatAgeBandRange,
  withDerivedAge,
  AGE_BANDS,
} from "@/lib/domain/petAge";

describe("Pet Age & Lifecycle Domain Math (petAge.ts)", () => {
  describe("computeAgeInMonths", () => {
    it("computes exact months between dates", () => {
      expect(computeAgeInMonths("2025-01-15", "2026-01-15")).toBe(12);
      expect(computeAgeInMonths("2025-01-15", "2026-01-14")).toBe(11);
      expect(computeAgeInMonths("2026-01-15", "2026-05-20")).toBe(4);
    });

    it("handles invalid dates safely by returning 0", () => {
      expect(computeAgeInMonths("invalid-date", "2026-01-15")).toBe(0);
    });

    it("parses ISO date-only strings without timezone rollover offsets", () => {
      expect(computeAgeInMonths("2024-06-15", "2025-06-15")).toBe(12);
      expect(computeAgeInMonths("2024-06-15", "2025-06-14")).toBe(11);
    });
  });

  describe("computeAgeCategory (Lifecycle Boundaries)", () => {
    it("classifies < 12 months as puppy_kitten", () => {
      expect(computeAgeCategory("2026-04-01", "2026-08-01")).toBe("puppy_kitten"); // 4 months
      expect(computeAgeCategory("2025-08-02", "2026-08-01")).toBe("puppy_kitten"); // 11 months
    });

    it("classifies 12 to < 36 months (1 - <3 years) as young", () => {
      expect(computeAgeCategory("2025-08-01", "2026-08-01")).toBe("young"); // exactly 12 months
      expect(computeAgeCategory("2024-08-01", "2026-08-01")).toBe("young"); // 24 months (2 years)
      expect(computeAgeCategory("2023-08-02", "2026-08-01")).toBe("young"); // 35 months
    });

    it("classifies 36 to < 96 months (3 - <8 years) as adult", () => {
      expect(computeAgeCategory("2023-08-01", "2026-08-01")).toBe("adult"); // exactly 36 months (3 years)
      expect(computeAgeCategory("2021-08-01", "2026-08-01")).toBe("adult"); // 5 years
      expect(computeAgeCategory("2018-08-02", "2026-08-01")).toBe("adult"); // 95 months
    });

    it("classifies 96+ months (8+ years) as senior", () => {
      expect(computeAgeCategory("2018-08-01", "2026-08-01")).toBe("senior"); // exactly 96 months (8 years)
      expect(computeAgeCategory("2014-08-01", "2026-08-01")).toBe("senior"); // 12 years
    });
  });

  describe("formatAgeString", () => {
    it("formats puppy/kitten ages in months", () => {
      const formatted = formatAgeString("2026-04-01", "2026-08-01");
      expect(formatted.en).toBe("4 months");
      expect(formatted.ms).toBe("4 bulan");
    });

    it("formats 1 month singular properly", () => {
      const formatted = formatAgeString("2026-07-01", "2026-08-01");
      expect(formatted.en).toBe("1 month");
      expect(formatted.ms).toBe("1 bulan");
    });

    it("formats adult/young ages in years", () => {
      const formatted = formatAgeString("2024-08-01", "2026-08-01");
      expect(formatted.en).toBe("2 years");
      expect(formatted.ms).toBe("2 tahun");
    });

    it("formats 1 year singular properly", () => {
      const formatted = formatAgeString("2025-08-01", "2026-08-01");
      expect(formatted.en).toBe("1 year");
      expect(formatted.ms).toBe("1 tahun");
    });
  });

  /**
   * PS-114. The band edges used to be prose typed into the gallery and the admin form, and they
   * had drifted from the maths: "Senior (7+ yrs)" against a 96-month boundary, with 3 and 7 each
   * claimed by two adjacent filter options. These two tests are the guard — they fail if a label
   * and `computeAgeCategory` ever disagree again.
   */
  describe("age band labels agree with the maths", () => {
    /** Does the advertised range string claim this whole-year age? Unit-agnostic (yrs / thn). */
    function claims(range: string, years: number): boolean {
      const r = range.replace(/\s*(yrs?|thn)\s*$/, "").trim();
      let m = r.match(/^<\s*(\d+)$/);
      if (m) return years < Number(m[1]);
      m = r.match(/^(\d+)\+$/);
      if (m) return years >= Number(m[1]);
      m = r.match(/^(\d+)\s*[–-]\s*(\d+)$/);
      if (m) return years >= Number(m[1]) && years <= Number(m[2]);
      m = r.match(/^(\d+)$/);
      if (m) return years === Number(m[1]);
      throw new Error(`unparsable band range: "${range}"`);
    }

    it.each(["en", "ms"] as const)("claims every whole-year age exactly once (%s)", (locale) => {
      for (let years = 0; years <= 30; years++) {
        const hits = AGE_BANDS.filter((band) => claims(formatAgeBandRange(band, locale), years));
        expect(hits, `age ${years}y is claimed by ${hits.length} bands: [${hits.join(", ")}]`).toHaveLength(1);
      }
    });

    it("advertises the band that computeAgeCategory actually assigns", () => {
      for (let years = 0; years <= 30; years++) {
        const advertised = AGE_BANDS.find((band) => claims(formatAgeBandRange(band), years));
        expect(computeAgeCategory(`${2026 - years}-06-15`, "2026-06-15"), `at ${years}y`).toBe(advertised);
      }
    });
  });

  describe("withDerivedAge", () => {
    it("recomputes an age string that has gone stale against the calendar", () => {
      const stale = {
        birthDate: "2026-03-22",
        intakeDate: "2026-03-22",
        age: "4 months",
        ageCategory: "puppy_kitten",
      };
      const fresh = withDerivedAge(stale, "2026-08-30");
      expect(fresh.age).toBe("5 months");
      expect(fresh.ageCategory).toBe("puppy_kitten");
    });

    it("re-files a pet whose stored category no longer matches its birth date", () => {
      const stale = { birthDate: "2018-06-15", intakeDate: "2019-01-01", age: "5 years", ageCategory: "adult" };
      expect(withDerivedAge(stale, "2026-08-30").ageCategory).toBe("senior");
    });

    it("falls back to a birth date approximated from a legacy age string", () => {
      const legacy = { intakeDate: "2026-06-12", age: "2 years" };
      expect(withDerivedAge(legacy, "2026-06-12").birthDate).toBe("2024-06-12");
    });
  });

  describe("approximateBirthDate", () => {
    it("calculates approximate birth date from years", () => {
      const { birthDate, isEstimate } = approximateBirthDate("2 years", "2026-06-12");
      expect(birthDate).toBe("2024-06-12");
      expect(isEstimate).toBe(true);
    });

    it("calculates approximate birth date from months", () => {
      const { birthDate, isEstimate } = approximateBirthDate("4 months", "2026-07-22");
      expect(birthDate).toBe("2026-03-22");
      expect(isEstimate).toBe(true);
    });
  });
});
