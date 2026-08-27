---
description: Change verifyAdminSession to return a principal instead of a boolean, so privileged mutations can record who acted
---

Change `verifyAdminSession()` so privileged mutations can record **who** acted.

Read `src/lib/security/adminSession.ts` and `docs/tasks/TARGET_SECRET_HARDENING.md` §3.5 first.
Full background: `docs/tasks/TARGET_RESTRUCTURE_FOLLOWUPS.md` §2.

## The problem

`src/lib/security/adminSession.ts:12` returns `Promise<boolean>` from two branches:

- a **sealed session**, which knows the user and their `ADMIN` / `COORDINATOR` role
- a **legacy `admin_session` cookie** compared against `ADMIN_SECRET_KEY`, which knows nothing

Two consequences:

1. The legacy branch bypasses RBAC **granularity**, not just expiry — it returns bare `true` with
   no role, so anyone holding `ADMIN_SECRET_KEY` gets whatever the *most* privileged caller can do.
2. Callers cannot name an actor in the audit log, though `docs/architecture/LAYERS.md` §9.5
   requires `recordAuditLog` on every privileged mutation.

## The task

Return `Promise<SessionUser | null>` and update all three call sites:
`src/actions/pets.ts:92`, `src/app/api/upload/route.ts:32`, `src/app/api/upload/route.ts:108`.

## The actual decision — reason about this before writing code

**What principal should the legacy cookie branch return?** A synthetic `ADMIN` user makes the audit
trail honest that a shared secret was used — but it MUST be distinguishable from a real admin, or
the log lies in the other direction.

Propose the shape, state how a reader tells the two apart, then implement it.

## Constraints

- **Do NOT weaken authentication.** Same cookie name, same timing-safe comparison, same
  session-first-then-cookie order, same fail-closed `catch`.
- **Do NOT remove the legacy branch.** That is tracked separately as `TARGET_SECRET_HARDENING` §3.5.
- If a call site can now record a real actor in `recordAuditLog`, do it. That is the point of the
  change.

## Verify

```bash
npx tsc --noEmit
npx vitest run --project unit tests/unit/softDeleteAndAuth.test.ts tests/unit/upload.test.ts tests/unit/rbac.test.ts
```

Full-suite baseline: 41 files / 524 tests.

Add a test proving the legacy branch is **distinguishable** from a sealed admin session in whatever
the audit log receives.

Report any other authentication weakness you notice — but do not fix it in this task.
