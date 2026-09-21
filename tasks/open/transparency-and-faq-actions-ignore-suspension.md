# Transparency and FAQ writes authorize from the cookie alone, so suspension does not stop them

**Status:** open · opened 2026-09-18

The DAL (`src/lib/security/dal.ts`) exists so that a suspension or deletion takes effect on the
member's next request: `getVerifiedSession()` re-reads role and status instead of trusting the
24-hour session cookie. These entry points do not go through it:

- `src/actions/transparency.ts` — `getAdminTransparencySnapshotAction` (line 164),
  `createExpenseItemAction` (182), `updateExpenseItemAction` (218), `deleteExpenseItemAction` (249),
  `saveImpactStatAction` (286), `deleteImpactStatAction` (318), `createFinancialReportAction` (352),
  `deleteFinancialReportAction` (384): each calls `getCurrentSession()` then `assertHasPermission`.
- `src/actions/faqs.ts:37` — `requireFaqEditor()`, used by every FAQ write and draft read.
- `src/app/admin/faqs/page.tsx:18`.

`getCurrentSession()` only verifies the cookie's signature and expiry. So a member suspended in
Staff & Permissions — or a row deleted outright — keeps MANAGE_CONTENT and FAQ-editor powers until
their cookie expires, up to 24 hours, with the database fully reachable. The role in the cookie is
also the one at sign-in, so a demotion is ignored for the same window.

**Why it matters now:** the production lockdown (`docs/runbooks/RUNBOOK_PRODUCTION_STAFF_ACCOUNT_LOCKDOWN.md`)
suspends seeded accounts whose passwords are public. Any `usr-admin-01` cookie issued before that
suspension can still write the public expense ledger, impact figures and financial reports, and
edit FAQs. The owner decided on 2026-09-17 not to rotate `SESSION_SECRET` on the understanding that
suspension revokes sessions; that understanding was wrong for these actions.

Found by code review of the runbook's fix round (PR #46, 2026-09-18), confirmed by
`grep -rn "getCurrentSession()" src` outside `src/lib/security/`. Not fixed there: it is a change to
an authorization boundary in two other modules, needing its own tests, and it would have widened a
security PR that must merge promptly.

**Interim control:** rotating `SESSION_SECRET` invalidates every existing cookie.

**Settles when:** every listed entry point resolves its principal through `requirePermission` /
`getVerifiedSession`, with a test per module that a suspended member's still-valid cookie is refused
— or a guard test fails any `"use server"` module that calls `getCurrentSession()` for authorization.
