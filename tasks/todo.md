# RBAC review fixes — 2026-09-02

Follow-up to `fb61945` (staff member management + permission-based RBAC).
Self-review found four regressions and one cost problem; this is the fix pass.

## Items

- [x] **1. Privilege escalation: shelter settings.**
      `updateShelterSettings` was `[ROLES.ADMIN]` (verified against `9799dfe`);
      I collapsed it to `MANAGE_SETTINGS`, which `VOLUNTEER_COORDINATOR` holds.
      That schema carries `resendApiKey` / storage config, so a coordinator can
      rotate platform credentials they previously could not touch.
      Fix: `MANAGE_SETTINGS` → Super Admin only; add `SEND_SHELTER_EMAIL`
      (Super Admin + Volunteer Coordinator) for `sendTestEmailAction`, which
      *was* `[ADMIN, COORDINATOR]`. Restores both guards exactly.
      - [x] Also redact secrets from the `SETTINGS_UPDATED` audit entry, which
            currently writes `resendApiKey` in plaintext into a log that
            `/admin/audit` renders. Pre-existing, but item 1 widened its blast
            radius, so it is fixed here rather than named and left.
      - [x] Admin nav must gate a tab on *any* of its permissions, or the
            coordinator loses the settings tab they legitimately still use.

- [x] **2. Hydration mismatch: Last Login column. — RETRACTED, not a bug.**
      Claimed `formatLastLogin`'s `Date.now()` would differ between server and
      client render. Verified against a running production build instead of
      assuming: `MemberDataTable`'s markup ("Invite Staff Member", "Filter by
      name, email or role") appears **0 times** in the SSR HTML. The admin
      layout is a client component that renders "Verifying Staff Session…"
      instead of `{children}` until its session effect resolves, so the table
      never server-renders and both first renders show the same spinner.
      No mismatch is possible. No code change — the premise was false.
      Latent only: it becomes real if the admin layout is ever converted to a
      server component, which is the right long-term fix for the client-side
      auth gate. Noted, not pre-emptively worked around.

- [x] **3. Invitation enumeration + a false comment.**
      `acceptInvitation`'s comment claims one generic failure message;
      `verifyInviteToken` returns four distinct strings, three of which confirm
      an account exists to an unauthenticated caller.
      Fix: one public message, specific reason kept in the audit log.

- [x] **4. Coverage regression.**
      `verifyAdminSession()` has zero callers in `src/` but five tests; its
      replacement `hasAdminPermission` is only ever mocked.
      Fix: delete the dead function, repoint the existing security tests at
      `hasAdminPermission`.

- [x] **5. One uncached DB round-trip per guard call.**
      25 `getVerifiedSession` / `requirePermission` sites, each hitting
      `prisma.user.findUnique`.
      Fix: memoize per request with React `cache()`.
      - [x] Verify `cache()` degrades safely under vitest (no request scope).

- [x] **6 (partial). Honest test name.**
      "blocks demoting the last active Super Admin" passes because of the
      *self*-demotion rule; the count guard is unreachable while
      `MANAGE_MEMBERS` is Super-Admin-only. Rename and document, keep the guard
      as future-proofing.

## Out of scope this pass

Items 7–10 from the review: redundant post-mutation refetch, double user
lookup on login, minor dead exports / P2002→409 mapping, and the proxy's
HTML-to-RSC response. Reported, not fixed.

## Verification gate

Nothing is complete until: `npm run typecheck`, `npm run lint`, full vitest,
`npm run build`, and a live re-probe of the `/admin/members` status matrix all
pass — plus a direct check that each fixed behaviour actually changed.

## Review

**Outcome:** 5 of 6 items fixed, 1 retracted as a false finding.

`npm run typecheck` clean · `npm run lint` 0 errors (4 pre-existing
`useReactTable` compiler warnings) · **249 tests pass**, up from 240 · `npm run
build` clean with `authInterrupts` active · `/admin/members` status matrix
re-probed on a production build and unchanged (401 signed-out, 403 for all four
non-admin roles, 200 for Super Admin and legacy ADMIN, 401 for forged and
expired cookies).

**Mutation-tested, not just asserted.** Each security fix was verified by
reintroducing the defect and confirming the suite catches it:

- Re-granting `MANAGE_SETTINGS` to the coordinator → **4 failures** across
  `permissions.test.ts`, `settingsAuthorization.test.ts` (twice, at the action
  level) and `softDeleteAndAuth.test.ts`.
- Returning `verification.reason` to the caller again → **2 failures** in
  `members.test.ts`.

Both reverted and re-verified green afterwards.

**Two of my own review claims were wrong and are corrected here:**

1. The hydration bug does not exist (item 2) — the admin layout never renders
   the table server-side. Proven by grepping the SSR HTML, not by reasoning.
2. "A single page render that also runs an action pays the query repeatedly"
   was wrong: server actions are separate requests, so nearly every path checks
   once. The real duplication is `getAdminActorOrThrow` in `actions/pets.ts`,
   which reads the session twice per pet mutation. `cache()` is kept — it halves
   that and makes `canCurrentUser` free — but the comment now states the narrow
   truth instead of the inflated one.

**Still open** (reported, deliberately not fixed): redundant post-mutation
refetch, the double user lookup on login, `userStatusSchema` dead export,
P2002 → 409 mapping on the invite race, and the proxy answering RSC
navigations with HTML.
