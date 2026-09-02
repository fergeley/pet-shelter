# Lessons

Patterns worth not repeating. Append the rule, not the anecdote.

## Making a field persist can turn a harmless bug destructive

**2026-09-02, donation QR feature.** The admin settings form is seeded from
`useSettingsStore`, which is backed by `localStorage`. That was survivable while
`updateShelterSettings` only wrote to a module-level variable — nothing
persisted, so nothing could be lost. The moment the QR fields reached real
columns, the same arrangement became destructive: a second admin, on a browser
that had never uploaded the QR, would open the page with empty QR inputs and
blank the saved codes on their next save.

**Rule:** when you make an existing form field actually persist, audit every
path that *seeds* that form. A field that was previously write-only has no
loading path, and the absence is invisible until it deletes something. Check
specifically for `undefined` reaching a `.optional().default("")` validator —
that silently becomes "clear this column".

Guard added: `tests/unit/shelterSettingsHydration.test.ts` asserts the local
default object declares every key in `PERSISTED_SETTING_KEYS`.

## Adding a Prisma column breaks every read of that table until it is applied

Prisma selects all declared columns by default, so the generated client and the
live table must agree. Between merging schema changes and running the migration,
`prisma.pet.findMany()` throws `The column pets.customQrUrl does not exist` —
and this repo's stores catch that and fall back to an in-memory seed array. The
site keeps rendering, silently serving eight seed pets instead of real data, and
writes appear to succeed while persisting nothing.

**Rule:** apply additive migrations *before* merging the code that declares the
columns, never after. Additive nullable columns are invisible to the old code,
so migrate-first has no downside and closes the window entirely. Verify with a
throwaway probe against the real database rather than reasoning about it.

## A `useState` initialiser cannot read data that arrives later

The auto-generate toggle was initialised from `paymentPayload.trim() !== ""`.
That value arrives from a server round-trip after first render, so the
initialiser always saw `""` and the toggle stayed off, hiding a payload that was
live on the public site.

**Rule:** `useState(x)` freezes `x` at mount. For state that should track
asynchronously-loaded data, derive it and keep only the user's explicit override
in state: `const value = manualOverride ?? derivedFromProps`.

## Extracting a duplicate must be pixel-neutral or it is two changes

The placeholder QR SVG existed twice, with slightly different wrappers
(`shadow-xs` vs `shadow-sm`, `mb-2.5` vs `mb-2`). Collapsing them to one
component quietly restyled `/donate`.

**Rule:** when de-duplicating markup, diff the wrappers too and parameterise the
differences, so the refactor changes no pixels. A styling change smuggled inside
a refactor is invisible in review.
