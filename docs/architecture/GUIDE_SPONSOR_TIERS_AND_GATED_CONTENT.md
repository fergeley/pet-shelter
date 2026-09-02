# Sponsor Standings, Tier Gates & the Sponsor Portal

How Bronze / Silver / Gold works, why standings are derived rather than stored, and the
one rule every gate in this codebase follows.

---

## 1. Two tier axes, deliberately kept apart

The platform has two things called a "tier". They are orthogonal and must not be merged.

| | `SponsorshipTierId` | `SupporterTier` |
|---|---|---|
| Where | `src/types/sponsorship.ts` | `src/types/supporter.ts` |
| Values | `kibble`, `vaccine`, `spay_neuter`, `emergency_medical`, `custom` | `BRONZE`, `SILVER`, `GOLD` |
| Meaning | The **purpose fund** a donor buys | The **standing** a donor earns |
| Chosen by | The donor, at checkout | Nobody — derived from the ledger |
| Persisted | Yes, on each contribution | **Never** |

A single RM 250 emergency-medical pledge and five RM 50 vaccine pledges land the donor on
the same standing. Collapsing these two axes would have broken the donate page, the
receipt emails and the existing donation tests, all of which are keyed on the purpose-fund
IDs.

---

## 2. How a standing is derived

`src/lib/domain/supporterTier.ts` is pure and has no I/O. Everything below is unit-tested
in `tests/unit/supporterTier.test.ts`.

**The branch owns accounts, not commitments.** `PetSponsorship` in
`src/lib/server/sponsorshipLedger.ts` is the record of a supporter's commitment to fund an
animal; this feature adds `Sponsor` (the portal account) and populates the `userId` column
that ledger reserved for it. Standings are derived by joining the two — there is no second
store of commitments. See
`tasks/decisions/2026-09-03-sponsor-state-annotates-the-ledger.md`.

**Only reconciled commitments count.** `/donate` is a public, unauthenticated form with no
payment gateway behind it — DuitNow QR and bank transfers arrive out of band — so a
submitted pledge is an *assertion*, not money received. Every commitment starts
`PENDING_PAYMENT`; a coordinator reconciles it against money that arrived via
`reconcilePetSponsorshipAction`, which is what assigns a receipt number. Without that
split, the checkout form would be a self-service Gold button: anyone could assert an
RM 1,200 pledge and unlock every gate on the next request. `countsTowardFunding` in
`src/lib/domain/petSponsorship.ts` is the single rule for "does this count", reused by
tier derivation rather than restated.

**Recognised contribution** — a rolling 12-month figure (`RECOGNITION_WINDOW_DAYS = 365`):

- A **one-time** pledge counts at face value if it falls inside the window, and stops
  counting the day it leaves.
- An **active monthly** pledge counts at its *annualised* value (`amount x 12`) from the
  day it starts.
- A **cancelled monthly** pledge counts for nothing, at any age.

Monthly pledges are stored as one row, not one row per charge, so the two branches never
double-count.

**Thresholds** (`TIER_THRESHOLDS_MYR`):

| Standing | Recognised 12-month contribution | Equivalent recurring pledge |
|---|---|---|
| Bronze | RM 50 | — |
| Silver | RM 300 | RM 25 / month |
| Gold | RM 1,200 | RM 100 / month |

Annualising recurring pledges is the mechanism that serves the retention goal: a donor who
commits to RM 100/month is Gold immediately, not in twelve months' time. The corollary is
deliberate and should be stated in donor-facing copy — **cancelling a recurring pledge
drops the standing at once**, because a standing describes a current relationship rather
than a lifetime trophy. Sponsors cancel their own pledges through
`cancelRecurringPledgeAction`, which is scoped to their session so a receipt number in the
request cannot reach anyone else's ledger.

### Why derived and never stored

There is intentionally no `supporterTier` column anywhere in `prisma/schema.prisma`. A
stored tier is a second source of truth that drifts from the contributions justifying it,
and it is a value an attacker would try to write. Deriving it on every read makes it
un-forgeable and eliminates a whole class of reconciliation bugs.

