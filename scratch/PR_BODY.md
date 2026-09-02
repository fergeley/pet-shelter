Adds Bronze/Silver/Gold sponsor standings, a protected sponsor portal at
`/sponsor/dashboard`, server-enforced gating of exclusive rescue media, and a public
Sponsor Wall at `/sponsors`.

## Three things the brief assumed that weren't true

The feature as specified couldn't be built on the code as it stood, so this fixes the
foundations first:

- **Donations were never persisted.** `submitDonationPledgeAction` built a receipt, wrote
  one audit line and sent an email — nothing queryable as a donor's giving history. There
  was no `Donation` model in the schema at all; receipts lived in `localStorage`. Pledges
  now land in a `SponsorContribution` ledger, which is what every portal feature reads.
- **There was no donor identity** — four *staff* roles on one session cookie. Sponsors get
  their own `hope_sponsor_session` namespace and an account-claim flow, deliberately not
  routed through `loginAction`, which accepts the literal password `"1234"` for any
  account (`src/actions/auth.ts:64`).
- **Bronze/Silver/Gold collided with the shipped tiers.** The existing ones are *purpose
  funds* — kibble RM30, vaccine RM50, spay_neuter RM120, emergency_medical RM250 — hard-coded
  as a union and a Zod enum. Overwriting them would have broken the donate page, receipt
  emails and existing tests. They're kept as orthogonal axes: **you buy a fund, you earn a
  standing.**

## How standings work

Derived from the ledger on every read, never stored — there is deliberately no
`supporterTier` column. A stored tier drifts from the contributions justifying it, and is
a value an attacker would try to write. The session cookie carries identity only.

| Standing | Recognised 12-month contribution | Equivalent recurring pledge |
|---|---|---|
| Bronze | RM 50 | — |
| Silver | RM 300 | RM 25 / month |
| Gold | RM 1,200 | RM 100 / month |

An **active** monthly pledge counts at its annualised value from day one, which is what
makes recurring giving worth committing to. The corollary is deliberate and needs to reach
donor-facing copy: **cancelling drops the standing immediately.** One-time pledges age out
of a rolling 365-day window.

## The gate rule

> A gate decides **before** the protected payload is produced.

Not "renders it conditionally". `getGatedPetVideoDiary` / `getGatedPetGallery` return a
union whose locked branch has **no `items` key at all** — TypeScript refuses code that
reads through it, and nothing an under-tier caller receives contains a URL.

`<TierGate requiredTier="SILVER">` exists and is an async Server Component (as a Client
Component its children would already be in the RSC payload before it ran), but its own doc
comment is explicit that it controls *rendering*, not what the caller fetched — for
sensitive payloads, use the gated readers.

The pet profile reaches them through a Route Handler rather than in-tree, because
`src/app/pets/[id]/page.tsx` declares `generateStaticParams`. Reading `cookies()` in that
tree would trade every prerendered profile page for one gated panel. **Build output
confirms it:** all eight profiles still build as SSG, and grepping every prerendered HTML
and RSC payload for the private identifiers returns nothing.

Server Actions re-authorize independently — `submitCaretakerQuestionAction` re-checks Gold
on every call rather than trusting that `<TierGate>` rendered the form, because a Server
Action is a public HTTP endpoint.

## Self-critique commits (`f937eb2`, `8d1f90d`)

The first commit shipped an authentication bypass of the same class this PR criticises in
`loginAction`, found by reviewing my own work:

`findSponsorByEmail` returned the database row only `if (row)`, so a **miss** fell through
to the in-memory seed. Against a real, populated database that made `gold@example.com` /
`gold123` a working Gold login — with the password published in the guide this branch
committed. `findSponsorById` and `listContributionsBySponsorId` did the same, so session,
standing and ledger all resolved from seeds.

Fixed in two narrow changes, judged against Chesterton's Fence rather than reflex:

