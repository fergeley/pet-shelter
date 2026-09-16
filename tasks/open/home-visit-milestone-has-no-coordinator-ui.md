# The Home Visit milestone can be recorded by action but not by any coordinator UI

**Status:** open · opened 2026-09-08

The public tracking portal now renders five milestones, and `homeVisitAt` on
`adoption_applications` is what lights the fourth. The server action that writes it,
`recordApplicationHomeVisit` in `src/actions/applications.ts`, is complete: it checks
`REVIEW_APPLICATIONS`, validates the date and time, writes the column through
`recordApplicationMilestones`, and records a `HOME_VISIT_RECORDED` audit entry. It is covered by
the same permission guard as `scheduleApplicationInterview`.

**Nothing calls it.** There is no button in `src/components/admin/` — the coordinator can schedule
a Meet & Greet from `ApplicationDetailDialog` but has no equivalent control for a home visit. So
in practice the fourth step will never light for a real application until that control exists.

This was left deliberately rather than overlooked. The session that added the milestone columns
held `src/actions/**`, `src/lib/**`, `prisma/**` and the adoption components, and explicitly did
not hold `src/components/admin/**`; adding a control there would have been an unclaimed
cross-session edit to files another session may have been holding.

The work is small: a date/time control in `ApplicationDetailDialog` calling
`recordApplicationHomeVisit({ applicationId, homeVisitDate, homeVisitTime })` and surfacing the
returned error, mirroring how the existing interview scheduler is wired.

Related: `tasks/decisions/2026-09-08-interview-and-home-visit-are-milestones-not-statuses.md`
explains why this is a timestamp rather than an `ApplicationStatus` member.

**Settles when:** a coordinator can record a home visit from the admin application detail view,
and the fourth milestone is observed lighting on the tracking portal for a real application.
