# A test that is green because infrastructure is absent is not green

**Learned:** 2026-09-03

**What happened:** four sponsor suites exercised the in-memory fallback path and passed.
They reached that path by accident: `src/lib/prisma.ts` defaults `DATABASE_URL` to
localhost, nothing was listening, so every call threw. On a machine where `DATABASE_URL`
*is* exported — and this repo's `.env.local` points it at a Neon **production** branch —
the registration cases would have run `prisma.sponsor.create` and
`prisma.sponsorContribution.updateMany` against it.

Separately, `isActive: false` was asserted in tests that constructed the record directly,
while no code path in `src/` ever wrote it. The tests proved the derivation worked; they
could not show the state was reachable, so a documented behaviour ("cancelling drops the
standing") had no implementation for weeks.

**How to apply:** two habits.
- If a suite's green depends on the *absence* of something, mock the boundary explicitly.
  Ask "what would this test do on a machine that has a database?" before trusting it.
- Before documenting behaviour that depends on a field's value, grep for what *writes*
  that value. Constructing a state in a fixture is not evidence that anything can produce
  it.

---
