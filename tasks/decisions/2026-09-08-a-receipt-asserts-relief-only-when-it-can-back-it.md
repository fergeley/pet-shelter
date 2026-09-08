# A receipt asserts Section 44(6) relief only when it carries an identifier

**Decided:** 2026-09-08 · from the `/code-review high` pass on `975a5f9..6fd1435`

Extends [[2026-09-08-lhdn-relief-is-opt-in-not-a-column]], which gated the *identifier* and left
the *document's assertions* unconditional. The review was right that this was the more serious half:

> "the diff gates the identifier but leaves the document's assertions unconditional, and now makes
> the identifier-less path the default. Concrete scenario: a donor unticks the box, gives RM 50, and
> receives an email headed 'OFFICIAL DONATION RECEIPT & TAX DEDUCTION DOSSIER' declaring it valid
> for tax filing, with no NRIC on it."

That is verbatim the defect the first decision claimed to close, so the first decision was
incomplete rather than wrong.

## The predicate, and why it is not four truthiness checks

`isTaxClaimable(receipt)` now lives in `src/lib/domain/shelterIdentity.ts`, beside the statutory
identifiers it governs. Four surfaces assert deductibility — the confirmation banner, the printed
dossier's header, the dossier's footer, and both halves of the emailed receipt — which is the third
occurrence the "Boundaries and duplication" rule waits for before abstracting.

In `email.ts` it is resolved once into the existing `fields` object rather than called twice. That
object exists because the plain-text and HTML halves once stated the payment rail differently and
nothing compared them; a receipt claiming relief in the HTML and disclaiming it in the plain text
would be the same bug with worse consequences.

## Three smaller findings acted on

- **The e2e page object was broken and no local check could see it.** `fillDonor` fills the tax-ID
  input, which is now `disabled` until the box is ticked, and Playwright's `fill()` waits for an
  enabled element — so `02_rescue_sponsorship_receipt` would not have failed, it would have hung
  until timeout. Fixed by ticking `#widgetWantsTaxReceipt` first. This was a genuine miss: the spec
  was checked for tax-ID use, the page object behind it was not.
- **`handleReset` cleared the identifier but not the opt-in**, so "Make Another Donation" returned a
  form whose required field had been silently emptied. Both are cleared now, or neither.
- **A failed refresh left live Confirm buttons under a banner saying the read had failed.** The rows
  are dropped with the error, for the reason the queue reports failures at all.

## One finding softened rather than fixed as described

The review noted that an unauthorised caller sees "could not reach the shelter", because
`assertHasPermission` throws outside the action's `try` and a production build masks it into an
opaque digest. Making this a real 403 body would mean changing how the Server Action reports
authorisation — a change to the shared guard shape that `/admin/members` and `/admin/faqs` also use,
and outside what this task was for.

Instead the message stops asserting a cause it cannot know: it now names both possibilities. A
wrong explanation is worse than an ambiguous one, and the ambiguity is real rather than laziness —
the client genuinely cannot tell these apart. **Left open:** the admin surfaces disagree about how
they report a denial, and this one is now the odd member of that set in a second way.

## Verified — and how the one-way door was closed rather than accepted

The first draft of this entry recorded the e2e fix as **ASSERTED**, on the grounds that
`.env.local` points `DATABASE_URL` at the Neon production branch and
`02_rescue_sponsorship_receipt` submits a donation, so a run would write a real row to an
append-only production table (veto §1). That reasoning was right about the hazard and wrong about
the conclusion: **the door can be closed instead of avoided.**

The app has a *declared* offline mode — `isLedgerPersistent()` is `Boolean(process.env.DATABASE_URL)`
— and `email.ts` has a simulation branch on a missing `RESEND_API_KEY`. So:

```bash
DATABASE_URL="" RESEND_API_KEY="" npx playwright test
```

neutralises both hazards at once: no database to write to, no mail that can leave.

**Both halves of the precedence assumption were checked before anything ran**, because the whole
value of the trick depends on `.env.local` not quietly reinstating the production URL:

1. `dotenv` (loaded by `playwright.config.ts`) does not override a pre-set variable — a preset
   `""` survived the load, so `isLedgerPersistent()` would be `false`.
2. `next dev` does not either. Proved by a **GET-only** probe rather than by trusting the
   documentation: `/donate` renders "Development sample data — these figures are not real spending
   records" only when `readAllocationSummary` returns `source: "sample"`, which is the offline
   path. It appeared exactly once in the served HTML. Had Next preferred `.env.local`, the count
   would have been zero.

**Result: 23/23 e2e specs pass**, including `issues a numbered, tax-exempt e-receipt`.

The fix was then shown to be load-bearing rather than incidental by commenting the `check()` out
and re-running:

    TimeoutError: locator.fill: Timeout 15000ms exceeded.
      - locator resolved to <input disabled ... id="widgetTaxIdOrIc" ...>
      - element is not enabled

That is the reviewer's predicted failure exactly — a hang, not an assertion failure. Note the two
fixes interlock: the spec asserts `/44\(6\)/` is visible, which passes *only because* the page
object now ticks the box, making `isTaxClaimable` true.

**Still not measured:** nothing here ran against real PostgreSQL. The Prisma branch of
`listPendingSponsorships` remains asserted — the run above exercised the in-memory ledger.

**Note for whoever runs this next:** a fresh worktree has no `node_modules` (Vitest and `tsc` work
only because `npx` walks up to the parent checkout, which Turbopack refuses to do), so `npm install`
in the worktree is a prerequisite for `next dev`.
