# Lessons

Patterns worth not repeating, captured after user corrections. Newest first.

---

## 2026-09-03 — Self-review is blindest where it is most confident

**What happened:** I self-critiqued the sponsor portal and produced twelve findings,
including one I graded critical. An external code review then found, as its *first*
finding, a full account takeover in the account-claim challenge — the single mechanism I
had written the most defensive prose about, in code comments, a commit message and a
design guide.

**Why I missed it.** I had reasoned "a receipt number is delivered only in the donor's own
e-Receipt, so possession proves identity", written that down three times, and never
re-derived it. Reviewing my own work, I checked the parts I was unsure about and skimmed
the part I had already argued for. The care I put into justifying it is exactly what
stopped me re-examining it.

**How to apply:** when self-reviewing, treat your own confident explanations as the *first*
place to look, not the last. Specifically: for every security property you have written
prose about, re-derive it from the attacker's side once, ignoring what you wrote. And do
not let a self-critique substitute for an independent one — mine was thorough and still
missed the worst bug on the branch.

**Related:** [[stress-test-all-the-way]].

---

## 2026-09-03 — A public endpoint that returns an identifier destroys it as a credential

**What happened:** the sponsor account-claim challenge required a donation receipt number
matching the claimed email. But `/donate` is a public, unauthenticated form that mints a
receipt for *whatever email the caller types* and returns the number in its own response.
So an attacker could pledge RM 5 as `victim@example.com`, read the receipt out of the
response, and claim the victim's entire giving history, standing and gated content.

The credential and its issuer were the same anonymous endpoint. My mental model was "the
donor receives this by email", which is true and irrelevant — the question is who *else*
can cause the value to exist and observe it.

**How to apply:** before treating any value as proof of possession, answer two questions.
*Who can cause this value to come into existence?* and *does the act of creating it reveal
it to the creator?* If the answer to the first is "anyone", it is not a credential no
matter how it is normally delivered.

The fix generalises too: the value only became safe once it required a state transition
the claimant could not perform (a staff member confirming the payment).

---

## 2026-09-03 — Recording an intention is not recording a fact

**What happened:** the donation ledger stored pledges submitted through a public form with
no payment gateway behind it. That was harmless while a pledge only produced a receipt and
an email. It became an authorization bug the moment I derived *privileges* from it: anyone
could assert an RM 1,200 pledge, or an RM 100 monthly one annualised on the spot, and hold
Gold on the next request.

Nothing about the donation flow changed. What changed is that I attached security weight to
data that had never carried any.

**How to apply:** this is the same shape as the `@unique` lesson below, and it has now bitten
twice on one branch — so treat it as the recurring one. **When you make existing data
load-bearing, its requirements change retroactively.** Before deriving authorization,
uniqueness or money from a field, go and read what actually writes it, and ask what the
value asserts rather than what you wish it asserted. "Someone typed this into a form" and
"the money arrived" are different facts that look identical in a database column.

---

## 2026-09-03 — A test that is green because infrastructure is absent is not green

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

## 2026-09-02 — A critique that proposes fixing everything it finds is not finished

**Correction:** after I produced a twelve-item self-critique of the sponsor portal and
offered to fix all of it, the user asked me to judge it against Chesterton's Fence, KISS,
YAGNI and similar principles.

**What that exposed:** seven of the twelve should not be touched, and one of them I had
diagnosed wrongly. Filing a finding and justifying a change are different steps, and I had
collapsed them.

- `gate()` reading the catalogue on the locked path was filed as a code defect. It is a
  static JSON import feeding a real product string; the only thing actually wrong was a
  sentence in the guide I wrote. The "fix" would have added a callback to defend against a
  migration nobody has planned.
- The pet-page panel "firing an uncacheable request for every anonymous visitor" was
  overstated: `getSponsorContext` short-circuits on a null session, so a signed-out request
  makes **zero** database queries. I had not checked before writing it down.

**How to apply:** for every finding, answer three questions before proposing a change —
*what is this construct for* (if I cannot say, I do not yet understand it well enough to
remove it), *what does it cost at the current scale* (8 pets, 4 sponsors — not the imagined
scale), and *is the defect in the code or in what I wrote about the code*. Then present
the not-fixing list as first-class output, with reasons. It is the more useful half.

**It also improves the fixes that survive.** The real authentication bypass looked like
"the in-memory fallback is dangerous, remove it". Asking what the fence was *for* — the
sponsor tables have never run against Postgres, so the seed is what makes the portal
demonstrable at all — turned a demolition into an environment lock. And KISS turned the
seven-site fix from an `isDatabaseReachable()` probe into deleting seven conditions:
`try/catch` already drew the line correctly, the bug was an extra guard inside the `try`.

**Related:** [[stress-test-all-the-way]] — the mutation check (restore the bug, watch the
new test fail, restore the fix) is what proved the new tests were load-bearing rather than
decorative.

---

## 2026-09-02 — Making a value `@unique` makes its generator load-bearing

*(The general form of this is the "recording an intention" entry above — same branch, same
mistake, different field.)*

**What happened:** donation receipt numbers were `HFS-DON-YYYYMM-` plus four
`Math.random()` digits — fine while nothing depended on them. I added `@unique` to the
column and built the sponsor account-claim challenge on top of it, which silently converted
a cosmetic identifier into both a uniqueness constraint and a possession credential.

9,000 values per month collide by the birthday bound at roughly 112 receipts, and the
insert rejection was swallowed by a `catch` that wrote to memory instead — losing the
donation from the ledger while still emailing the donor a receipt.

**How to apply:** when adding `@unique`, a foreign key, or an authorization check to an
existing field, go and read how that value is produced. The constraint is a new requirement
on old code that was never written to meet it. Then ask whether the *format* is load-bearing
before widening it — four digits was short because a donor quotes it over the phone on an
LHDN tax receipt, so six digits was right and a UUID would not have been.
