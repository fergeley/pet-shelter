# Sponsor portal — self-critique remediation

Branch `worktree-sponsor-tiers`, following the critique of commit `048815c`.

Each item below was judged against Chesterton's Fence (what is this construct *for*?),
KISS, YAGNI and minimal-impact. **Seven of the twelve findings are deliberately not being
fixed** — the reasons are in §3, and they are the substantive half of this review.

---

## 1. Fix — storage boundary (one commit)

The three findings that are genuinely defects rather than scaling ceilings.

- [x] **Seed sponsors must not exist in production.**
  *Fence:* the seed exists so the app is demonstrable with zero infrastructure — the
  database has never been run here (see the unverified-Postgres note). That purpose is
  real and dev-only, so the fence stays and gets an environment lock rather than a
  demolition.
  *Fix:* `ensureInitialized()` seeds nothing when `NODE_ENV === "production"`.

- [x] **Stop conflating "query returned nothing" with "database unavailable"** (7 sites).
  *Fence:* copied from `serverStore.getServerPetsAsync`, where "no pets in the DB, show
  the demo pets" is a deliberate seeding convenience. For sponsors, empty is a legitimate
  answer — an empty wall, a sponsor with no pledges, a receipt that does not exist.
  *Fix:* the `try/catch` already distinguishes the two cases correctly. The bug is only
  the extra `if (rows.length > 0)` / `if (row)` guard *inside* the `try`. Deleting those
  guards is purely subtractive — no new abstraction, no probe helper.

- [x] **Receipt numbers: widen the space, stop swallowing write failures.**
  *Fence:* four digits keeps the number quotable over the phone on an LHDN tax receipt.
  That is a real constraint; do not replace it with a UUID.
  *Fix:* six digits (same shape, 100x the space) and a loud fallback log. Extract the
  generator, which is currently duplicated between `actions/donations.ts` and
  `lib/sponsorshipStore.ts`.
  *Not fixed here:* true uniqueness needs a sequence, not more entropy. That work already
  exists as `donationLedger.ts` on the TNRM branch — reinventing it here would be a second
  implementation of the same thing.

## 2. Fix — honesty (one commit)

- [x] **Caretaker Q&A actually delivers the message.** It currently validates,
  rate-limits, audits `messageLength` and returns success while discarding the body — and
  the UI tells the sponsor it was sent. No fence: I simply did not finish it. Changing the
  copy to hide it would be the temporary fix; dispatching it is the root fix.
- [x] **`billingFrequencyOf` mislabels a lapsed sponsor.** A cancelled monthly pledge and
  no one-off falls through to `return "one_time"` and reads "One-time pledges".
- [x] **Delete two dead `revalidatePath` calls.** Both targets became `force-dynamic`
  after they were written.
- [x] **Correct the guide** where it overstates the gate and the media's privacy, and
  record the scaling ceilings from §3 so they are known rather than hidden.

## 3. Deliberately NOT fixed

- **`gate()` counts locked items by loading them.** *Fence:* the count feeds "3 updates
  waiting" in the nudge — a real product purpose. The catalogue is a static JSON import,
  so there is no fetch to avoid. Adding a separate `countItems` callback to protect
  against a hypothetical future S3 migration is YAGNI. **The documentation was wrong, not
  the code** — fixing the sentence in §2 is the whole fix.
- **Dashboard reads every pet to resolve 1-3 rescues.** *Fence:* `getServerPetsAsync` is
  the codebase's only database-aware pet reader; `findServerPetById` is memory-only. The
  shelter has 8 pets. Optimising this is premature.
- **Sponsor wall scans all opted-in sponsors with their contributions.** Same call: 4
  sponsors today. SQL aggregation for a recognition page of this size is YAGNI. Both
  ceilings get documented instead.
- **Pet-page panel fetches for anonymous visitors.** *Fence:* the session cookie is
  `httpOnly`, so the client genuinely cannot know whether to skip. The proposed hint
  cookie adds a second source of truth about session state and a desync failure mode, to
  save a request that — verified — makes **zero** database queries when signed out, because
  `getSponsorContext` short-circuits on a null session. My original critique overstated
  this one.
- **No rate limit on the media route.** It is a read that costs nothing for anonymous
  callers, and the repo's limiter keys on email/sponsor id — there is no IP key to use
  without new infrastructure.
- **`__resetSponsorStoreForTests` ships in the bundle.** `userStore` already exports
  `resetUserStore` the same way. Diverging from an established repo convention to save a
  few bytes is not worth a second pattern.