The sponsor session cookie carries **identity only** — never the standing.

---

## 3. The gate rule

> **A gate decides before the protected payload is produced.**

Not "renders it conditionally". *Produced.* Anything a server has already loaded to build
a component's props has left the vault, whatever the render tree does with it afterwards.

`src/lib/domain/sponsorAccess.ts` is the single authorization boundary. Its gated readers
return a discriminated union:

```ts
type GatedPayload<T> =
  | { locked: true;  requiredTier; currentTier; lockedCount: number }
  | { locked: false; requiredTier; currentTier; items: T[] }
```

The locked branch has **no `items` key at all**. That absence — not a CSS class, not a
conditional render — is the security property: nothing an under-tier caller receives
contains a URL, and TypeScript refuses code that tries to read one.

One honest caveat. `gate()` *does* read the catalogue on the locked path, to put a count
in the nudge ("3 updates waiting"). Today the catalogue is a static JSON import, so this
costs nothing and releases nothing. But if it ever becomes a database or object-store
read, that count would fetch the very records it is withholding — so give `gate()` a
separate count source at that point rather than reusing the loader.

The private media lives in `src/data/exclusiveMedia.json`, reachable only through
`sponsorAccess`, which is marked `server-only`.

**The gate is real; the current media is not actually secret.** The catalogue holds public
Unsplash URLs and public YouTube ids, which anyone can construct without going near the
gate. That is fine for seed data and wrong for production: real exclusive media needs
signed, short-lived URLs, or one shared link bypasses every check on this page.

### `<TierGate>` and what it cannot do for you

`src/components/features/sponsors/TierGate.tsx` is an async **Server Component**. It must
stay one: as a Client Component its `children` would already be serialized into the RSC
payload before the gate ran.

Even as a Server Component it controls only *rendering*, not what the caller fetched.
This is safe:

```tsx
<TierGate requiredTier="GOLD">
  <VideoDiary petId={pet.id} />   {/* fetches inside, only when rendered */}
</TierGate>
```

and this leaks, because the URL is loaded before the gate ever runs:

```tsx
const videos = await loadPrivateVideos(pet.id)   // already fetched
<TierGate requiredTier="GOLD"><VideoList videos={videos} /></TierGate>
```

For genuinely sensitive payloads, use `getGatedPetVideoDiary` / `getGatedPetGallery`
instead of relying on the component.

### Server Actions re-authorize

`<TierGate>` is presentation. A Server Action is a public HTTP endpoint, so
`submitCaretakerQuestionAction` re-checks Gold on every call rather than trusting that the
form was rendered. `tests/unit/sponsorAuth.test.ts` calls it directly as a Silver sponsor
and asserts the refusal.

---

## 4. Why the pet profile gates through a Route Handler

`src/app/pets/[id]/page.tsx` declares `generateStaticParams`, so every pet profile is
prerendered. Reading `cookies()` anywhere in that render tree would force all of them to
render per-request — trading every static profile page for one gated panel.

So the panel (`PetExclusiveMediaPanel`) fetches
`GET /api/sponsor/pet-media/[petId]` from the browser instead. Two benefits:

1. The page keeps its prerendering — nothing in its tree reads cookies.
2. Locked media is not in the page **at all**. There is no hidden element to unhide and no
   RSC payload entry to read; an under-tier visitor's HTML genuinely does not contain the
   URLs.

The dashboard, which is already per-request, uses the server `<TierGate>` directly. Both
forms of the gate are therefore exercised.

---

## 5. Sponsor accounts

### A separate session namespace

Sponsor sessions use `hope_sponsor_session` (`src/lib/security/sponsorSession.ts`), not the
staff `hope_shelter_session`. Two reasons:

1. Sharing one cookie would mean a caretaker who donates gets signed out of the admin
   console.
2. `loginAction` in `src/actions/auth.ts` accepts the literal password `"1234"` for any
   account (`src/actions/auth.ts:64`). Reusing that cookie or that code path would extend a
   development backdoor to every sponsor account.

