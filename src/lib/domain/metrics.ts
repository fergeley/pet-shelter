import type { ImpactStatRecord } from "@/lib/domain/transparency";

/**
 * The five "Our Impact So Far" counters on the home page.
 *
 * These are deliberately NOT database aggregates, and that distinction is the
 * whole reason this module exists. `docs/tasks/SPRINT_PLAN_BACKEND_AND_FRONTEND.md`
 * (FE-02) specifies them as organisation-lifetime figures — "520+ neutered
 * through TNRM", "25+ collaborations". Nothing in `prisma/schema.prisma` can
 * produce those numbers:
 *
 *   - **Neutered.** TNRM animals are returned to their colony, so they never
 *     become `Pet` rows at all. The one nearby column, `Pet.spayedNeutered`,
 *     is `@default(true)` — counting it counts every row nobody has set.
 *   - **Rehabilitated.** `PetStatus.In_Rehabilitation` is a *current* state, and
 *     there is no status-transition history to count completions from.
 *   - **Volunteers.** `User` is staff-only; volunteers are handled off-platform
 *     through `ShelterSettings.volunteerFormUrl`.
 *   - **Collaborations.** There is no partner or corporate model in the schema.
 *
 * Deriving these from the pet table would publish a much smaller, wrong number
 * about a real charity on its own front page. So the curated figure stays the
 * source of truth, and the database's job is only to let staff *correct* it
 * without a deploy — which the existing `ImpactStat` table and its admin editor
 * (`src/components/admin/TransparencyEditor.tsx`) already do, bilingually.
 * Reusing that table is why this module adds no Prisma query of its own.
 */

/**
 * Named rather than imported as a component, so this module stays free of React
 * and runs in the node test tier. `Hero` maps these to lucide icons.
 */
export type HomeMetricIcon =
  | "neutered"
  | "rehabilitated"
  | "adopted"
  | "volunteers"
  | "collaborations";

export interface HomeMetric {
  /** Matches `ImpactStat.key`, so staff can override the figure from the admin editor. */
  key: string;
  icon: HomeMetricIcon;
  value: string;
  labelEn: string;
  labelMs: string;
  /** True when the figure came from an `ImpactStat` row rather than the baseline below. */
  isLive: boolean;
}

/**
 * The FE-02 figures, and the answer whenever the database has nothing to say.
 *
 * Keys are prefixed `home_` so a home figure is never confused with a
 * donation-ledger one in the table both share. The prefix is not a sort
 * convention: the ledger reads subtract these keys outright
 * (`src/lib/server/transparencyRepository.ts`), so a home row's `displayOrder`
 * is free to be anything — including the 0 the admin editor defaults to.
 * Rationale: `tasks/decisions/2026-09-08-home-metrics-reuse-the-impact-stat-table.md`.
 */
export const HOME_METRIC_BASELINE: readonly HomeMetric[] = [
  {
    key: "home_animals_neutered",
    icon: "neutered",
    value: "520+",
    labelEn: "Neutered via TNRM",
    labelMs: "Dimandulkan (TNRM)",
    isLive: false,
  },
  {
    key: "home_animals_rehabilitated",
    icon: "rehabilitated",
    value: "380+",
    labelEn: "Animals Rehabilitated",
    labelMs: "Haiwan Dipulihkan",
    isLive: false,
  },
  {
    key: "home_animals_adopted",
    icon: "adopted",
    value: "290+",
    labelEn: "Adopted into Homes",
    labelMs: "Berjaya Diadopsi",
    isLive: false,
  },
  {
    key: "home_active_volunteers",
    icon: "volunteers",
    value: "150+",
    labelEn: "Active Volunteers",
    labelMs: "Sukarelawan Aktif",
    isLive: false,
  },
  {
    key: "home_collaborations",
    icon: "collaborations",
    value: "25+",
    labelEn: "Partnerships & Vets",
    labelMs: "Rakan Kolaborasi & Vet",
    isLive: false,
  },
] as const;

