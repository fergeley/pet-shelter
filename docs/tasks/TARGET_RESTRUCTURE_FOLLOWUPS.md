# 🟡 Target: Two Follow-Ups from the `src/lib/` Restructure

Both were found while restructuring and neither is blocked. They are independent — dispatch either
alone. **Item 2 is done** (`1dfb8c9`, 2026-08-28); item 1 is still unstarted.

**Run item 1 with `/fix-category-tabs`** (`.claude/commands/`). The prompts
below are the same content, kept here for reading and for pasting into a session that has no access
to this repo's commands.

| # | Item | Risk | Size | Status |
|---|---|---|---|---|
| 1 | Wire two components to the derived category readers | Low | ~4 files | 🟡 unstarted |
| 2 | Make `verifyAdminSession()` name a principal | **Security** | ~5 files | ✅ `1dfb8c9` |

---

## 1. Category tabs are hardcoded

`src/lib/server/faqCatalog.ts:72` and `src/lib/server/rehabNeedsCatalog.ts:77` export
`getServerFaqCategories()` / `getServerRehabCategories()`. **Nothing imports either.**

Meanwhile `src/components/layout/PetsFaqSection.tsx:9` and
`src/components/features/needs/RehabNeedsSection.tsx:23` each hardcode the same list.

Why it matters: a hardcoded tab can point at a category with no entries, which renders a control
that filters to nothing. The derived readers return only *populated* categories — which the
`FAQ_CATEGORIES` / `REHAB_NEED_CATEGORIES` Zod enums cannot, since they list all seven.

### The four traps

1. **Both components are `"use client"`.** They may **not** import `@/lib/server/*` —
   `tests/unit/layerBoundaries.test.ts` fails CI on it. This is not a workaround to route around;
   it is the correct constraint.
2. **The pattern already exists.** `src/app/pets/page.tsx:70` and `src/app/needs/page.tsx:35` are
   Server Components already passing `initialFaqs` / `initialNeeds` down as props. Add
   `initialCategories` the same way. Do not add a Server Action for this.
3. **Shape mismatch.** The readers return `{ category, labelEn, labelMs }`; the tabs expect
   `{ value, labelEn, labelMs }`.
4. **The `"all"` tab is not in the data.** Both hardcoded lists open with
   `{ value: "all", labelEn: "All Topics", labelMs: "Semua Topik" }`. The readers derive from
   fixture rows, so they will never produce it — the component must prepend it. Losing the "all"
   tab is the most likely way to break this silently.

### Dispatch prompt

```
In C:\Users\User\pet-shelter, wire two components to the category readers that already exist
but nothing consumes.

Read docs/architecture/WHERE_CODE_GOES.md first.

- src/lib/server/faqCatalog.ts exports getServerFaqCategories()
- src/lib/server/rehabNeedsCatalog.ts exports getServerRehabCategories()
- src/components/layout/PetsFaqSection.tsx:9 hardcodes FAQ_CATEGORY_TABS
- src/components/features/needs/RehabNeedsSection.tsx:23 hardcodes CATEGORY_TABS

Replace the hardcoded lists with the derived ones. Four things will bite you:

1. Both components are "use client" and MUST NOT import @/lib/server/*. A guard test fails
   CI if they do. Do not weaken the guard.
2. Their parents are Server Components already passing data down:
   src/app/pets/page.tsx:70 passes initialFaqs, src/app/needs/page.tsx:35 passes
   initialNeeds. Pass initialCategories the same way. Do not add a Server Action.
3. The readers return { category, labelEn, labelMs }; the tabs use { value, ... }.
4. Both hardcoded lists start with an "all" tab that the readers cannot produce, because it
   is not a fixture row. Prepend it in the component. Do not drop it — check the filter still
   works for "all" after your change.

Bilingual labels come from the fixture rows (categoryLabel / categoryLabelMs), NOT the i18n
dictionary. The "all" label is the exception and has no fixture row; say where you sourced it.

Verify: npx tsc --noEmit, then
npx vitest run --project unit tests/unit/faqs.test.ts tests/unit/rehabNeeds.test.ts tests/unit/layerBoundaries.test.ts
Full suite baseline is 41 files / 524 tests.

Then actually run the app and look at both tab strips — this is UI, and green tests do not
prove a tab renders. Report what you saw.
```

