# Lessons

Patterns worth not repeating, captured after user corrections. Newest first.

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
