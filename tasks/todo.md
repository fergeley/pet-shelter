# Sponsor portal — self-critique remediation

Branch `worktree-sponsor-tiers`, following the critique of commit `048815c`.

Each item below was judged against Chesterton's Fence (what is this construct *for*?),
KISS, YAGNI and minimal-impact. **Seven of the twelve findings are deliberately not being
fixed** — the reasons are in §3, and they are the substantive half of this review.

---

## 1. Fix — storage boundary (one commit)

The three findings that are genuinely defects rather than scaling ceilings.

- [ ] **Seed sponsors must not exist in production.**
  *Fence:* the seed exists so the app is demonstrable with zero infrastructure — the
  database has never been run here (see the unverified-Postgres note). That purpose is
  real and dev-only, so the fence stays and gets an environment lock rather than a
  demolition.
  *Fix:* `ensureInitialized()` seeds nothing when `NODE_ENV === "production"`.

- [ ] **Stop conflating "query returned nothing" with "database unavailable"** (7 sites).
  *Fence:* copied from `serverStore.getServerPetsAsync`, where "no pets in the DB, show
  the demo pets" is a deliberate seeding convenience. For sponsors, empty is a legitimate
  answer — an empty wall, a sponsor with no pledges, a receipt that does not exist.
  *Fix:* the `try/catch` already distinguishes the two cases correctly. The bug is only
  the extra `if (rows.length > 0)` / `if (row)` guard *inside* the `try`. Deleting those
  guards is purely subtractive — no new abstraction, no probe helper.

- [ ] **Receipt numbers: widen the space, stop swallowing write failures.**
  *Fence:* four digits keeps the number quotable over the phone on an LHDN tax receipt.
  That is a real constraint; do not replace it with a UUID.
  *Fix:* six digits (same shape, 100x the space) and a loud fallback log. Extract the
  generator, which is currently duplicated between `actions/donations.ts` and
  `lib/sponsorshipStore.ts`.
  *Not fixed here:* true uniqueness needs a sequence, not more entropy. That work already
  exists as `donationLedger.ts` on the TNRM branch — reinventing it here would be a second
  implementation of the same thing.

## 2. Fix — honesty (one commit)

- [ ] **Caretaker Q&A actually delivers the message.** It currently validates,
  rate-limits, audits `messageLength` and returns success while discarding the body — and
  the UI tells the sponsor it was sent. No fence: I simply did not finish it. Changing the
  copy to hide it would be the temporary fix; dispatching it is the root fix.
- [ ] **`billingFrequencyOf` mislabels a lapsed sponsor.** A cancelled monthly pledge and
  no one-off falls through to `return "one_time"` and reads "One-time pledges".
- [ ] **Delete two dead `revalidatePath` calls.** Both targets became `force-dynamic`
  after they were written.
- [ ] **Correct the guide** where it overstates the gate and the media's privacy, and
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

*(filled in after implementation)*
