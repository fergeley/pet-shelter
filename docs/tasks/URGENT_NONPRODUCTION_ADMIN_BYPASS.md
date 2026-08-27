# 🔴 URGENT — Admin pet mutations do not authenticate outside production

**Date**: 2026-08-28
**Branch**: `feat/tnrm-rehabilitation`
**Found at**: `1dfb8c9`, while implementing `/fix-admin-session`
**File**: `src/actions/pets.ts`, `getAdminActorOrThrow()` (line 102)

> This is not the `/fix-admin-session` work — that landed at `1dfb8c9`. This is the weakness that
> task found and was explicitly told to report rather than fix, so the bypass was **preserved
> exactly** and is untouched. It is separated on purpose: naming the actor was a correctness fix to
> the audit trail, and this is an authentication hole. The second should not have been carried
> inside the first.

---

## 1. What is wrong

### 1.1 🔴 One line decides whether five privileged actions authenticate at all

`src/actions/pets.ts:102-115`. `verifyAdminSession()` returns `null` when nothing authorised the
request. Then:

```ts
if (process.env.NODE_ENV === "production") {
  throw new Error("Unauthorized: Admin authorization required");
}

return DEV_BYPASS_PRINCIPAL;   // role: "ADMIN"
```

Read it inverted, which is how it behaves: **in any build that is not production, an
unauthenticated caller is handed an `ADMIN` principal and the mutation proceeds.**

The check is not "is this caller an admin". It is "is this caller an admin, **or** is this build
not production".

### 1.2 Five exported Server Actions reach it

Server Actions are network-reachable POST endpoints, not internal helpers:

| Action | Line | Effect |
|---|---|---|
| `createPet` | `src/actions/pets.ts:121` | inserts a pet |
| `updatePet` | `:182` | overwrites a pet, including nested history |
| `toggleArchivePet` | `:243` | soft-deletes / restores |
| `deletePet` | `:264` | delegates to `toggleArchivePet`, inherits it |
| `updatePetStatus` | `:273` | moves a pet through the status state machine |

Each writes an audit row naming `unauthenticated@dev-bypass.invalid`. That identity landed in
`1dfb8c9` and is the only reason this is legible at all — before it, these writes were recorded as
`Shelter Administrator <admin@hopeforstrays.org>`, indistinguishable from a real administrator.

### 1.3 Where it is, and is not, open

State this precisely; overstating it will get the fix deprioritised when someone checks.

**Not open in a correct production deploy.** `npm run build` → `next build` and `npm start` →
`next start` both set `NODE_ENV=production`, so the throw fires.

**Open everywhere else**, and these are real:

- `npm run dev` reachable on a LAN, a forwarded port, or a tunnelled preview — a demo, a
  stakeholder review.
- Any staging or preview environment not running a production build.
- Any container or CI job that leaves `NODE_ENV` unset. The check is `=== "production"`, so *unset*
  is a bypass.
- `NODE_ENV=test` — which is why §2 exists.

The exposure is not "an attacker on the internet". It is "anyone who can reach a non-production
instance can rewrite the pet catalogue, and the audit row will say nobody was signed in".

---

## 2. Root cause — and the fence around it

The line is not a typo. It is a deliberate escape hatch that has outlived whatever made it
reasonable, and **it is currently load-bearing for the test suite.**

Deleting the fallback so it always throws was run against the suite before writing this:

```
Test Files  2 failed | 41 passed (43)
     Tests  11 failed | 534 passed (545)
```

All 11 failures are in two files:

- `tests/unit/petHistory.test.ts` — 8 tests, under `Admin Pet Mutations` and
  `Synthetic Timeline Fallback`
- `tests/unit/rehabilitation.test.ts` — 3 tests, under `Admin Pet Mutations`

Every one calls `createPet` / `updatePet` / `updatePetStatus` **without establishing a session**,
and passes today only because the bypass hands it an `ADMIN`.

That fallout is the actual task. The one-line removal is trivial; resolving these 11 without
quietly relocating the hole is not.

`tests/unit/softDeleteAndAuth.test.ts` is the counter-example that does *not* depend on the bypass —
it seals a real session cookie in `beforeEach` and mutates as a genuine admin.

---

## 3. Do this

1. Remove the `NODE_ENV` branch so `getAdminActorOrThrow()` always throws when
   `verifyAdminSession()` returns `null`.
2. Delete `DEV_BYPASS_PRINCIPAL` and the `"dev-bypass"` member of `AdminAuthMethod` from
   `src/lib/security/adminSession.ts`. Both exist only to name this hole.
3. **Decide how a test authenticates, and say why before writing code.** Two candidates:
   - **Seal a real session per suite**, as `softDeleteAndAuth.test.ts` does. Highest fidelity — the
     tests then exercise the real gate — but it is 11 tests across two files, and every future
     admin-mutation test must remember the ceremony.
   - **A shared test helper** so it is one line and the next author falls into the pit of success.

   Option 2 is probably right, given a third file will want it tomorrow, but that is a call to
   justify rather than assume. Whichever is chosen, the property to hold is: **a test must not be
   able to mutate without authenticating.** If the suite can still do it, nothing was fixed.
4. Consider throwing `UnauthorizedError` from `@/lib/security/rbac` instead of a bare `Error`. The
   typed error already exists and is what the rest of the RBAC layer raises.

---

## 4. Verification

```bash
npx tsc --noEmit
npx vitest run --project unit
```