`sponsorLoginAction` verifies password hashes only. There is a regression test
(`does NOT accept the staff development password '1234'`) whose job is to stop a future
"let's unify the auth" refactor reintroducing it.

### Claiming an account: the receipt-number challenge

Donation is a public form, so almost every contribution starts life unattached to any
account, keyed only by donor email.

That makes email alone unsafe as a claim credential: registering with
`someone-else@example.com` would inherit their standing, their sponsored rescues and their
Gold media. So registration requires a **receipt number** issued to that email
(`HFS-DON-YYYYMM-NNNN`), which is delivered only in the donor's own e-Receipt. On success,
every contribution under that email is linked to the new account.

Missing and mismatched receipts return an identical error message, so the form cannot be
used to enumerate valid receipt numbers.

**The commitment must also be `ACTIVE`**, and that requirement is doing most of the work.
Matching the email alone proves nothing: sponsorship checkout is public and hands the
caller back the `pledgeRef` it just minted, so an attacker could pledge RM 10 as
`victim@example.com` and quote it to claim the victim's entire history, standing and gated
media. A *receipt number* is only assigned at reconciliation — a coordinator's act, not the
claimant's — which is what breaks that chain.

**Known limitation.** A confirmed receipt number is still a shared secret rather than a
verified identity — a donor who forwards their e-Receipt has given away their claim.
Verified-email sign-up is the proper fix and is deliberately deferred; the exposure is
bounded because the portal projects no tax identifiers, no payment details and no other
donor's data.

### Sponsor Wall consent

Consent is captured **on the pledge**, not on an account, because most donors have no
account when they give. `SponsorContribution.displayOnWall` records the checkout tick, and
`registerSponsorAction` carries it into the account at claim time. Sponsors can withdraw it
at any time from the portal.

The wall (`/sponsors`) applies two filters server-side — opted in, *and* holds a standing —
and projects to name plus tier plus join year. Amounts, emails, tax numbers and pet
dedications never reach the page; `tests/unit/sponsorAccess.test.ts` asserts their absence
in the serialized output.

---

## 6. The e-Certificate

Printable HTML at `/sponsor/certificate`, not `@react-pdf/renderer` and not Canvas:

- The browser's own print-to-PDF yields a real PDF with selectable, searchable,
  screen-reader-legible text. A Canvas certificate is a picture of words.
- It reuses the `[data-print-root]` print mechanism in `globals.css` that the donation
  receipt already uses, rather than adding a second way to print.
- It adds no dependency to a project that already prints receipts this way.

`getSponsorCertificate()` returns `null` below Silver, so an under-tier request never
produces a certificate to intercept. Every printed field is computed server-side from the
verified standing; nothing is derived in the browser.

Certificate numbers are derived from the sponsor id, so a reprint of the same year's
certificate carries the same number.

---

## 7. Storage and the memory fallback

`src/lib/sponsorStore.ts` follows the Prisma-first / memory-fallback shape already used by
`userStore` and `serverStore`, so the portal is demonstrable and testable without Postgres
running.

One consequence worth knowing before that first run: `SponsorContribution.targetPetId` is
a foreign key to `Pet`, but `getServerPetsAsync` serves `src/data/pets.json` whenever the
`Pet` table is empty. Against a reachable-but-unseeded database the UI therefore offers
pets that do not exist as rows, and a dedicated pledge is FK-rejected — logged by
`warnDatabaseFallback` and demoted to memory rather than lost silently, but still not in
the ledger. Run `npm run db:seed` (which upserts pets under their `pet-001` ids) before
accepting dedicated pledges.

**The sponsor tables have not yet been exercised against a real PostgreSQL instance.** The
schema validates (`prisma validate`) and the client generates, but no migration has been
applied and no query has run against a live database — every test here runs the in-memory
path. Before deploying, run `npm run db:push` against a non-production Neon branch and
re-run the suite with `DATABASE_URL` pointed at it.

