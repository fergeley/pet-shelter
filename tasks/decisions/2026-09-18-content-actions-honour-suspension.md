# Content actions authorize from the verified session, so suspension reaches them

**Decided:** 2026-09-18

Closes `tasks/open/transparency-and-faq-actions-ignore-suspension.md`.

The eight transparency actions (`src/actions/transparency.ts`), FAQ editing (`requireFaqEditor`
in `src/actions/faqs.ts`) and the `/admin/faqs` page took their principal from
`getCurrentSession()`, which checks a cookie's signature and expiry and nothing else. The DAL's
`getVerifiedSession()` exists so that a suspension, a deletion or a demotion takes effect on the
member's next request instead of when their 24-hour cookie expires, and these eleven places
bypassed it. Found while writing the production lockdown runbook: suspending the seeded accounts
would not have stopped an existing Super Admin cookie from writing the public expense ledger or
editing FAQs.

Observed before the change, with a correctly signed, unexpired cookie for a member whose row was
SUSPENDED, or absent from every store: `getAdminTransparencySnapshotAction` returned the draft
snapshot, and `createExpenseItemAction` **created the entry**.

## What was chosen

- The transparency actions call `requirePermission(PERMISSIONS.MANAGE_CONTENT)`, which is the
  DAL plus the same permission check they made before.
- `requireFaqEditor` and the `/admin/faqs` page call `getVerifiedSession()` and keep their role
  lists.
- `tests/unit/security/verifiedSessionOnly.test.ts` fails if anything outside
  `src/lib/security/` calls `getCurrentSession()`, except `src/actions/auth.ts`, whose logout and
  self-report authorize nothing.

## Why a guard, and not only the fix

`tests/unit/serverActionAuth.test.ts` passed all of these actions, because it checks that an
action calls an authorization helper — `assertHasPermission`, `assertAuthorized` — not where the
session handed to it came from. That is the same blind spot as the open ledger item about the guard
passing a function on its neighbour's authorization. Keying the new guard on the session source
closes this shape rather than these eleven instances.

## What this does not change

The DAL's own outage path still returns the cookie's claims when the member lookup throws
(`readVerifiedSession`), a deliberate trade recorded on that function. During a database outage
these actions therefore still honour an unexpired cookie, as every other DAL-guarded action does.
Rotating `SESSION_SECRET` remains the only way to end that at once.

## Test harness change

`tests/unit/transparency.test.ts` mocks the session module and a Prisma client with no `user`
model. After this change its role tests would still have passed, but only because the DAL's member
lookup threw and the outage path trusted the cookie. It now answers the lookup as a reachable
database would for an active member. Flipping that answer to SUSPENDED fails 14 of its success
cases, which shows the realistic path is the one exercised.