---

## 2. ✅ `verifyAdminSession()` cannot name who acted — **done at `1dfb8c9`**

> Closed 2026-08-28. It returns `AdminPrincipal | null` now, and the legacy shared-secret branch
> names `shared-secret@admin-token.invalid` — an RFC 2606 `.invalid` address that cannot collide
> with a staff mailbox. The synthetic `admin@hopeforstrays.org` it replaced was indistinguishable
> from a real administrator. The section below is kept as the record of what was wrong.
>
> It also surfaced an authentication hole that was deliberately left in place and written up
> separately: [`URGENT_NONPRODUCTION_ADMIN_BYPASS.md`](URGENT_NONPRODUCTION_ADMIN_BYPASS.md).

`src/lib/security/adminSession.ts:12` returned `Promise<boolean>`. Two consequences:

1. **The legacy `admin_session` cookie bypasses RBAC granularity, not just expiry.** The sealed
   branch distinguishes `ADMIN` from `COORDINATOR`; the cookie branch returns bare `true` with no
   role. Anyone holding `ADMIN_SECRET_KEY` gets whatever the *most* privileged caller can do.
2. **Audit entries cannot name an actor.** `LAYERS.md` §9.5 requires `recordAuditLog` on every
   privileged mutation, but a caller gated only by this learns *that* the request is authorised,
   never *who*. Returning `SessionUser | null` forces the legacy branch to name a principal.

Call sites: `src/actions/pets.ts:92`, `src/app/api/upload/route.ts:32` and `:108`.

The real design question is what principal the legacy branch should return. A synthetic
`ADMIN`-role user makes the audit trail honest about the fact that a shared secret was used —
but it must be *distinguishable* from a real admin, or the audit log becomes a lie in the other
direction. That decision is the deliverable; the refactor is mechanical once it is made.

### Dispatch prompt

```
In C:\Users\User\pet-shelter, change verifyAdminSession() so privileged mutations can record
WHO acted.

Read src/lib/security/adminSession.ts and docs/tasks/TARGET_SECRET_HARDENING.md section 3.5
first.

Today it returns Promise<boolean> via two branches: a sealed session (which knows the user and
their ADMIN/COORDINATOR role) and a legacy admin_session cookie compared against
ADMIN_SECRET_KEY (which knows nothing). Callers therefore cannot name an actor in the audit
log, and the legacy branch silently grants whatever the most privileged caller can do.

Change the return to Promise<SessionUser | null> and update all three call sites:
src/actions/pets.ts:92, src/app/api/upload/route.ts:32 and :108.

THE ACTUAL DECISION, which I want your reasoning on before the code: what principal should the
legacy cookie branch return? A synthetic ADMIN user makes the audit trail honest that a shared
secret was used, but it MUST be distinguishable from a real admin or the log lies the other
way. Propose the shape, say how a reader tells the two apart, then implement it.

Constraints:
- Do NOT weaken authentication. Same cookie name, same timing-safe comparison, same
  session-first-then-cookie order, same fail-closed catch.
- Do NOT remove the legacy branch. That is tracked separately as TARGET_SECRET_HARDENING 3.5.
- If a call site can now record a real actor in recordAuditLog, do it. That is the point.

Verify: npx tsc --noEmit, then
npx vitest run --project unit tests/unit/softDeleteAndAuth.test.ts tests/unit/upload.test.ts tests/unit/rbac.test.ts
Full suite baseline is 41 files / 524 tests. Add a test proving the legacy branch is
distinguishable from a sealed admin session in whatever the audit log receives.

Report any other authentication weakness you notice, but do not fix it in this task.
```

---

## If you dispatch both at once

They share no files, so parallel is safe. One rule, learned the hard way: **agents must not run
any git command.** During the five-agent restructure pass, a concurrent session committed agents'
in-flight edits and once restored the working tree underneath one, silently reverting a completed
move. Have them edit only, and commit yourself once both report.
