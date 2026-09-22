import { BulletinCategory, BulletinTargetPage } from "@/types/bulletin";

export interface BulletinCategoryPresentation {
  label: string;
  /**
   * The design-system tone class (`tone-danger`, `tone-success`, …) declared in
   * `globals.css`. On its own it only remaps the local `--tone-*` group, so it
   * composes with any tone-aware shell — `tone-chip` here — without this module
   * having to know which one the call site picked. Same contract as
   * `petStatusPresentation`.
   */
  toneClass: string;
}

/**
 * Bulletin category → label and design tone.
 *
 * Lifted out of `BulletinFeed` when bulletins gained an admin editor: the
 * public feed and the admin table must badge a notice identically, and two
 * copies of this table would drift the moment a category was added. It is also
 * the `Record<BulletinCategory, …>` half of the vocabulary consistency check in
 * `@/lib/server/bulletinRepository` — the compiler fails this file if the union
 * grows a member, which is the point.
 *
 * `happy_tail` takes `highlight` rather than `success` because `clinic` already
 * owns green, and two categories sharing a colour makes the badge legend
 * unreadable. That reasoning arrived with the original mapping and is kept.
 */
export const BULLETIN_CATEGORY_PRESENTATION: Record<
  BulletinCategory,
  BulletinCategoryPresentation
> = {
  urgent_need: { label: "Urgent Foster / Need", toneClass: "tone-danger" },
  clinic: { label: "Clinic / Vaccine", toneClass: "tone-success" },
  event: { label: "Event", toneClass: "tone-info" },
  happy_tail: { label: "Adoption Update", toneClass: "tone-highlight" },
  announcement: { label: "Notice", toneClass: "tone-neutral" },
};

/**
 * Falls back to `announcement` for a value the union does not carry.
 *
 * Reachable in one direction only: a row written by the hand-run migration or a
 * future enum member that the database accepts and this build does not know.
 * The database rejects anything outside the enum, so this cannot be reached
 * from the form.
 */
export function presentBulletinCategory(
  category: BulletinCategory
): BulletinCategoryPresentation {
  return BULLETIN_CATEGORY_PRESENTATION[category] ?? BULLETIN_CATEGORY_PRESENTATION.announcement;
}

/** Where a notice appears, for the admin editor's select and its table column. */
export const BULLETIN_TARGET_PAGE_LABELS: Record<BulletinTargetPage, string> = {
  all: "Every feed",
  home: "Home page",
  pets: "Adoption directory",
  bulletins: "Bulletins page",
};
