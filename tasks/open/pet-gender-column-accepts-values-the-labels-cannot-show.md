# The pet `gender` column accepts values no surface labels correctly

**Status:** open · opened 2026-09-16 · from the fourth and fifth reviews of PR #38

`prisma/schema.prisma` declares `gender String // Male, Female`, and `petMappers.ts` only casts it
(`p.gender as Pet["gender"]`). The form schema writes exactly `"Male"` or `"Female"`, so the app
never produces anything else — but nothing stops a manual SQL edit, a seed script or a legacy row
from holding `"male"`, `" Male"`, `"Unknown"` or `""`.

What each surface does with such a row, as of PR #38:

- **Card, detail dialog, detail page, donation carousel** — `genderLabelArgs` in
  `src/lib/presentation/petLabels.ts`: anything not exactly `"Male"` labels as **Female**. PR #38
  made this total after a `Record<Gender, string>` lookup crashed the whole catalogue on one such
  row; it deliberately kept the old ternary's output so the four agree. For `"male"` that output is
  wrong.
- **Profile metadata** — `src/app/pets/[id]/page.tsx` prints `pet.gender.toLowerCase()`, so the
  meta and OG description say "a male …" while the page beside it says Female.
- **Match quiz** — `PetMatchQuiz.tsx` prints `pet.gender` raw, untranslated in Malay mode.
- **Gallery gender filter** — exact comparison, so a `"male"` row appears under neither Male nor
  Female.

Two ways to settle it, not exclusive:

1. Normalise at the boundary — trim and case-fold in the mapper, or constrain the column to an
   enum — so every surface can keep trusting `Gender`.
2. Make `genderLabelArgs` case- and whitespace-insensitive and route the metadata and quiz through
   it, with an explicit label for a value that is neither.

**Settles when:** a row stored as `"male"` renders as male on every surface above and appears under
the Male filter — or the column is constrained so such a row cannot exist, with a check of
production data showing none does.
