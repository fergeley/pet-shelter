import { AgeCategory } from "@/types/pet";

/**
 * Domain calculations for pet age and lifecycle category (L-B3).
 *
 * Age is calculated dynamically relative to the current date (or a specified reference date),
 * ensuring that adoption matching and category filters do not rot as animals age in the shelter.
 */

function parseDateParts(dateOrStr: Date | string): { year: number; month: number; day: number } | null {
  if (typeof dateOrStr === "string") {
    const dateOnly = dateOrStr.split("T")[0];
    const parts = dateOnly.split("-").map(Number);
    if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
      return { year: parts[0], month: parts[1] - 1, day: parts[2] };
    }
  }
  const d = typeof dateOrStr === "string" ? new Date(dateOrStr) : dateOrStr;
  if (isNaN(d.getTime())) return null;
  return { year: d.getFullYear(), month: d.getMonth(), day: d.getDate() };
}

/**
 * Computes exact difference in full months between a birth date and a target date.
 * Timezone-invariant for standard YYYY-MM-DD date strings.
 */
export function computeAgeInMonths(birthDateStr: string, asOf: Date | string = new Date()): number {
  const birth = parseDateParts(birthDateStr);
  const target = parseDateParts(asOf);
  if (!birth || !target) return 0;

  let months = (target.year - birth.year) * 12 + (target.month - birth.month);
  if (target.day < birth.day) {
    months -= 1;
  }
  return Math.max(0, months);
}

/**
 * Derives the standardized AgeCategory based on age in months:
 * - < 12 months: puppy_kitten
 * - 12 to < 36 months (1 - <3 years): young
 * - 36 to < 96 months (3 - <8 years): adult
 * - 96+ months (8+ years): senior
 */
export function computeAgeCategory(birthDateStr: string, asOf: Date | string = new Date()): AgeCategory {
  const months = computeAgeInMonths(birthDateStr, asOf);
  if (months < 12) return "puppy_kitten";
  if (months < 36) return "young";
  if (months < 96) return "adult";
  return "senior";
}

/**
 * Formats a human-readable age string in English and Malay.
 */
export function formatAgeString(
  birthDateStr: string,
  asOf: Date | string = new Date()
): { en: string; ms: string } {
  const months = computeAgeInMonths(birthDateStr, asOf);
  if (months < 12) {
    const m = Math.max(1, months);
    const en = `${m} ${m === 1 ? "month" : "months"}`;
    const ms = `${m} bulan`;
    return { en, ms };
  }

  const years = Math.floor(months / 12);
  const en = `${years} ${years === 1 ? "year" : "years"}`;
  const ms = `${years} tahun`;
  return { en, ms };
}

/**
 * Approximates a birth date from a legacy age string (e.g. "2 years", "4 months")
 * relative to an intake date.
 */
export function approximateBirthDate(ageStr: string, intakeDateStr: string): { birthDate: string; isEstimate: boolean } {
  const norm = ageStr.toLowerCase().trim();
  const intake = new Date(intakeDateStr);
  if (isNaN(intake.getTime())) {
    return { birthDate: new Date().toISOString().split("T")[0], isEstimate: true };
  }

  const yearMatch = norm.match(/(\d+)\s*y/);
  if (yearMatch) {
    const years = parseInt(yearMatch[1], 10);
    const d = new Date(intake);
    d.setFullYear(d.getFullYear() - years);
    return { birthDate: d.toISOString().split("T")[0], isEstimate: true };
  }

  const monthMatch = norm.match(/(\d+)\s*m/);
  if (monthMatch) {
    const months = parseInt(monthMatch[1], 10);
    const d = new Date(intake);
    d.setMonth(d.getMonth() - months);
    return { birthDate: d.toISOString().split("T")[0], isEstimate: true };
  }

  return { birthDate: intakeDateStr, isEstimate: true };
}
