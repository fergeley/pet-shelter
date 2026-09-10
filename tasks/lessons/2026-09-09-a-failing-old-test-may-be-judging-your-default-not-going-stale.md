# A failing old test may be judging your default, not going stale

**Learned:** 2026-09-09

Three `DonationReceiptIntegrity` tests failed the moment the new tax-relief checkbox defaulted to
ticked. The reflex is "the form changed, update the tests". The tests were right.

The form *displayed* the tax identifier as required and *accepted* its absence. Those two readings
disagree, and only one survives a change. Honouring the marker blocks every donor who until now gave
with a name and an email — a cosmetic defect promoted to a funding one. Honouring the behaviour
blocks nobody. The failing tests encoded the second reading as a fact about the product, and were a
better guide to the default than my reasoning about what the asterisk "meant".

**Rule:** before editing a test that a change broke, state what the test asserts about the
*product*. If that is a statement you would defend, the default is wrong, not the test. `midwife`
Phase 4 already forbids modifying a test to make it pass without citing a spec line; this is why.
