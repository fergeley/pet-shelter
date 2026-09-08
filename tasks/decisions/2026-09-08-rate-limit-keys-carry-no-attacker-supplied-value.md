# A rate-limit key that contains an attacker-supplied value limits nothing

**Decided:** 2026-09-08

`registerAction` was keyed `register:${email}` at 5/minute. `src/lib/security/secrets.ts` already
named the consequence, at `getStaffInviteSecret()`:

> the registration rate limit is keyed on `register:${email}` — an attacker-supplied value — so
> varying the email defeats it and leaves the code effectively enumerable.

The defect was documented in the codebase and unfixed. `staffInviteCode` is the only gate in front
of an account that reads applicant PII under PDPA 2010, and its JSDoc on `registerAction` said
`@deprecated Ignored` while the function enforced it four lines later.

## The fix that was asked for does not work

The task specified `register:${ip}:${email}`. **A composite key is a narrower key.** Every distinct
email still opens a fresh bucket, so a caller walking the invite code draws a full budget on every
request exactly as before; a distributed caller now gets one bucket per `(ip, email)` pair, which is
strictly more permissive than what it replaced.

Measured, not argued. `tests/unit/security/authSessionDal.test.ts` sends twelve invite-code guesses
from one address under twelve different emails. Against `register:${ip}:${email}`:

```
× stops a caller who varies the email on every invite-code guess
  AssertionError: expected 0 to be greater than 0
```

Zero of twelve throttled. Three sibling cases failed the same way.

## What was chosen

Two **independent** budgets, checked in sequence, neither containing the other's input:

- `register:ip:${ip}` — 10/minute. Contains nothing the caller supplies, so it is the one that
  bounds invite-code guessing.
- `register:email:${email}` — 5/minute. Kept; it bounds signup spam against one address.

`loginAction` had the identical shape (`login:${emailKey}`, which never spends a second attempt on
any key during a password spray) and got the same treatment at `login:ip:${ip}`, 20/minute. Fixing
one of two identical holes is how the next reader concludes the shape is acceptable.

## The address itself has to be trustworthy

`getClientIp()` reads `x-vercel-forwarded-for` and `x-real-ip` **before** `x-forwarded-for`.
`x-forwarded-for` is appended to by each hop, so when the client sends one of its own the leftmost
entry is attacker-chosen — reading it first would let a caller mint a fresh bucket per request and
reduce the budget above to decoration. Pinned by "prefers the platform header over a
client-supplied x-forwarded-for".

## Ceilings, marked in the source

- `checkRateLimit` is a per-process `Map`. On a serverless host each warm instance counts
  separately, so neither budget bounds a botnet. That needs shared state (Redis or Postgres) and is
  not a reason to leave the single-host case open.
- Behind a proxy setting neither platform header, `getClientIp` falls back to the leftmost
  `x-forwarded-for` and is only as trustworthy as that proxy. Anything stronger needs a configured
  trusted-hop count, which this deployment cannot express.