- **`formatDate` runs client-side.** *Fence:* the dashboard's language comes from a client
  provider, so formatting *must* be client-side to be translatable. Moving it into the DTO
  would mean the server picking a language it does not know. This is the repo's existing
  i18n design, not a defect I introduced.

---

## 4. Review

Two commits, not the three originally proposed. The third was going to be "performance
items"; applying YAGNI to it left nothing worth doing.

- `f937eb2` — storage boundary. The seed is development-only, seven query sites stopped
  treating an empty result as an outage, receipt numbers widened to six digits from a
  single extracted generator, and every silent `catch` now logs.
- `8d1f90d` — honesty. Caretaker questions are delivered, `billingFrequencyOf` stops
  mislabelling a lapsed sponsor, two dead `revalidatePath` calls removed, and the guide
  no longer claims more than the code does.

**Verification:** 281 tests pass (up from 268), `tsc --noEmit` clean, `eslint` 0 errors
(3 pre-existing TanStack warnings), `npm run build` green with the route table unchanged —
pet profiles still SSG, sponsor routes still dynamic. Prerendered output still contains no
private media URL, and now contains no demo sponsor data either.

**Mutation-checked**, because a test that passes both before and after a fix proves
nothing: restoring the `rows.length > 0` guard on `listWallOptInSponsors` fails "does not
publish demo names on an empty public wall", and nothing else.

## 5. Independent code review (`7728925`)

`/code-review` on the full `master...HEAD` diff returned fifteen findings. Thirteen were
valid; two were narrower than stated. All are addressed or documented.

**The two critical ones shared a root cause** the self-critique had missed entirely:
`/donate` is a public, unauthenticated form with no payment gateway behind it, so a
submitted pledge is an *assertion* — and the ledger was treating it as money received.

1. **Self-granted Gold.** `amountMYR: 1200` (or `monthly` x 100, annualised on the spot)
   opened every Gold gate on the next request.
2. **Account takeover.** The form mints a receipt for any email typed into it and returns
   the number in its own response, so the account-claim challenge could be self-issued.
   The attacker inherited the victim's history, standing, rescues and gated media.

Both closed on one concept: contributions default to `PENDING`; only `CONFIRMED` ones
confer a standing or satisfy the claim. Confirming is a staff act the claimant cannot
perform, which is what removes the first step from both attacks.

**Also fixed:** tests could write to the production database; `isActive: false` was
unreachable so documented decay could not happen; consent withdrawal reported success on a
failed write; consent was sticky via `||`; sponsor and staff tokens were interchangeable;
production `createSponsor` fabricated an account then issued it a session; the wall loaded
every listed sponsor's password hash; receipt months were UTC beside a Malaysia-time date;
video links pointed at the iframe endpoint; a dead duplicate `id` survived the
`[data-print-root]` migration.

**Narrower than reported, verified rather than assumed:** the `Pet` foreign key does not
mismatch cuids (`prisma/seed.ts` upserts pets under their `pet-001` ids), though it does
reject dedicated pledges against a reachable *unseeded* database — now documented. And the
token confusion could not reach the admin console: `verifyAdminSession` checks role, not
presence.

**What this says about the self-critique in section 4.** It was thorough, applied the
principles honestly, and still missed the worst bug on the branch — in the single mechanism
it had defended most explicitly. Recorded in `tasks/lessons.md` and in memory: confidence
marks a thing as already-checked, and an independent review is not optional on
security-shaped work.

---

### What the principles actually changed

Applying them was not a formality — it altered the outcome in three places.

1. **Chesterton's Fence saved the fallback.** The obvious reading of the auth bypass is
   "the memory store is dangerous, remove it". Its purpose is real: this repo has never
   run the sponsor tables against Postgres, and the seed is what makes the portal
   demonstrable. The fence stayed; only the credentials left.
2. **KISS made the main fix subtractive.** The first instinct was an
   `isDatabaseReachable()` probe. But `try/catch` already draws that line correctly — the
   bug was an extra guard *inside* the `try`. Deleting seven conditions beat adding an
   abstraction.
3. **YAGNI caught a misdiagnosis.** I had filed `gate()` loading items on the locked path
   as a code defect. It is not: the catalogue is a static import, the count feeds a real
   product string, and the only thing wrong was a sentence in my own guide. Fixing the
   code would have added a callback to defend against a migration nobody has planned.
