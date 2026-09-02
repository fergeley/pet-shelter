# 🟡 Target: Remove the legacy `admin_session` shared-secret branch

> **Scope**: closes `TARGET_SECRET_HARDENING.md` §3.5, the follow-on that target explicitly refused
> to roll into itself ("Do not roll the `admin_session` removal (§3.5) into this change"). Its two
> prerequisites have since landed: `verifyAdminSession()` names a principal (`1dfb8c9`) and the
> non-production bypass is gone ([`URGENT_NONPRODUCTION_ADMIN_BYPASS.md`](URGENT_NONPRODUCTION_ADMIN_BYPASS.md)).
>
> **Status**: 🟡 unstarted. Audited 2026-08-28 against `76de94f`; baseline `npm run test:all`
> **53 files / 710 tests**, `npx tsc --noEmit` clean.

**Run with `/remove-legacy-admin-token`** (`.claude/commands/`).

---

## 1. What is being removed

`src/lib/security/adminSession.ts:72` resolves an admin principal from two branches:

1. the signed, expiring, per-user session cookie — keep;
2. an `admin_session` cookie compared against `ADMIN_SECRET_KEY` — **remove**.

Branch 2 is a static bearer token with no expiry, no subject, and no revocation. When it matches, the
request is authorized as `LEGACY_ADMIN_TOKEN_PRINCIPAL` (`adminSession.ts:52`) with a genuine `ADMIN`
role. It guards `src/actions/pets.ts:100` and `src/app/api/upload/route.ts:34` and `:131`.

Hardening the secret makes that token harder to guess, not sound. The signed session is the whole
replacement.

---

## 2. The finding that changes the risk assessment

`TARGET_SECRET_HARDENING.md` §3.5 calls this "a behavioural change beyond this target". **Measured
against the tree, it is very nearly not one.**

**Nothing in `src/` ever issues that cookie.** The only two `cookieStore.set` calls in the codebase
are `src/lib/security/session.ts:69` and `:85`, both for `SESSION_COOKIE_NAME`. Grepping
`admin_session` across `src/` returns the reader in `adminSession.ts`, a doc comment in
`secrets.ts:116`, and one false positive: `src/lib/client/adminAuth.ts:7` holds
`hope_for_strays_admin_session`, a **localStorage** key with no relationship to the cookie.

So branch 2 is a door with no key-issuing office. It can only be exercised by someone setting the
cookie by hand with the shared secret — which is a legitimate operator path, but not one any UI,
action, or route creates. Confirm this yourself before relying on it; that is the first task below,
not an assumption to inherit.

---

## 3. The decision this needs, and it is not the deletion

Deleting the branch is mechanical. The real question is **what happens to `ADMIN_SECRET_KEY`.**

`assertSecretsConfigured()` (`src/lib/security/secrets.ts:158`) iterates
`[getSessionSecret, getAdminSecretKey, getStaffInviteSecret]` and throws in production if any is
unsafe. That boot check is deliberate and documented — `TARGET_SECRET_HARDENING.md` §2 explicitly
rejects lazy per-request validation because it "surfaces when nobody is watching".

Once the only consumer of `ADMIN_SECRET_KEY` is gone, three options, and **the answer is the
deliverable**:

| | Consequence |
|---|---|
| Drop the secret entirely | Fewest moving parts. A deploy still setting it gets no warning that it now does nothing. Touches `secrets.ts`, `.sops.yaml`, the runbook, and ~12 assertions in `tests/unit/secrets.test.ts`. |
| Keep it required at boot | Boot still fails without a secret that nothing reads — a false requirement, and the next reader has to rediscover why. |
| Keep the accessor, drop it from the boot check | Middle path. Needs a comment saying what still reads it, and if the answer is "nothing", this is option 1 with extra steps. |

Say which and why *before* writing code. Note that `.env.production.enc` (`8e61027`) carries this
value, and rotation is already outstanding — see [`TARGET_ENCRYPTED_ENV_COMMIT_DECISION.md`](TARGET_ENCRYPTED_ENV_COMMIT_DECISION.md) §3.
If the secret is being retired, retiring it is cheaper than rotating it.

---

## 4. Blast radius

Verified by grep at `76de94f`:

- `src/lib/security/adminSession.ts` — branch 2, `LEGACY_ADMIN_TOKEN_PRINCIPAL`, and the
  `AdminAuthMethod` union collapses to a single member `"session"`. Consider whether the type still
  earns its existence, and whether `AdminPrincipal` still needs `authMethod`.
- `src/lib/security/secrets.ts:116-120` — `getAdminSecretKey`, per §3.
- `tests/unit/softDeleteAndAuth.test.ts` — lines 133, 135, 148, 156, 195 set the cookie; line 327
  narrates it. These are the tests that prove the branch works; they become tests that prove it is
  gone.
- `tests/unit/secrets.test.ts` — ~12 `ADMIN_SECRET_KEY` assertions, only if §3 retires the secret.
- `tests/unit/upload.test.ts:17` mocks `verifyAdminSession` wholesale and is unaffected.

