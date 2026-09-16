/**
 * The `t()` arguments for a pet's sex — spread them: `t(...genderLabelArgs(pet.gender))`.
 *
 * **Total over any string**, deliberately, not just over `Gender`. The column is free text
 * (`gender String` in the schema, only cast by the mapper), so the type promises more than the
 * data does. An earlier version was a `Record<Gender, string>` lookup: a row stored as `"male"`
 * produced an `undefined` key, `t()` called `.split` on it, and the whole catalogue crashed for one
 * mistyped row.
 *
 * Anything that is not exactly `"Male"` labels as female. That is not a claim that it is right for
 * such a row — a stored `"male"` or `" Male"` is shown as Female — it is what every card, dialog
 * and carousel in this app rendered before this helper existed, kept so those four agree with one
 * another. **Not every surface uses it:** the profile's metadata description prints
 * `pet.gender.toLowerCase()` and the match quiz prints `pet.gender` raw, so for a non-canonical
 * row they can still disagree with the card. The form schema only ever writes the two canonical
 * values; the open question of legacy rows is
 * `tasks/open/pet-gender-column-accepts-values-the-labels-cannot-show.md`.
 *
 * Lives in `presentation` because it builds display arguments, not validation data. That is the
 * whole reason. It does not keep zod out of the components that import it — they reach the
 * validation module through other imports anyway — and an earlier version of this comment
 * claimed it did.
 */
export function genderLabelArgs(gender: string): [key: string, fallback: string] {
  return gender === "Male" ? ["common.male", "Male"] : ["common.female", "Female"];
}