Baseline when this was written: **43 files / 545 tests**, all passing. That count *will* have
moved — two other work streams are active on this branch — so re-establish it before starting
rather than trusting this number.

The suite alone does not prove the hole is closed. Also:

```bash
npm run dev
# With no session cookie and no admin_session cookie, POST to a pet mutation.
# It must be refused. Before this change it succeeds.
```

Report what you actually saw.

---

## 5. Explicitly not in this task

- **Do not weaken `verifyAdminSession()`.** It was just changed in `1dfb8c9`. The sealed-session
  branch, the legacy-token branch, the timing-safe comparison and the fail-closed `catch` all stay.
- **Do not touch `LEGACY_ADMIN_TOKEN_PRINCIPAL`.** It is a different concern — removing the legacy
  shared-secret branch is [`TARGET_SECRET_HARDENING.md`](../archives/tasks/TARGET_SECRET_HARDENING.md)
  §3.5.
- **Do not make the 11 tests green by deleting them, loosening their assertions, or mocking
  `verifyAdminSession` to always pass.** Each of those moves the hole rather than closing it.

---

## 6. ⚠️ Coordination

This branch has concurrent sessions committing to it.

- The bypass lives in `src/actions/pets.ts` and `src/lib/security/adminSession.ts`; the test fallout
  is in `tests/unit/petHistory.test.ts` and `tests/unit/rehabilitation.test.ts`. None of those were
  in flight elsewhere at `ccb8426`, but re-check before starting.
- Another session leaves files staged in the shared index. Check `git diff --cached` **before**
  staging, and commit by pathspec (`git commit -- <paths>`) so its work is not swept into yours.
- The tree is CRLF with `core.autocrlf=true`. Multi-line patches keyed on `\n` silently match
  nothing — normalise, patch, assert every replacement, restore.

---

## 7. Adjacent findings — noticed at `1dfb8c9`, not part of this task

Recorded here rather than in their own document because they are each a few lines, and whoever picks
up the admin-authentication work is who should see them.

### 7.1 `tests/unit/upload.fixes.test.ts` asserts nothing about the route

Its `Authentication` block (lines 18-31) builds a local `vi.fn()`, resolves it, and asserts it
returned what it was just told to return:

```ts
mockVerifyAdminSession.mockResolvedValue(false);
// In actual route, this would check verifyAdminSession()   <- the comment admits it
await expect(mockVerifyAdminSession()).resolves.toBe(false);
```

No route code is imported or executed, so the two tests named "should return 403 when user is not
authenticated" and "should allow upload when user is authenticated admin" would both still pass if
`/api/upload` dropped its auth check entirely. They are also now shape-stale: they mock `true` /
`false`, and `verifyAdminSession()` returns `AdminPrincipal | null` since `1dfb8c9`.

`tests/unit/upload.test.ts` exercises the real `POST` / `DELETE` handlers and is the pattern to
follow. Fixing this means writing genuine 403 tests, not adjusting the mock.

### 7.2 Two dangling `docs/tasks/` references in `src/`

The archive reorganisation moved several specs to `docs/archives/tasks/`. Two source comments still
point at the old paths:

- `src/lib/security/secrets.ts:6` → `docs/tasks/TARGET_SECRET_HARDENING.md`
- `src/lib/domain/shelterIdentity.ts:13` → `docs/tasks/HANDOFF_SECURITY_REHAB_AND_HISTORY.md`

Deliberately left alone: at the time of writing the rename was **staged but not committed**, so the
destination path was not settled and repointing them would have been a guess. Re-check whether the
move landed before touching these. (`secrets.ts:149` also names the spec, but as a bare filename
with no path — that one is fine either way.)

---

## 8. Dispatch prompt

```
In C:\Users\User\pet-shelter, close the non-production admin bypass.

Read docs/tasks/URGENT_NONPRODUCTION_ADMIN_BYPASS.md first, then
src/actions/pets.ts:102-115.

getAdminActorOrThrow() throws only when NODE_ENV === "production". Every other build hands an
unauthenticated caller DEV_BYPASS_PRINCIPAL, which carries role ADMIN, and five exported Server
Actions reach it: createPet, updatePet, toggleArchivePet, deletePet, updatePetStatus.

Remove the bypass so it always throws, and delete DEV_BYPASS_PRINCIPAL and the "dev-bypass"
member of AdminAuthMethod from src/lib/security/adminSession.ts. Leave
LEGACY_ADMIN_TOKEN_PRINCIPAL alone -- that is a separate concern, tracked elsewhere.

THE ACTUAL WORK IS THE FALLOUT, and I want your reasoning before the code. Removing the line
fails 11 tests: 8 in tests/unit/petHistory.test.ts and 3 in tests/unit/rehabilitation.test.ts.
They call admin mutations without establishing a session and pass only because of the bypass.
tests/unit/softDeleteAndAuth.test.ts shows the pattern that does not -- it seals a real session
cookie in beforeEach.

Decide: seal a session per suite, or add a shared test helper so the next author falls into the
pit of success? Propose it, say why, then implement. Do NOT make those 11 green by deleting
them, loosening assertions, or mocking verifyAdminSession to always pass -- each moves the hole
instead of closing it.

Consider throwing UnauthorizedError from @/lib/security/rbac instead of a bare Error.

Verify: npx tsc --noEmit, then npx vitest run --project unit. Re-establish the baseline count
first; other work streams are active on this branch and it moves.

Then run the app and prove an unauthenticated pet mutation is actually refused. The unit suite
does not prove that on its own. Report what you saw.
```