> **Already fixed, noted as an example of the pace here.** While this document was being written,
> `adminSession.ts:50` and `:84` cited a non-existent `docs/archives/tasks/TARGET_SECRET_HARDENING.md`.
> The parallel session corrected both to `docs/tasks/` within about two minutes. Verified: no
> `docs/archives/tasks` citation remains anywhere in `src/`. Nothing to do — re-check anyway, per
> trap 6.

---

## 5. Traps, all of them paid for in this repo

1. **Do not weaken the remaining branch.** Same cookie name, same `timingSafeCompare`,
   same session-first order, same fail-closed `catch`. The point is to remove an authorization path,
   never to loosen one.
2. **A guard you have not seen fail is not known to work.** Prove the removed path is really gone:
   set an `admin_session` cookie with the correct secret in a test and assert `verifyAdminSession()`
   now resolves `null`. That test is the deliverable, not a nicety.
3. **Do not run that proof in the shared working tree.** A second Claude session commits this branch
   with `git add -A`. On 2026-08-28 a deliberate type error, live for ~2 minutes across two tool
   calls, was read by it as a real gap and *committed* — an invented `adoption_events` FAQ category
   in the Zod enum, which left HEAD not typechecking until `4b06451`. Use a detached worktree:
   `git worktree add --detach <tmp> HEAD`, copy the files under test in, junction `node_modules`,
   run there, then `cmd /c rmdir` the junction **before** removing the worktree so the real
   `node_modules` survives.
4. **Commit with a pathspec.** `git add -- <paths>` then `git commit -F <msg> -- <the same paths>`,
   and check `git diff --cached --name-only` in a *separate* call first. The index is shared.
5. **Expect your work to land under someone else's message.** It has happened repeatedly; the
   category-label collapse of 2026-08-28 landed inside `c257681` / `63e6b94`. If
   `git diff --stat -- <your paths>` comes back empty, check `git show HEAD:<path>` before concluding
   anything was lost. Do not re-commit and do not amend its commit.
6. **Re-measure the baseline.** The numbers in §Scope were true at `76de94f` and this branch takes
   several commits an hour.

---

## 6. Dispatch prompt

```
In C:\Users\User\pet-shelter, remove the legacy `admin_session` shared-secret branch from
verifyAdminSession(), closing docs/tasks/TARGET_SECRET_HARDENING.md §3.5.

Read src/lib/security/adminSession.ts and docs/tasks/TARGET_LEGACY_ADMIN_TOKEN_REMOVAL.md
first.

verifyAdminSession() has two branches: a signed session cookie, and an `admin_session` cookie
compared against ADMIN_SECRET_KEY. Remove the second. It is a static bearer token with no
expiry, subject, or revocation, and it authorizes as a full ADMIN.

FIRST, verify and report this claim rather than trusting it: nothing in src/ ever SETS that
cookie — the only cookieStore.set calls are for SESSION_COOKIE_NAME in
src/lib/security/session.ts, and src/lib/client/adminAuth.ts holds a similarly-named
localStorage key that is unrelated. If that holds, removal is not the behavioural change the
older target feared. If it does not, stop and say so.

THEN THE ACTUAL DECISION, which I want your reasoning on before the code: what happens to
ADMIN_SECRET_KEY? assertSecretsConfigured() in src/lib/security/secrets.ts requires it at boot,
by design. Once nothing reads it, is it dropped entirely, kept required, or kept but removed
from the boot check? Weigh it against the fact that .env.production.enc carries the value and
its rotation is already outstanding. Propose, justify, then implement.

Constraints:
- Do NOT weaken the session branch: same cookie name, same timing-safe comparison, same
  session-first order, same fail-closed catch.
- Prove the path is gone with a test: set admin_session to the correct secret and assert
  verifyAdminSession() resolves null. Run any deliberate-breakage check in a detached git
  worktree, never in the shared tree — a parallel session commits this branch with `git add -A`
  and will commit your injected error as a real fix.
- Commit with a pathspec: `git add -- <paths>` then `git commit -F <msg> -- <the same paths>`.
  Check `git diff --cached --name-only` in a separate call first.

Verify: npx tsc --noEmit, npm run lint, then
npx vitest run --project unit tests/unit/softDeleteAndAuth.test.ts tests/unit/secrets.test.ts tests/unit/upload.test.ts tests/unit/rbac.test.ts
Baseline at 76de94f was 53 files / 710 tests for `npm run test:all` — re-measure it yourself
before quoting it, this branch moves fast.
```

---

## 7. Definition of done

- [ ] The reachability claim in §2 re-verified against the tree and reported, not assumed.
- [ ] The `ADMIN_SECRET_KEY` question in §3 answered in writing before any code changed.
- [ ] Branch 2 and `LEGACY_ADMIN_TOKEN_PRINCIPAL` gone; `AdminAuthMethod` / `AdminPrincipal`
      simplified or explicitly justified as-is.
- [ ] A test that sets the correct `admin_session` secret and asserts `null`.
- [ ] `tsc` clean, `lint` 0 errors, full suite green at or above the re-measured baseline.
- [ ] `TARGET_SECRET_HARDENING.md` §3.5 marked closed, naming the commit.
- [ ] Retrospective lessons appended to `tasks/lessons.md`.