- The seed's purpose is real — the sponsor tables have never run against Postgres, and the
  seed is what makes the portal demonstrable. So the fallback **stays**, gated to
  `NODE_ENV !== "production"`. An outage now fails closed.
- Seven query sites stopped conflating "returned nothing" with "did not answer". The
  `try/catch` already drew that line; the bug was an extra guard *inside* the `try`,
  inherited from `serverStore` where "no pets, show demo pets" is deliberate. The fix is
  **subtractive** — no probe helper, seven conditions deleted.

Also: receipt numbers widened from four digits to six from a single extracted generator.
Making the number `@unique` and the basis of the claim challenge turned a cosmetic
weakness into two defects — 9,000 values per month collide by the birthday bound at ~112
receipts, and a rejected insert was silently swallowed, losing the donation from the
ledger. Six digits keeps it quotable on an LHDN receipt (which is *why* it's short).

And the caretaker Q&A now actually delivers: it previously validated, rate-limited,
audited the message *length* and returned success while discarding the body — while the UI
told the sponsor it had been sent.

## Deliberately not fixed

Seven of twelve critique findings were left alone, with reasons in `tasks/todo.md`. The
short version: the dashboard's full pet read and the wall's full scan are YAGNI at 8 pets
and 4 sponsors (both now documented as ceilings); the panel fetches unconditionally
because the session cookie is `httpOnly` and the client genuinely cannot know; `formatDate`
runs client-side because the language comes from a client provider.

One was a **misdiagnosis on my part**: I filed `gate()` reading the catalogue on the locked
path as a code defect. It's a static JSON import feeding a real product string ("3 updates
waiting") — the only thing wrong was a sentence in my own guide, now corrected.

## Verification

281 tests (up from a 183 baseline), `tsc --noEmit` clean, `eslint` 0 errors, `npm run
build` green.

| Suite | Covers |
|---|---|
| `supporterTier.test.ts` | Threshold boundaries, window ageing, recurring annualisation and cancellation, perk cumulativity |
| `sponsorAccess.test.ts` | Gates per standing, tampered-cookie rejection, dashboard projection, certificate issuance, wall privacy |
| `sponsorPetMediaRoute.test.ts` | The serialized HTTP body, asserting private URLs are absent per standing |
| `sponsorAuth.test.ts` | Receipt challenge, enumeration resistance, the `"1234"` regression guard, rate limiting, action-level re-authorization |
| `sponsorLedger.test.ts` | Pledges reaching the ledger, pet-id linkage, consent capture, claim flow |
| `sponsorStoreFallback.test.ts` | Reachable-but-empty vs unreachable database, and that production carries no seed |

The brief asked for manual login as three tier users. Those accounts exist and were
exercised live against a dev server, but they aren't the verification — clicking can't
demonstrate that an under-tier sponsor's *response bytes* lack the URLs, so that's written
as an assertion instead. **Mutation-checked**: restoring the `rows.length > 0` guard fails
exactly one test and nothing else.

## Reviewer notes

- **Not verified against PostgreSQL.** `prisma validate` passes and the client generates,
  but no migration has been applied and every test runs the in-memory path. Run
  `npm run db:push` against a **non-production** Neon branch before deploying — `.env.local`
  points `DATABASE_URL` at production.
- **The gate is real; the current media is not secret.** `exclusiveMedia.json` holds public
  Unsplash and YouTube URLs. Production needs signed, short-lived URLs.
- **Receipt numbers are collision-*unlikely*, not unique.** True uniqueness needs a
  sequence, and that work already exists as `donationLedger.ts` on the TNRM branch — not
  reimplemented here.
- `src/lib/email.ts` interpolates user input into HTML unescaped throughout. Pre-existing
  and out of scope; the one new template escapes its inputs.

Design rationale: `docs/architecture/GUIDE_SPONSOR_TIERS_AND_GATED_CONTENT.md`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)

https://claude.ai/code/session_015UiSt3b3DqJFVKMieuSw6V
