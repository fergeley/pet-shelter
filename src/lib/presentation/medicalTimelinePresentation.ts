import { MedicalTimelineCategory } from "@/types/pet";

/**
 * Timeline category → design tone class from `globals.css`.
 *
 * Kept parallel to `@/lib/presentation/petStatusPresentation` and
 * `@/lib/presentation/applicationStatusPresentation`: a pure map from a domain
 * value onto design-system classes, with no knowledge of how the timeline was
 * assembled. The assembly lives in `@/lib/domain/medicalTimeline` and does not
 * import this.
 *
 * Surgery reads as `danger` and shares red with a rejected application: the two used
 * different-but-adjacent hues (rose vs red) purely by accident, and one tone per meaning
 * is what keeps the legend learnable. `clearance` is a vaccination that outranks it, so
 * it takes the same tone with the emphasised surface rather than an eighth colour.
 */
const CATEGORY_TONE: Record<MedicalTimelineCategory, string> = {
  intake: "tone-info",
  diagnostic: "tone-highlight",
  treatment: "tone-warning",
  vaccination: "tone-success",
  surgery: "tone-danger",
  clearance: "tone-success",
};

/** The tone class alone, for icons and rules that need the colour without the panel. */
export function getCategoryToneClass(category: MedicalTimelineCategory): string {
  return CATEGORY_TONE[category] ?? "tone-neutral";
}

/**
 * Colour classes only — `tone-soft` sets the tinted surface, border and text and nothing
 * else, because the call site owns the badge's padding, radius and type scale.
 */
export function getCategoryBadgeClasses(category: MedicalTimelineCategory): string {
  const tone = getCategoryToneClass(category);
  return category === "clearance"
    ? `tone-soft tone-panel-strong ${tone}`
    : `tone-soft ${tone}`;
}
