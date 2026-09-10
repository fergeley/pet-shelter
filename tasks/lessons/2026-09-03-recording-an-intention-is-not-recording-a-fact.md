# Recording an intention is not recording a fact

**Learned:** 2026-09-03

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
