# Every unauthenticated auth endpoint spends an address budget

**Decided:** 2026-09-08

Closes `tasks/open/auth-endpoints-still-keyed-on-the-email-alone.md`, opened the same day.

Five unauthenticated endpoints were rate-limited on the submitted email alone. That value is the
caller's to choose, so it bounds nothing: walking a shared secret needs only a fresh address per
guess, and a password spray never spends a second attempt on any one key. `loginAction` and
`registerAction` were fixed first; the remaining three are done here.

| Endpoint | Address budget | What it bounds |
|---|---|---|
| `loginAction` | `login` 20/min | Password spraying the staff directory |
| `registerAction` | `register` 10/min | Walking `STAFF_INVITE_SECRET` |
| `sponsorLoginAction` | `sponsor-login` 20/min | Password spraying the sponsor directory |
| `registerSponsorAction` | `sponsor-register` 10 per 5 min | Walking a receipt number |
| `acceptInvitation` | `accept-invite` 15/min | **Enumerating an emailed invite token** |

The last is the one that most needed it: the token *is* the credential, and the email beside it is
supplied by the caller, so the per-email budget reset on every guess.

## Where the helper lives, and why not where the open entry said

The open entry proposed `src/lib/security/rateLimit.ts`, on the grounds that it already owns limiter
keys. Rejected on inspection: that module is a pure sliding-window structure with eight
action-module consumers, its own standalone suite, and no framework imports. Adding `next/headers`
to it would make a request-scoped concern reachable from all of them and would couple the algorithm
to Next.

`src/lib/security/clientAddress.ts` composes the two instead. `rateLimit.ts` stays pure, and there
is exactly one copy of the header-trust reasoning rather than the five the per-site fix would have
produced — which is the duplication defect this repo keeps rediscovering.

## The API shape is a guard, not a convenience

`checkAddressRateLimit` returns `{limited: false} | {limited: true, retryAfterSeconds}`, not
`RateLimitResult | null`. A nullable return hands the "no trusted address" case to five call sites,
where reading null as *denied* locks every user out and reading it as *allowed* is a silent no-op
indistinguishable from a working limiter. Both mistakes are one character apart. Collapsing it to
`limited` makes the untrusted case read identically to an under-budget one at the call site, which
is exactly what it is: not limited, this time.

## The ceiling, restated because it is easy to lose

Where no proxy header is vouched for — no `TRUSTED_PROXY_HEADER`, not on Vercel — **none of these
budgets run**, and each endpoint's per-email budget is all that remains. Pinned by two tests, so it
is a documented property rather than an accident. A self-hosted deployment must set that variable
to get any of this.

Verified: each of the three new budgets was deleted in turn and its test observed failing.
`accept-invite` returned `Failed to activate your staff account.` on the seventeenth attempt with
the budget removed, and `Too many attempts.` with it in place.
