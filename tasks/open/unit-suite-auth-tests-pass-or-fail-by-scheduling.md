# The unit suite's authorization tests pass or fail depending on how the run is scheduled

**Status:** open · opened 2026-09-22 · found while verifying an unrelated change

`npm test` on `master` is not reproducible. Three runs of the same 98-file unit project, on two
checkouts of the same commit, within twenty minutes of each other:

| Run | Tree | Result |
|---|---|---|
| 1 | worktree at `8d36ace` + an unrelated one-line repository fix | `98 passed (98)` · `1580 passed (1580)` |
| 2 | the same worktree, same commit, nothing changed in between but docs | `14 failed \| 84 passed (98)` · `57 failed \| 1523 passed (1580)` |
| 3 | **main checkout on `master`, none of that branch's changes** | `20 failed \| 78 passed (98)` · `54 failed \| 1528 passed (1582)` |

A fourth run, by a review sub-agent on the branch tree, passed all three projects:
`116 files, 1819 tests`. So every outcome from "all green" to "54 red" is reachable from
substantially the same source.

Run 3 is the one that matters: it has **none** of the branch's changes, so whatever this is, it is
on `master`. The two trees differ only in that the main checkout carries an uncommitted
`tests/unit/serverActionAuth.test.ts` (hence 1582 rather than 1580) and a `.env.local` the
worktree does not have — neither of which the unit project loads.

The failures cluster on authorization. `tests/unit/volunteerForm.test.ts` and
`tests/unit/adoption/applicationWorkflow.test.ts` were the two confirmed by name; the rest were
lost to a `tail` and have not been enumerated. The observed error is the same each time:

    AssertionError: promise rejected "UnauthorizedError: Authentication required…"
     ❯ assertHasPermission src/lib/security/rbac.ts:148:11
     ❯ getVolunteerFormLinks src/actions/settings.ts:126:3

`tests/unit/volunteerForm.test.ts` mocks `@/lib/security/session`'s `getCurrentSession`, but
`getVolunteerFormLinks` resolves its caller through `getVerifiedSession()` from
`@/lib/security/dal` — which re-reads the member row through `findUserById` (Prisma first, then
the in-memory seed) and returns null when nothing vouches for the id. The test's
`sessionState.id` is `user-test-01`, which no seed holds. **ASSERTED, not measured:** that reads
like it should fail *every* time, which is exactly what run 1 and the review run did not do, so
the mechanism above does not yet explain the variance and should not be treated as the diagnosis.
Load is the obvious suspect — runs 2 and 3 were taken with eight concurrent agent sessions on the
machine, run 1 with far fewer — but nothing has tested that.

`tests/unit/volunteerForm.test.ts` reproduces in isolation on both trees
(`4 failed | 10 passed (14)`), so a single-file repro exists and does not need the full suite.

**Why this is worth an entry rather than a shrug.** A suite that reports green under one schedule
and 54 red under another cannot gate anything. Every agent session in this repo runs `npm test`
before closing, and the honest reading of a green run is currently "green, or not yet unlucky".
It also costs real time: this was investigated twice from scratch, by two sessions, as a
suspected regression in an unrelated change.

**Settles when:** someone runs the isolated repro (`npx vitest run --project unit
tests/unit/volunteerForm.test.ts`, which fails on `master` today), decides whether the defect is
the test's mock or the DAL's fallback, fixes it, and then runs the full unit project three times
under load to confirm the count is stable. If the variance survives that, the next question is
whether `getVerifiedSession`'s Prisma attempt is timing out under contention.
