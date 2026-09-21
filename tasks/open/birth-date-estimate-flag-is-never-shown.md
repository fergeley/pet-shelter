# An estimated birthday is recorded but never shown as one

**Status:** open · opened 2026-09-22 · from PS-114

PR #42 gives the admin pet form a real calendar `birthDate` and an "Estimated birthday"
checkbox, and `birthDateIsEstimate` now round-trips correctly: the dialog writes it, the server
action and `petMappers` persist it, and `withDerivedAge` guarantees it is `true` whenever the
birthday was approximated rather than entered.

Nothing reads it back. `grep -rn birthDateIsEstimate src` returns only the type, the form, the
two mappers, the store, the validator and the seed JSON — no page, card or profile component
consults it. Every pet's age therefore renders identically whether the shelter knows the animal
was born on 14 May 2023 or merely guessed "about two years old" at intake.

So the flag is, today, write-only metadata. The operator who ticks the box sees no effect
anywhere on the public site, which is a reasonable thing for them to read as the control being
broken.

Fixing it is not just a conditional string. The public surface is bilingual, so "about 2 years"
needs a Malay form alongside the English one in `src/lib/i18n/translations.ts`, and the age
string is produced by `formatAgeString`, which returns `{ en, ms }` and has no notion of
approximation. Whether the marker is a word ("about", "kira-kira"), a tilde, or a tooltip is a
copy decision, not a mechanical one.

Deliberately left out of PR #42, which claims only that the birthday can be *entered*.

**Settles when:** the public age display distinguishes an exact birthday from an estimated one
in both languages, or a maintainer decides the distinction is not worth showing to adopters and
the checkbox is removed from the admin form rather than left inert.
