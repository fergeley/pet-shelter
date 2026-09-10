# ISO date-only parsing in JavaScript requires timezone-invariant extraction

**Learned:** 2026-08-28

`new Date("YYYY-MM-DD")` is parsed by ECMAScript engines as UTC midnight (`00:00:00Z`). In timezones located west of UTC (negative offsets like UTC-1 to UTC-12), calling `.getDate()` or `.getMonth()` rolls the date backward by 1 day to the previous evening, causing silent 1-month or 1-day threshold calculation bugs on exact boundaries.

**Rule:** never pass date-only strings (`YYYY-MM-DD`) directly to `new Date()` for calendar math. Extract the year, month, and day integers directly from string parts (`parseDateParts`) before doing month/year difference math to ensure 100% deterministic results across all server and client locales.
