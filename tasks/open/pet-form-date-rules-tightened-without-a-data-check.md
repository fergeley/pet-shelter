# Two new pet-form date rules could strand rows nobody has counted

**Status:** ASSERTED · opened 2026-09-22 · from PS-114, raised by review of PR #42

PR #42 adds two validation rules to `src/lib/validations/pet.ts`. Both are defensible, both are
enforced only in the form, and neither was checked against the rows already stored. Because the
admin form validates the *whole* pet on every save, a row that violates either becomes
uneditable — the operator changes a description, and the save fails on a date field they never
touched, with no way forward that is not falsifying a date.

**1. `birthDate` must not be after `intakeDate`.** Stated as "an animal cannot be admitted
before it is born", which is true of an animal admitted from outside. It is not true of one born
at the shelter: a pregnant intake is normal shelter work, and a puppy born three weeks after its
mother arrived legitimately has a birthday after the intake date it inherits. Nothing prevented
such a row before.

**2. `intakeDate` tightened from `z.string().min(4)` to a strict `YYYY-MM-DD` calendar check.**
`prisma/schema.prisma` types `intakeDate` as a plain `String` with no constraint, so nothing has
ever enforced the shape in the database. A row holding `2026-06-12T00:00:00.000Z`, or a partial
date, is now unsaveable through the form.

**Belief, not observed.** Every `intakeDate` literal in this repository is already a clean
`YYYY-MM-DD` — checked across `src/`, `prisma/` and `tests/`, zero with a time component — and
all ten fixtures in `src/data/pets.json` satisfy `birthDate <= intakeDate`. What has *not* been
checked is the production table, because agents in this repo are refused production reads
(`tasks/open/production-schema-has-drifted-ahead-of-master.md`). Today the question is moot for
rule 1, since production has no `birthDate` column at all — see
`tasks/open/birth-date-needs-a-column-production-does-not-have.md` — but it becomes live the
moment that column is added with its `2024-01-01` default, which is after the intake date of
every animal taken in before 2024.

**Settles when:** someone with production access runs the two counting queries — rows where
`intakeDate` does not match `^\d{4}-\d{2}-\d{2}$`, and rows where `birthDate > intakeDate` — and
either reports both empty, or the rules are relaxed to match the data. The born-at-the-shelter
case needs a maintainer's answer regardless of what the counts say.
