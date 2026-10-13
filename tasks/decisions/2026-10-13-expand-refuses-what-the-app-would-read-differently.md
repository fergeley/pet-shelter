# The expand migration refuses a row the app would read differently, instead of claiming it never happens

**Decided:** 2026-10-13

Amends `tasks/decisions/2026-09-22-expand-stores-only-what-the-app-computes.md` and, for its
check list only, `tasks/decisions/2026-09-22-pets-birth-date-backfills-from-intake-date.md`.
Neither is rewritten. This entry records what a fifth review found in
`prisma/migrations/manual/20260922_pets_birth_date/` and the five choices made answering it.

## 1. The invariant's parsing half is enforced, not sampled

The 2026-09-22 entry states the invariant as holding "for every row it writes" and rests it on
check **O2**. O2 compares a fixed corpus. Three strings outside that corpus were stored
differently from what `approximateBirthDate` computes, measured on the throwaway database:

| `age` | this file stored | the app computes |
|---|---|---|
| `2 young pups, 6 months` | intake − 6 months | intake − 2 years |
| `6 months, 2 yo` | intake − 6 months | intake − 2 years |
| `3 males, 2 mo` | intake − 2 months | intake − 3 months |

The cause is the anchoring the same entry kept on purpose. The app's `/(\d+)\s*y/` takes the
first number followed by any word beginning with `y`; this file's tokens are whole words. The
entry reasoned that anchoring could only make the file refuse more. It also makes the file skip
a number the app takes and go on to find another.

Two answers were available: narrow the sentence in the header, or make it true. The file now
reads each `age` a second time with the app's own two patterns and refuses a row where the two
picked different numbers, naming both. That is the rule the earlier entry already set — refusing
more is safe, storing differently is not — applied to a case it had not seen.

The app-side pattern spells out JavaScript's `\s` rather than using `[[:space:]]`, which is
narrower: `3<nbsp>y old, 2 years` is 3 to the app, and the narrower class read it as agreement.
Check **O4** pins all four strings.

**What is still only measured: the date arithmetic.** O2 covers it for a corpus, and for a UTC
process. Master's function subtracts in the server's local time, and under `America/Los_Angeles`
`2026-03-01` minus one month is `2026-01-29` where the SQL stores `2026-02-01`. The header now
says "on a UTC server". Production is Vercel; PR #42 rewrites the function onto `Date.UTC`.

## 2. A Malay age word is refused wherever it sits

The earlier entry says Malay words are refused. They were refused only when nothing else in the
string parsed. `2 tahun 6 months` backfilled as six months, and the pre-check reported it
`ok: months`.

Read on 2026-10-13, PR #42's tip `3c2a691` widens `approximateBirthDate` to
`/(\d+)\s*(?:y|yr|year|thn|tahun)/`. So that row is six months to master's app and two years to
the app about to replace it, and no stored date satisfies both. Any number beside `tahun`, `thn`,
`bulan` or `bln` is now refused under its own verdict, `malay age word`, whose remedy is the
normalisation `UPDATE` the header already prints. Check **O5**.

This also settles the first "What would reverse this" bullet of the earlier entry as a fact
rather than a possibility: the widening exists on that branch. With no Malay token in an accepted
row, PR #42's patterns pick what master's pick, so the rows this file writes are the same under
either version.

## 3. The clamp is not coming from PR #42

The second bullet there warned that PR #42 might change the rollover to a clamp. At `3c2a691` it
keeps the roll-forward and carries a comment naming this migration as the reason not to change
it. The header's warning is rewritten to say what that branch does today. O2 still fails loudly if
the arithmetic moves. It does **not** fail if the vocabulary moves, because it compares against a
transcription pinned by O1 to the English ages in `src/data/pets.json` — choice 2 is what covers
vocabulary.

## 4. Two quantities are not a range

The range guard refused `1 yr 6 mo` and `2 y 3 m` as "fractional" while accepting
`1 year 6 months`, only because ` year ` is six characters and the guard's window is five. The
guard now exempts a first number that carries a unit of its own, so all three backfill as the
year, which is what the app reads.

The exemption is by shape, and one consequence is accepted knowingly: a range that repeats its
unit, `2 y - 3 y`, now takes the first number. `2 years - 3 years` always did, and the app does
the same with both. A narrower exemption (year token first, month token second) was considered
and not taken: it is a third regular expression in a file whose review history is mostly regular
expressions, to protect one spelling of a range while the longer spelling stays accepted anyway.

## 5. Rollback tells "not there" from "not mine"

`rollback.sql` read the `birthDate` marker with `SELECT … INTO mine` and tested `mine IS NOT
TRUE`. With no such column the `SELECT` returns no row, `mine` stays NULL, and a second run
reported `birthDate` "left in place … nothing has been undone" on a table that had none. It now
branches on `FOUND`, for both columns:

| `birthDate` | `birthDateIsEstimate` | rollback |
|---|---|---|
| absent | absent | says there is nothing to drop |
| absent | present, marked | drops it |
| absent | present, unmarked | leaves it, and says what it blocks |
| present, marked | either | drops both |
| present, unmarked | either | leaves both |

The review called the second row a state that makes `migration.sql` refuse the table
"permanently". It was not permanent: the refusal names the stray column and says to drop it. And
this pair cannot produce it, because apply adds both columns or neither and rollback drops both
in one transaction — it takes a hand-run `DROP COLUMN "birthDate"`. It is fixed anyway, because a
marked flag is this pair's own leftover and the misleading notice was real.

The last row's notice also said "Nothing has been undone" while the same run restored the
NOT NULLs `migration.sql` had removed. It now says which columns were kept and that the
constraints are still restored. Checks **Q1–Q5**.

## The check list lives in `rehearse.mjs`

`migration.sql` pointed at the first decision entry for "the full check list". That entry says
eighty-six checks and has no groups M, N or O; the script had ninety-two. The entry is a record of
its date and stays as written. The header now points at `rehearse.mjs`, which prints each check's
name and ends by printing how many ran: **102** as of this entry, 95 at the SQL level and seven
driving master's generated Prisma client. A count quoted in prose is a copy and will drift again;
the script's own last line is the number to trust.

## What would reverse this

- **PR #42 merging.** This file may then read Malay, and the app-side patterns in choice 1 have
  to be widened in the same change, or choice 1 will refuse rows the app and the file agree on.
- **A decision to keep the months in `1 year 6 months`.** Both the app and this file drop them
  today. If the app starts adding them, choice 4's exemption is where this file has to follow.
