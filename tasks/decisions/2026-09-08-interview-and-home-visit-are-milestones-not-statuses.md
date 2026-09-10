# Interview and home visit are milestone timestamps, not `ApplicationStatus` members

**Decided:** 2026-09-08

The public tracking portal shows five steps — Received, Review, Meet & Greet, Home Visit,
Decision. The obvious implementation is to add `INTERVIEW`, `HOME_VISIT` and `COMPLETED` to the
`ApplicationStatus` enum. That was the shape originally specified for this work. It was rejected
for two independent reasons, either of which is sufficient.

## Status and progress are different axes

`ApplicationStatus` answers *what has been decided* — submitted, under review, approved, rejected.
An interview and a home visit answer *how far along the process is*. They are not alternatives to
"under review"; they happen **during** it. Making them enum members forces a false exclusivity, in
which recording a home visit would have to overwrite the fact that the application is still under
review, and approving an application would erase the fact that a home visit happened.

The existing code already demonstrated the cost of the conflation. Because there was nowhere to
put an interview, `scheduleApplicationInterview` formatted it into the free-text
`adminReviewNotes` column as `[Meet & Greet Scheduled: <date> at <time> (<type>) - Location: <x>]`,
and `lookupApplicationStatusAction` recovered it with a regular expression. A coordinator editing
that note by hand silently broke a step in the applicant's tracking page, and nothing failed.

## The enum column is not safe to alter right now

`tasks/open/production-schema-has-drifted-ahead-of-master.md` records that a `migrate diff`
against production still proposes

    ALTER TABLE "adoption_applications" DROP COLUMN "status", ADD COLUMN "status" "ApplicationStatus" ...

That conversion is one of the twelve destructive statements deliberately left pending, and it
resets the status of every row rather than migrating it. Touching `ApplicationStatus` would have
stacked a new change on top of an unresolved destructive one, and would have needed a
data-preserving `USING` cast that nobody has yet written. Twenty-five files also reference the
type, so the blast radius was the whole application surface.

## What was done instead

Nine **additive, nullable** columns on `adoption_applications`: `referenceCode` (unique),
`identification`, `landlordApproval`, `vetClinic`, `dailyAloneHours`, `interviewAt`,
`interviewLocation`, `interviewMeetingType`, `homeVisitAt`. Applied with a hand-written idempotent
script, `prisma/sql/2026-09-08_adoption_application_milestones_additive.sql`, following the
precedent of the nine files already in that directory. `ApplicationStatus` is untouched, so the
pending conversion stays exactly as it was and none of the twenty-five consumers changed.

`src/lib/domain/applicationWorkflow.ts` derives progress from evidence: each milestone has its own
witness (a status value or a timestamp), the furthest witnessed milestone wins, and every earlier
one is backfilled so the rail is monotonic by construction. A home visit logged against a row
still marked SUBMITTED therefore reports Review as reached rather than rendering step 4 lit with
step 2 dark.

The regex survives as a clearly marked read-only compatibility path in `readInterviewDetails`,
because interviews scheduled before these columns existed live only in the notes. It carries a
`ceiling:` comment and should be deleted once no application predating the columns is still open.

## What would reverse this

If the shelter ever needs to enforce *ordering* between milestones — refusing a home visit before
an interview, say — timestamps alone stop being enough and a real state machine over a progress
enum becomes worth the migration. That is a separate change and needs the pending `status`
conversion resolved first.
