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

## A server action is a public POST endpoint

`loadShelterSettings` was added as a read helper for the admin form and
shipped with no session check, returning the whole settings object —
`resendApiKey` included. The same module already redacts that key before it
reaches `audit_logs`, and the write action directly below it called
`assertAuthorized`.

**Rule:** every exported `"use server"` function is an unauthenticated HTTP
endpoint whose id ships in the client bundle. Gate reads, not just writes,
and project the response down to the fields the caller needs instead of
returning an internal object wholesale.

## Reporting success for a write that did not persist

`writeShelterSettings` reports `persisted: false` when Postgres is
unreachable, and the action dropped that flag and returned `success: true`.
The admin saw a green confirmation while donors kept scanning the old QR.

**Rule:** when a write has a memory fallback, the fallback state has to reach
the UI. "Accepted" and "durably stored" are different outcomes and only one
of them justifies a success message.

## Nullish-coalescing to empty string erases "absent" vs "cleared"

`DonationQrPanel` used `props.x ?? config.x`, so an omitted prop falls back to
the shelter config while an explicit empty string shows as cleared.
`QrPreviewDialog` then normalised its own props to empty strings before
passing them down, collapsing the two cases and making the pet preview always
render the placeholder — the one surface built to show admins where the money
goes.

**Rule:** when undefined and empty string carry different meanings, keep every
intermediate component from normalising, and extract the merge into a pure
function so both cases are unit-testable.

## A QR encoder that silently truncates

`qrcode-generator`'s default byte mode is `charCodeAt(i) & 0xff`. A payment
string containing an em dash or an accented merchant name encodes to the wrong
bytes and still produces a perfectly scannable code.

**Rule:** for any encoder, test a non-ASCII input explicitly. "It rendered" is
not evidence of correctness when the failure mode is a valid-looking artifact
carrying wrong data. Cap payload length in encoded bytes, not UTF-16 units.

## Dead policy modules make tests lie

`qrAccess.ts` defined `canEditGlobalQr`/`canEditPetQr`; the settings page
re-implemented the check inline, and nothing imported the module except its
own tests, which asserted the role sets and reported the control as covered.

**Rule:** after extracting a policy, grep for its callers. A security helper
with only test importers is worse than none — it produces green coverage for a
rule nothing enforces.
