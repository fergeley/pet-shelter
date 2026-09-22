# A SQL transcription of a JS function is only worth its diff against the original

**Learned:** 2026-09-22

The `pets.age` → `birthDate` backfill had to reproduce `approximateBirthDate`
(`src/lib/domain/petAge.ts:150`) in SQL, because the application had been converting legacy rows
with that function all along and a second interpretation of "2 years" would have been a silent
fork. Reading the function and writing the equivalent SQL got two things wrong that reading it
again would never have caught:

- **Interval arithmetic is not `setFullYear`.** `2024-02-29 - interval '1 year'` is 2023-02-28 in
  Postgres. JavaScript rolls the overflow *forward* to 2023-03-01. Same for `setMonth`: 2026-03-31
  minus a month is 2026-03-03, not 2026-02-28. Building the date as
  `make_date(y, m, 1) + (day - 1)` reproduces the JS rule; `- interval` does not.
- **`CURRENT_DATE` is not `new Date().toISOString()`.** The JS fallback for an unparseable intake
  date formats in UTC. `CURRENT_DATE` is the session's local day, which in Malaysia (UTC+8) is a
  day ahead for eight hours out of twenty-four.

Both were found by a rehearsal that did not check "the SQL looks right" but asserted, per row,
`sql_result === approximateBirthDate(age, intakeDate).birthDate` over the ten fixture animals plus
ten rows chosen to hit the edges — a leap-day intake, two month-end intakes, `"2 years 3 months"`,
prose with no figure, an unparseable intake. The interval bug would have shifted one animal's
birthday by a day; the timezone bug did, and showed up as a single-row mismatch in an otherwise
green run.

Note there was no need for Docker or a PostgreSQL install: `@electric-sql/pglite` is a real
PostgreSQL compiled to WASM, installed into the job's temp directory rather than the repo, and it
ran DO blocks, advisory locks, `make_date` and enum types without complaint.

**Rule:** when SQL has to reproduce an application function, do not review the SQL against the
function — execute both over the same inputs and assert equality, and choose the inputs to hit the
boundaries where the two languages' date, rounding and null rules are known to disagree. Import
the real function; a reimplementation in the test asserts the transcription against itself.