### Known scaling ceilings

Both are deliberate. The shelter has 8 pets and a handful of sponsors, and neither of
these is a correctness problem — they are recorded so the next person meets them as a
decision rather than a surprise.

- `getSponsorDashboard` calls `getServerPetsAsync()` — every pet in the shelter — to
  resolve one to three sponsored rescues, because `getServerPetsAsync` is the only
  database-aware pet reader in the codebase (`findServerPetById` is memory-only).
  `getSponsorCertificate` inherits this, since it reuses the dashboard projection purely
  for rescue names. Wants `findMany({ where: { id: { in: [...] } } })` somewhere north of
  a few hundred pets.
- `getSponsorWall` loads every opted-in sponsor with their full contribution list and
  derives standings in JavaScript, on a `force-dynamic` page. Wants SQL aggregation, or a
  cached page with tag invalidation, somewhere north of a few thousand sponsors.

### Demo sponsors (development only)

| Email | Password | Standing | Why |
|---|---|---|---|
| `bronze@example.com` | `bronze123` | Bronze | RM 50 recent, plus an RM 250 pledge aged past the window |
| `silver@example.com` | `silver123` | Silver | RM 250 + RM 120, both inside the window |
| `gold@example.com` | `gold123` | Gold | RM 120/month active, plus RM 250 one-off |
| `unclaimed@example.com` | *(no account)* | — | An unattached RM 120 pledge, receipt `HFS-DON-202607-6600`, for exercising the claim flow |

The Bronze sponsor's aged-out pledge is not decoration: it is what proves standings decay
rather than accumulating for life.

A pledge submitted through `/donate` starts `PENDING` and therefore confers nothing until
`confirmContributionAction` reconciles it — including in development, where you can call
`confirmContribution` directly from a script or a test.

**These accounts do not exist in production.** `SEEDING_ENABLED` in `sponsorStore.ts` is
`NODE_ENV !== "production"`, and a reachable database is authoritative even when its answer
is empty. Both limits are needed: without the first, the passwords above would sign in
against a live instance whenever the database had no matching row; without the second, an
empty-but-healthy database would publish these four names on the public wall.

---

## 8. Verification

`npx vitest run` — 787 tests across the whole suite, of which 96 cover this feature:

| File | Covers |
|---|---|
| `tests/unit/supporterTier.test.ts` | Thresholds and their boundaries, window ageing, recurring annualisation, cancellation, perk cumulativity |
| `tests/unit/sponsorAccess.test.ts` | Gates per standing, tampered-cookie rejection, dashboard projection, certificate issuance, wall privacy |
| `tests/unit/sponsorPetMediaRoute.test.ts` | The serialized HTTP body, asserting private URLs are absent for each standing |
| `tests/unit/sponsorAuth.test.ts` | Receipt challenge, enumeration resistance, the `"1234"` regression guard, rate limiting, action-level re-authorization |
| `tests/unit/sponsorRepositoryMode.test.ts` | A configured database is authoritative; production carries no seed |

Commitments themselves are covered by `tests/unit/petSponsorship.test.ts`, which belongs to the sponsorship ledger rather than to this feature.

### The build output, checked directly

`next build` keeps every pet profile prerendered (`/pets/pet-001` … `pet-008` build as
SSG), and grepping the prerendered HTML and RSC payloads for the private identifiers —
`ScMzIvxBSi4`, `w=2400`, `maxresdefault` — returns nothing. The gated media is not merely
hidden in those responses; it is not in them.

```bash
npm run build
grep -rl "ScMzIvxBSi4\|w=2400\|maxresdefault" .next/server/app --include=*.html --include=*.rsc
# no output
```

The brief proposed logging in as three test users and checking that media locks and
unlocks. That was kept — the three demo accounts above exist precisely for it — but it is
not the verification. Clicking through a browser cannot demonstrate the property that
matters, which is that an under-tier sponsor's *response bytes* never contain the
protected URLs. That is an assertion about a payload, so it is written as one.
