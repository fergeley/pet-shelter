# The server-action auth guard has never scanned the FAQ actions

**Status:** resolved 2026-09-03 · the guard landed with the entries this note asked for

> **Resolution.** `tests/unit/serverActionAuth.test.ts` arrived on the QR branch
> and now runs against `src/actions/faqs.ts`. The three reads are allowlisted
> verbatim as "published rows only, rendered anonymously by /faq and /pets" —
> no session check was added, so the public category tabs keep working. The five
> mutations passed only after `requireFaqEditor` was added to the recognised
> authorization helpers: the guard scans each function body, and they call the
> named gate rather than `assertAuthorized` directly.
>
> This note is why the reads were allowlisted instead of "fixed" with
> `assertAuthorized`, which is exactly the failure it predicted. Left in place
> as the record.

`tests/unit/serverActionAuth.test.ts` — every exported Server Action must
authorize or sit in an explicit allowlist with a reason — is described as
existing but **is not on `master`**. It is in flight on another branch, so it has
never run against `src/actions/faqs.ts`, which merged in PR #13.

When it lands it will find eight exports:

| Action | Authorizes | Expected verdict |
|---|---|---|
| `createFaqAction`, `updateFaqAction`, `deleteFaqAction`, `toggleFaqPublishedAction`, `reorderFaqAction` | `requireFaqEditor()` | passes |
| `getFaqsAction`, `fetchFaqsAction`, `getFaqByIdAction` | no | **needs an allowlist entry** |

The three reads are unauthenticated on purpose. They return only `isPublished`
rows — exactly what `/faq` and `/pets` already render to anonymous visitors — and
`PetsFaqSection` calls `getFaqsAction` for its category tabs on the public pets
page. Adding a session check to satisfy the guard would break that tab strip for
every logged-out visitor, which is most of them.

**The right resolution is an allowlist entry reading "published rows only,
rendered anonymously by /faq and /pets", not a session check.** Recorded here
because the guard's author cannot see this constraint from their branch, and the
failure mode — a red test "fixed" by bolting on `assertAuthorized` — looks like
a correct fix right up until the public FAQ tabs stop working.

There is deliberately no `getAdminFaqsAction`; the editor page is a Server
Component and reads drafts straight from the repository. Do not add one to give
the client table a read path without carrying that reasoning over.

**Settles when:** the guard is on `master` and green with the three reads
allowlisted for that reason.
