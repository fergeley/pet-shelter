# The expand migration refuses a row the app would read differently, instead of claiming it never happens

**Decided:** 2026-10-13

Amends `tasks/decisions/2026-09-22-expand-stores-only-what-the-app-computes.md` and, for its
check list only, `tasks/decisions/2026-09-22-pets-birth-date-backfills-from-intake-date.md`.
Neither is rewritten. This entry records what a fifth review found in
`prisma/migrations/manual/20260922_pets_birth_date/`, the six choices made answering it, and
what a review of those answers then found.

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
Check **O4** pins all four strings. Where the app-side pattern finds nothing at all the row is
refused too, by coalescing before the comparison: that cannot happen under the C ctype this was
rehearsed on, and is not promised impossible under an ICU one, whose `[[:space:]]` is wider.
That last sentence is reasoning. No ICU database was available to measure it on.

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
guard now exempts one shape: a year quantity followed by a month quantity. All three backfill as
the year, which is what the app reads.

**The first answer to this was wrong, and the review of the fix caught it.** It exempted any
first number carrying a unit, on the argument that a narrower exemption was one regular
expression too many. That let `6 m - 1 y` through as one year, its *upper* bound, and
`2 y - 3 y` and `3 m - 4 m` through as their lower. The app reads the same numbers, so choice 1
could not catch them, and the header still promised that a range aborts. The narrower exemption
is what shipped. Check **N7** pins the three ranges; widening the lookahead back turns it red.

**The second answer was still too wide, and the next review caught that.** The lookahead allowed
anything between the year quantity and the month quantity, so `1 y - 2 m` and `1yr-18mo` were
exempt as "compounds". Only whitespace, a comma or `and` may separate them now.

**The limit that remains is the window, and it is pinned rather than implied.** The guard looks
five characters back from the number beside the unit. `2 years - 3 years`, `6 months - 1 year`
and `1 yr - 18 mo` have longer gaps and are stored: two years, one year (the *upper* bound,
because years are read first) and one year. The app reads each the same way, so nothing else
catches them. Check **N8** asserts that they are stored, so the header's warning cannot be read
as hypothetical, and the header tells the owner to read the `age` column for any row holding two
numbers. Widening the window was not done: it is the knob that decides whether
`2 years, 12.5 kg` blocks the table, and it has been moved three times already.

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
| present, unmarked | present | leaves both |
| present, unmarked | absent | leaves it, and says what it blocks |

The review called the second row a state that makes `migration.sql` refuse the table
"permanently". It was not permanent: the refusal names the stray column and says to drop it. And
this pair cannot produce it, because apply adds both columns or neither and rollback drops both
in one transaction — it takes a hand-run `DROP COLUMN "birthDate"`. It is fixed anyway, because a
marked flag is this pair's own leftover and the misleading notice was real.

The last row's notice also said "Nothing has been undone" while the same run restored the
NOT NULLs `migration.sql` had removed. It now says which columns were kept and that the
constraints are still restored. Checks **Q1–Q6**.

## 6. The whole `intakeDate` is read

Found by the review of the fix, in text the fix had just rewritten to say "every row". The file
validated and used the first ten characters of `intakeDate`. Master's app passes the whole
string to `new Date`, so `2026-03-01T02:00:00+08:00` is 28 February there and 1 March here, and
`2026-06-12 (approx)` is no date at all there. A row is now refused unless `intakeDate` is a
bare date or a date at exactly UTC midnight, the two forms that are the same day to both. Checks
**C12**, **C13**, and **e-13**/**o-24** for the accepted form.

This can refuse a table the old file would have migrated, if production stores timestamps. The
fixtures and the admin form both write bare dates, so that is not expected, and the pre-check
names any such row as `bad intakeDate` before anything runs.

## The check list lives in `rehearse.mjs`

`migration.sql` pointed at the first decision entry for "the full check list". That entry says
eighty-six checks and has no groups M, N or O; the script had ninety-two. The entry is a record of
its date and stays as written. The header now points at `rehearse.mjs`, which prints each check's
name and ends by printing how many ran: **116** when this entry was last touched, seven of them
driving master's generated Prisma client. A count quoted in prose is a copy and will drift again;
the script's own last line is the number to trust.

## What the review of this fix found

Ten findings on the commit that answered the seven. Each was checked before it was acted on.

Fixed: the over-wide exemption (choice 4); the whole-string `intakeDate` (choice 6); the NULL
comparison (choice 1); a rollback notice about a flag that was not there, in the one column state
the first five Q checks did not cover; three more passages still citing a contract migration that
re-derives every row, which PR #94 no longer does; a header that pointed at the two entries this
one amends and not at this one; and the Malay advice, which told the owner to run two `UPDATE`s
that do not reach everything the refusal reaches. The header now says so.

One was a defect in how the fix was written rather than in what it meant. The app-side
whitespace class had been typed as backslash-u escapes and arrived in the file as sixteen
literal invisible characters, six times, because the tool that wrote the edit script decoded
them. PostgreSQL read them correctly and every check passed. The file is meant to be pasted into
a web editor, where a stripped or normalised character would silently narrow one copy. They are
escapes now, and the edit script refuses to write a non-ASCII character beside `[[:space:]]`.

A third review, of the commit that fixed those, found eight more. The separator and the window
are in choice 4. The rest: two exception messages whose advice did not fit every row they could
name (a months-first compound told to rewrite a decimal; a timestamp told only to "correct
intakeDate"); nothing in the repository pinning the escapes, so checks **S1** and **S2** now fail
on any non-ASCII character in either SQL file and on any copy of the class that differs; the
rollback header describing four column states where the code has five; one more passage citing
the contract migration, in the rehearsal. The NULL branch of choice 1 was exercised once by
breaking the app-side patterns on purpose: it refuses and formats its message. It is still not
exercised by any kept check.

Not done: deriving `unit` and `qty` from `sql_pick` so the token lists exist once in the body
instead of three times. It is a real simplification and it rewrites the expressions every stored
date comes from, in a round whose brief was to fix findings. The copies have not diverged.

## What would reverse this

- **PR #42 merging.** This file may then read Malay, and the app-side patterns in choice 1 have
  to be widened in the same change, or choice 1 will refuse rows the app and the file agree on.
- **A decision to keep the months in `1 year 6 months`.** Both the app and this file drop them
  today. If the app starts adding them, choice 4's exemption is where this file has to follow.
