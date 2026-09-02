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

**Closed in the follow-up pass below.**

---

# Follow-up pass — remaining review items

Plan: `~/.claude/plans/polymorphic-imagining-micali.md`. Researching these in
the bundled Next 16.3.1 docs overturned two of my own conclusions and surfaced
a real pre-existing data exposure.

- [x] **7. `/admin/pets` leaked the admin inventory to anyone.** Found while
      auditing route guards, not previously reported. `getAdminPets()` had no
      authorization check and `/admin/pets` is a Server Component calling it
      directly — server-component output is serialised into the RSC flight
      payload whether or not the client layout mounts it. **Measured on a
      production build: anonymous GET returned 200 with 75,453 bytes containing
      `applicationCount`, `rescueStory`, `adoptionFee` and pet names. After the
      fix: 45,796 bytes, zero occurrences of any of them**, while an authorized
      Animal Manager still gets the data.

- [x] **8. Post-mutation refetch — fixed the opposite way to the review.**
      `server-actions.md:36-45` says an action calling `revalidatePath`
      re-renders the route and ships the new payload in the same response, and
      `interactive-apps.md:121` documents the trap: client state is preserved
      across that re-render, so a `useState` copy seeded from a prop never sees
      it. Each mutation was paying for a server re-render, discarding it, then
      refetching. `MemberDataTable` is now prop-driven and `refresh()` is gone.

- [x] **9. One user lookup on login.** `status` moved onto `UserRecord`, so
      `loginAction` reads the row once and `memberStore` left the auth path.
      `recordLogin` stays awaited — serverless suspends after the response, so
      fire-and-forget can lose the write. This reverses my earlier suggestion.

- [x] **10. Error taxonomy.** `toFailure` returned `error.message` for any
      error, sending Prisma internals to the browser. Guard errors keep their
      message; everything else gets the caller's fallback and a server log;
      `P2002` maps to 409, closing the invite race.

- [x] **11. Duplication and dead surface.** Invite dialog now runs
      `inviteMemberSchema` instead of a second hand-written email regex;
      `userStatusSchema` and `requireSession` deleted; the server-only security
      barrel no longer re-exports a `"use client"` hook.

- [x] **12. Proxy — the review proposed an impossible fix.** I suggested
      branching on the `RSC` header. `proxy.md:442`: Next **strips** `rsc`,
      `next-router-state-tree` and `next-router-prefetch` in proxy precisely so
      RSC and HTML responses cannot diverge. `NextResponse.rewrite(url,
      {status})` is also out — the rewrite branch in `resolve-routes.js`
      returns no `statusCode`. Kept the direct 403, replaced the speculation
      with the constraint and its citation, and added the missing tests: the
      proxy had none.

## Deliberately rejected

Generalising proxy into a route→permission table for all `/admin` routes.
Proxy reads only the signed cookie, making it optimistic: promoting someone
mid-session would produce a **false negative**, since the DAL refreshes the role
from the database and would allow what the stale cookie rejects. Server
Functions also POST to the route they are used on (`proxy.md:217`), so a
route-level permission would refuse a Volunteer Coordinator's legitimate
test-email POST to `/admin/settings`. Guarding data at its source has neither
failure mode.

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

---

## Follow-up pass review

`npm run typecheck` clean · `npm run lint` 0 errors (4 pre-existing
`useReactTable` warnings) · **289 tests pass**, up from 249 · `npm run build`
clean · `/admin/members` status matrix re-probed and unchanged.

**Mutation-tested, every fix:**

| Reintroduced defect | Failures |
|---|---|
| Remove the `getAdminPets` guard | 4 |
| `toFailure` leaks `error.message` again | 1 |
| Remove the `P2002` → 409 mapping | 2 |
| Remove `revalidatePath` from the actions | 3 |

The `toFailure` mutation **passed silently on the first attempt** — the fix had
no test at all. That is the whole point of the exercise; coverage was added and
the mutation then failed as it should.

**Not verified here:** a live browser mutation confirming the roster refreshes
from the server re-render alone. It needs a reachable database, and this
worktree deliberately has none (no `.env.local`, and the real `DATABASE_URL`
points at Neon production). The dependency is pinned by the revalidation
contract tests above instead, and the behaviour is doc-backed, but it is worth
one click-through against a real database before merging.