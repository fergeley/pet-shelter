# Ages render in English on the Malay site

**Status:** open · opened 2026-08-30 · from PS-114

`formatAgeString` returns `{ en, ms }` and every caller takes `.en`. `Pet.age` is a single
`string`, so `"2 tahun"` has nowhere to live. A Malay visitor sees "Jantan • 2 years".

**Not fixed** — making `Pet.age` bilingual is a type-contract change across modules, which is its
own GRAVE task, not a ride-along.

**Settles when:** `age` becomes locale-resolved at render, or the mixed-language display is
accepted as intended.
