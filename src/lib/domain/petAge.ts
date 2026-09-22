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
  birthDateIsEstimate?: boolean;
  intakeDate: string;
  age?: string;
  ageCategory?: string;
}>(pet: T, asOf: Date | string = new Date()): T & {
  birthDate: string;
  birthDateIsEstimate: boolean;
  age: string;
  ageCategory: AgeCategory;
} {
  const birthDate = deriveBirthDate(pet);
  // A birthday nobody entered is always an estimate: with no `birthDate` the value below is
  // approximated from the age text or falls back to intake, and neither is an exact birthday.
  const birthDateIsEstimate = pet.birthDate ? (pet.birthDateIsEstimate ?? true) : true;

  return {
    ...pet,
    birthDate,
    birthDateIsEstimate,
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
 * The age units this module understands, English and Malay. Module constants rather than
 * literals inside `approximateBirthDate`, because `hasAgeUnit` has to answer for exactly the
 * same token set — a second copy in the admin dialog would drift the first time one grows.
 * Both are applied to an already-lowercased string, so neither needs the `i` flag.
 */
const AGE_YEARS_PATTERN = /(\d+)\s*(?:y|yr|year|thn|tahun)/;
const AGE_MONTHS_PATTERN = /(\d+)\s*(?:m|mo|month|bln|bulan)/;

/**
 * Whether an age string names a unit `approximateBirthDate` can actually reckon from. Callers
 * use it to avoid deriving a birthday from a bare "2", which is a half-typed "2 years" far more
 * often than it is an answer.
 */
export function hasAgeUnit(ageStr: string): boolean {
  const norm = ageStr.toLowerCase().trim();
  return AGE_YEARS_PATTERN.test(norm) || AGE_MONTHS_PATTERN.test(norm);
}

/**
 * Builds a UTC day, clamping the day of month to the target month's last day instead of letting
 * `Date.UTC` roll it forward. Without this, subtracting one month from the 31st lands in the
 * month *after* the one asked for — 2026-03-31 less a month gave 2026-03-03, a 28-day "month" —
 * and a year off 2024-02-29 gave 2023-03-01. A month of error moves an animal across an
 * `AGE_BAND_MIN_MONTHS` boundary, so the band shown to adopters changes.
 */
function utcDayClamped(year: number, month: number, day: number): Date {
  const lastDayOfMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month, Math.min(day, lastDayOfMonth)));
}

/**
 * Approximates a birth date from an age string (e.g. "2 years", "4 months", "2 tahun") relative
 * to the given reference day. Timezone-invariant UTC arithmetic, clamped at month ends.
 *
 * The reference is the caller's to choose and the two callers differ on purpose: the admin
 * dialog passes *today*, because the age an operator types is the animal's age now, while
 * `deriveBirthDate` passes the intake date, because a legacy row's `age` string was whatever was
 * written down when the animal arrived.
 */
export function approximateBirthDate(
  ageStr: string,
  intakeDateStr: string
): { birthDate: string; isEstimate: boolean } {
  const norm = ageStr.toLowerCase().trim();
  const parts = parseDateParts(intakeDateStr);
  if (!parts) {
    return { birthDate: new Date().toISOString().split("T")[0], isEstimate: true };
  }

  const yearMatch = norm.match(AGE_YEARS_PATTERN);
  if (yearMatch) {
    const years = parseInt(yearMatch[1], 10);
    const d = utcDayClamped(parts.year - years, parts.month, parts.day);
    return { birthDate: d.toISOString().split("T")[0], isEstimate: true };
  }

  const monthMatch = norm.match(AGE_MONTHS_PATTERN);
  if (monthMatch) {
    const months = parseInt(monthMatch[1], 10);
    const d = utcDayClamped(parts.year, parts.month - months, parts.day);
    return { birthDate: d.toISOString().split("T")[0], isEstimate: true };
  }

  const dateOnly = intakeDateStr.split("T")[0];
  return { birthDate: dateOnly, isEstimate: true };
}
