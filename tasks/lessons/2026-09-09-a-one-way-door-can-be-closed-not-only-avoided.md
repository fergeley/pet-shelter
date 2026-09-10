# A one-way door can be closed, not only avoided

**Learned:** 2026-09-09

The most expensive wrong conclusion of the donations/LHDN work (PR #36). I reported twice, in
writing, that the Playwright suite could not be run here: `.env.local` points `DATABASE_URL` at the
Neon production branch, `02_rescue_sponsorship_receipt` submits a donation, and `Donation` is
append-only — so a run would write an irreversible row to production. All of that was true. The
conclusion drawn from it was not.

The app has a **declared offline mode**. `isLedgerPersistent()` is `Boolean(process.env.DATABASE_URL)`,
and `email.ts` takes a simulation branch when `RESEND_API_KEY` is missing. So

```bash
DATABASE_URL="" RESEND_API_KEY="" npx playwright test
```

removes both hazards outright: no database to write to, no mail that can leave. 23/23 specs then
passed. The blocker was never the environment; I priced the door and never asked whether the thing
behind it could be switched off.

**Prove the escape before you use it.** The trick depends entirely on `.env.local` not reinstating
the production URL, so both precedence assumptions were checked *first*: `dotenv` keeps a pre-set
`""`, and so does `next dev` — the latter shown by fetching `/donate` and grepping for "Development
sample data", which renders only on the offline path. A **GET-only probe**, because the cost of
being wrong about precedence was the exact write being avoided.

**Rule:** before recording something as unverifiable because it touches a one-way door, enumerate
the ways the door itself can be shut — a declared offline mode, a simulation branch, a fixture, a
scratch target. "I must not do X against production" and "X cannot be done" are different
sentences. And when an assumption is what makes an unsafe action safe, verify it with a read-only
probe before relying on it.
