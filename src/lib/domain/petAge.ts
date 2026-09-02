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
 * Lifecycle bands, as the inclusive lower bound of each in whole months.
 *
 * **This table is the only definition of a band boundary.** `computeAgeCategory` reads it, and
 * so does every user-facing band label via `formatAgeBandRange` — so a boundary cannot be moved
 * in the maths and left stale in the copy that describes it to a user. It previously could:
 * the gallery advertised "Senior (7+ yrs)" against a 96-month senior boundary, and both 3 and 7
 * were claimed by two adjacent filter options at once (PS-114).
 */
export const AGE_BAND_MIN_MONTHS = {
  puppy_kitten: 0,
  young: 12,
  adult: 36,
  senior: 96,
} as const satisfies Record<AgeCategory, number>;

/** Bands in ascending age order. */
export const AGE_BANDS = ["puppy_kitten", "young", "adult", "senior"] as const;

/**
 * Derives the standardized AgeCategory from `AGE_BAND_MIN_MONTHS` — the highest band whose
 * lower bound the pet has reached.
 */
export function computeAgeCategory(birthDateStr: string, asOf: Date | string = new Date()): AgeCategory {
  const months = computeAgeInMonths(birthDateStr, asOf);
  let band: AgeCategory = AGE_BANDS[0];
  for (const candidate of AGE_BANDS) {
    if (months >= AGE_BAND_MIN_MONTHS[candidate]) band = candidate;
  }
  return band;
}

/**
 * Renders the whole-year range a band covers, e.g. `3 – 7 yrs`, derived from
 * `AGE_BAND_MIN_MONTHS`. Ranges are half-open in months and therefore never overlap: the upper
 * edge is the last whole year still inside the band, not the next band's first year.
 */
export function formatAgeBandRange(band: AgeCategory, locale: "en" | "ms" = "en"): string {
  const unit = locale === "ms" ? "thn" : "yrs";
  const index = AGE_BANDS.indexOf(band);
  const minYears = AGE_BAND_MIN_MONTHS[band] / 12;
  const next = AGE_BANDS[index + 1];

  if (next === undefined) return `${minYears}+ ${unit}`;
  if (minYears === 0) return locale === "ms" ? "< 1 thn" : "< 1 yr";

  const maxYears = AGE_BAND_MIN_MONTHS[next] / 12 - 1;
  return minYears === maxYears ? `${minYears} ${unit}` : `${minYears} – ${maxYears} ${unit}`;
}

/**
 * Returns the pet with `birthDate`, `age` and `ageCategory` recomputed from the calendar.
 *
 * Applied wherever a stored pet record enters the app, so that a hand-written `age` string in a
 * fixture cannot outlive its accuracy. Before PS-114 the fallback store served `pets.json`
 * verbatim and one pet already read "4 months" at five months old.
 */
export function withDerivedAge<T extends {
  birthDate?: string;
  intakeDate: string;
  age?: string;
  ageCategory?: string;
}>(pet: T, asOf: Date | string = new Date()): T & {
  birthDate: string;
  age: string;
  ageCategory: AgeCategory;
} {
  const birthDate = deriveBirthDate(pet);

  return {
    ...pet,
    birthDate,
    age: formatAgeString(birthDate, asOf).en,
    ageCategory: computeAgeCategory(birthDate, asOf),
  };
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
 * Resolves the birth date to reckon from: the stored one, else one approximated from a legacy
 * age string, else the intake date. Shared by the read mapper, the persistence payload builder
 * and `withDerivedAge`, which previously carried three copies of this expression.
 */
export function deriveBirthDate(pet: { birthDate?: string; age?: string; intakeDate: string }): string {
  return pet.birthDate || (pet.age ? approximateBirthDate(pet.age, pet.intakeDate).birthDate : pet.intakeDate);
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
