# Three auth endpoints are still rate-limited on the email alone

**Status:** open · opened 2026-09-08

`loginAction` and `registerAction` were given an address budget on 2026-09-08
(`tasks/decisions/2026-09-08-rate-limit-keys-carry-no-attacker-supplied-value.md`). Three sibling
endpoints with the identical defect were not, because they were outside that task's write scope:

| Endpoint | Key | Why it matters |
|---|---|---|
| `src/actions/sponsors.ts:171` | `sponsor-login:${email}` | Password authentication. One password tried once against every sponsor address never spends a second attempt on any key, so the spray is unbounded. |
| `src/actions/sponsors.ts:71` | `sponsor-register:${email}` | Same shape as the registration hole that was fixed. |
| `src/actions/members.ts:485` | `accept-invite:${email}` | Gates **invite-token redemption**. Varying the email makes the token enumerable. |

Line numbers are as of `54c3147` and will drift; the keys are the durable identifier.

The commit that fixed the first two argued, in its own message, that *"leaving one of two identical
holes open is how the next reader concludes the shape is acceptable"* — and then left three. That
is the whole reason this entry exists rather than a silent omission.

**Not a copy-paste job.** The fix needs `getClientAddress()`, which is currently a module-private
helper in `src/actions/auth.ts`. Three more call sites make four, so it should move to a shared
module first — `src/lib/security/rateLimit.ts` already owns limiter keys and is the natural home.
Doing that is also what stops a fourth copy of the header-precedence reasoning, which is this
repo's top defect shape.

Note the ceiling that comes with it: the address budget only runs where a proxy header is trusted
(`TRUSTED_PROXY_HEADER`, or Vercel's edge). On a deployment with neither, moving these keys buys
nothing and the length of the secret is still carrying the weight.

**Settles when:** `getClientAddress` lives in a shared module and all three endpoints spend an
address budget alongside their existing per-email one, with a test per endpoint that fails against
the email-only key.
