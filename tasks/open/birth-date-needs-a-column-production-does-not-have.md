# The birth date feature writes to a column production does not have

**Status:** open · opened 2026-09-22 · from PS-114, blocks PR #42

`prisma/schema.prisma` declares `pets.birthDate String @default("2024-01-01")` and
`pets.birthDateIsEstimate Boolean @default(true)`. Production does not have either column. The
`pets.age` → `birthDate` half of the drift recorded in
`tasks/open/production-schema-has-drifted-ahead-of-master.md` has never been applied, and the
one manual migration that might have carried it says so in its own header: *"The rest of the
drift — pets.age to birthDate, the shelter_settings columns, three indexes — is not here"*
(`prisma/migrations/manual/20260917_status_enums/migration.sql`).

So PR #42 adds a control whose entire output goes to storage that is not there. On the evidence
of the `ApplicationStatus` case, which lost writes silently for weeks, the failure mode is not a
visible error: the write fails and the form reports success.

**Merging the PR does not by itself put this in front of an operator** — the admin pet form is
already behind an authenticated route — but it does ship a field that cannot work, and anyone
who uses it will believe they have recorded a birthday.

A second problem arrives with the column rather than before it. `birthDate` is declared
non-nullable with a literal default of `2024-01-01`, so the schema cannot express "no birthday
recorded". Every row that predates the column gets 2024-01-01, and the new date input will show
that to operators as though the shelter knew it. The estimate flag is the only thing marking it
as a guess, and nothing renders that either —
`tasks/open/birth-date-estimate-flag-is-never-shown.md`.

Two of the three `p.birthDate ? … : true` guards added by PR #42, in
`src/lib/server/petMappers.ts`, are dead for the same reason: a non-nullable column is never
falsy on a row that exists.

**Settles when:** the `birthDate` / `birthDateIsEstimate` columns exist on the production branch
and `npm run db:check-drift` reports them, *and* a maintainer has decided what a row with no
recorded birthday should hold — a nullable column, or a documented sentinel that the read path
treats as unknown rather than as 1 January 2024.
