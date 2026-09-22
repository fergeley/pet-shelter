# approximateBirthDate reads "minggu" as months, so three weeks becomes three months

**Status:** open · opened 2026-09-22 · found by the session on
`fix/pets-birth-date-production-migration`, reproduced here

`approximateBirthDate` (`src/lib/domain/petAge.ts:150`) parses an age string with two unanchored
patterns, years first and months second:

    const monthMatch = norm.match(/(\d+)\s*m/);

`\s*m` matches the first `m` after the digits, wherever the token goes on. *Minggu* is Malay for
**week**, so `"3 minggu"` matches as three *months*:

    approximateBirthDate("3 minggu", "2026-06-12").birthDate === "2026-03-12"

The animal is three weeks old; the function places its birthday twelve weeks back. The same shape
catches any token beginning with `m` — `"6 mggu"`, and in principle `"2 masa"` — and the years
branch has the equivalent exposure for tokens starting `y`.

## Why this is filed rather than fixed

The regex is, as of 2026-09-22, the agreed referent for three separate implementations of the same
subtraction: this function, the expand migration
(`prisma/migrations/manual/20260922_pets_birth_date/`), and the pet form. Two sessions spent an
afternoon getting them to agree, and the expand migration's rehearsal asserts its SQL against this
function row for row. Anchoring the pattern moves that referent, so it should be a deliberate
change with its own verification, not a ride-along on a migration branch.

## What limits the blast radius today

The expand migration **refuses** a Malay age token outright rather than reading it — that session
changed it to do so on 2026-09-22 — and names the offending rows in its pre-check. So no
production row can be backfilled from `"3 minggu"`: the migration stops and asks a human first.

The exposure that remains is the fixture path. `deriveBirthDate` calls this function only when a
record has no `birthDate`, which after the conversion means `src/data/pets.json` and the in-memory
fallback store. Those fixtures are English and currently contain no such token, so the bug is
latent rather than live. It becomes live the moment anyone adds a Malay age string to a fixture, or
if the function is ever pointed at operator-typed prose again.

## Settles when

The token patterns are anchored — `\M` or an explicit alternation of the units the app means to
accept — with a test that pins `"3 minggu"` as *unparseable* (falling through to the intake date)
rather than as three months, and the expand migration's transcription check is re-run against the
changed function. Or: someone decides the app should read Malay age prose properly, in which case
this is the first of several tokens to handle and `tasks/open/ages-render-in-english-on-malay-site.md`
is its neighbour.
