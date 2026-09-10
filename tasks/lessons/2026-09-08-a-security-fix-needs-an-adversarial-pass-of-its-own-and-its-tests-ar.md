# A security fix needs an adversarial pass of its own, and its tests are not it

**Learned:** 2026-09-08

Four inert security controls were repaired, each with tests written alongside, each test mutation-checked
against the *wrong* fix and observed failing. All of it passed. A review of the finished diff then found
that **two of the repairs had introduced the very defect they removed**:

- The new TLS host test read `startsWith("127.") || !host.includes(".")`. An IPv6 literal contains no
  dot, so `[2001:db8::1]` was classified internal and a public IPv6 database got **no TLS at all** —
  the plaintext hole the function existed to close, moved into the fix. `10.0.1.5` and
  `postgres.default.svc.cluster.local` went the other way and were forced to present a public CA.
- The new rate limiter keyed on `x-real-ip`, documented as "written by the edge and overwrites anything
  the client sent". True on Vercel; false on the `docker-compose` deployment this repo ships. The budget
  added to stop an attacker resetting a key was keyed on a value the attacker sets. Its `"unknown"`
  fallback also capped the entire shelter at twenty sign-ins a minute.
- The session-revocation fix routed its fallback through a store whose in-memory seed holds five
  hardcoded accounts, so deleting `usr-admin-01` — SUPER_ADMIN, compile-time password — revoked nothing.
  The hole was closed everywhere except the five ids where it mattered most.

Each test passed because it exercised the case its author was *thinking about*: `sslmode=require` but
never IPv6, a deleted synthetic id but never a seeded one, a header assumed trustworthy rather than
probed. Mutation testing does not help here — it proves the test discriminates against the fix you
considered, not against the case you never imagined.

**Rule:** after finishing a security change, run `/code-review` over the resulting diff and treat your
own new code as the primary suspect, not the code it replaced. Then verify each finding by probe before
accepting *or* dismissing it — of the fifteen raised here, the three most serious were confirmed by a
throwaway test that took two minutes, and that evidence is what made them safe to act on.

**Corollary for the tests:** enumerate the input *space*, not the inputs you have in mind. For a host
classifier that means both address families, the private ranges, and a name that merely resembles one.
For anything reading a request header it means asking who is allowed to write that header on each
deployment shape the repo actually ships. See
[[2026-09-08-review-corrected-three-of-the-same-days-security-decisions]].