/**
 * The keys this module owns inside the shared `ImpactStat` table.
 *
 * The ledger surfaces (/donate, /transparency) must subtract these from what
 * they render, or the first home counter staff create takes over a ledger slot:
 * `TransparencyEditor` defaults a new counter to `displayOrder: 0`, the seeded
 * ledger rows are 1/2/3, and `AllocationSummary` shows `slice(0, 3)`. Owning
 * the namespace in one exported set is what keeps that subtraction honest.
 */
export const HOME_METRIC_KEYS: ReadonlySet<string> = new Set(
  HOME_METRIC_BASELINE.map((metric) => metric.key)
);

/** True for a row that belongs to the home page rather than the donation ledger. */
export function isHomeMetricKey(key: string): boolean {
  return HOME_METRIC_KEYS.has(key);
}

/** A blank or whitespace-only override is a staff typo, not an instruction to publish nothing. */
function usable(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Overlays published `ImpactStat` rows onto the baseline, matched by key.
 *
 * Always returns all five slots in baseline order. A row that is missing,
 * unpublished, blank, or belongs to another surface leaves its slot at the
 * curated figure rather than dropping a counter out of the grid — the home page
 * must never render four cards because one database row went away. Rows whose
 * key is not a home key are ignored outright, so the donation-ledger stats that
 * share this table cannot leak onto the home page.
 */
export function selectHomeMetrics(
  stats: readonly ImpactStatRecord[] | null | undefined
): HomeMetric[] {
  const overrides = new Map<string, ImpactStatRecord>();
  for (const stat of stats ?? []) {
    if (!stat?.isPublished) continue;
    if (!usable(stat.metricValue)) continue;
    overrides.set(stat.key, stat);
  }

  return HOME_METRIC_BASELINE.map((baseline) => {
    const override = overrides.get(baseline.key);
    if (!override) return { ...baseline };

    return {
      ...baseline,
      value: usable(override.metricValue) ?? baseline.value,
      labelEn: usable(override.label) ?? baseline.labelEn,
      labelMs: usable(override.labelMs) ?? baseline.labelMs,
      isLive: true,
    };
  });
}

/** Reads the label for the active language, so callers stop repeating the ternary. */
export function metricLabel(metric: HomeMetric, isMs: boolean): string {
  return isMs ? metric.labelMs : metric.labelEn;
}

/** A figure split into the parts a counter animation needs. */
export interface SplitFigure {
  /** Anything before the digits — "RM " in "RM 1,200". */
  lead: string;
  num: number;
  /** Anything after the digits — "+" in "520+", "%" in "100%". */
  trail: string;
  /** True when the original grouped its thousands, so the climb should too. */
  grouped: boolean;
}

/**
 * Splits "520+" into `{ lead: "", num: 520, trail: "+" }`.
 *
 * Lives here rather than in the Hero so it can be tested as a function instead
 * of as an animation frame — the timing-dependent version of this test could
 * only ever sample one frame and call it proof.
 *
 * `metricValue` is free-form, so this must survive everything staff can type.
 * Returns null when there are no digits to count ("Ongoing"), which the caller
 * reads as "render verbatim, do not animate".
 */
export function splitFigure(value: string): SplitFigure | null {
  // `[\d,]*\d` keeps a thousands separator inside the number rather than
  // leaving it in the trailing text, which is what made "1,250" climb 0..1
  // with a stray ",250" pinned beside it.
  const match = /^(\D*?)([\d,]*\d)(.*)$/.exec(value);
  if (!match) return null;

  const digits = match[2].replace(/,/g, "");
  const num = Number(digits);
  if (!Number.isFinite(num)) return null;

  return {
    lead: match[1],
    num,
    trail: match[3],
    grouped: match[2].includes(","),
  };
}

/** Renders an intermediate frame of the climb in the original's format. */
export function formatFigureFrame(parsed: SplitFigure, current: number): string {
  const shown = parsed.grouped ? current.toLocaleString("en-US") : String(current);
  return `${parsed.lead}${shown}${parsed.trail}`;
}
