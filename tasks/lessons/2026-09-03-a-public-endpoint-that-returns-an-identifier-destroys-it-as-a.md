# A public endpoint that returns an identifier destroys it as a credential

**Learned:** 2026-09-03

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
